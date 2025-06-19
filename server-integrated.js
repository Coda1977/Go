const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import our modules
const { 
  initDatabase, 
  createUser, 
  getAllUsers, 
  getUserById, 
  getStats, 
  updateUserStatus, 
  resetUserProgress,
  getUsersNeedingEmails,
  healthCheck
} = require('./database');

const { analyzeGoals, testAIService } = require('./aiService');
const { sendWelcomeEmail, testEmail, verifyEmailConfig } = require('./emailService');
const { 
  scheduleWeeklyEmails, 
  processWeeklyEmails, 
  sendManualEmail, 
  testScheduling, 
  getUpcomingEmails 
} = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 5000;

// Enhanced security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for compatibility
}));

// Enhanced rate limiting with different tiers
const createRateLimiter = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { success: false, message },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`Rate limit exceeded for IP: ${req.ip}, path: ${req.path}`);
    res.status(429).json({ success: false, message });
  }
});

// Different rate limits for different endpoints
const generalLimiter = createRateLimiter(15 * 60 * 1000, 100, 'Too many requests from this IP, please try again later.');
const signupLimiter = createRateLimiter(15 * 60 * 1000, 5, 'Too many signup attempts, please try again later.');
const adminLimiter = createRateLimiter(15 * 60 * 1000, 200, 'Too many admin requests, please try again later.');

app.use('/api/admin', adminLimiter);
app.use('/signup', signupLimiter);
app.use(generalLimiter);

// Enhanced CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // In production, specify allowed origins
    if (process.env.NODE_ENV === 'production') {
      const allowedOrigins = [
        'https://your-domain.com',
        'https://www.your-domain.com',
        /\.replit\.dev$/,
        /\.repl\.co$/
      ];
      
      const isAllowed = allowedOrigins.some(allowedOrigin => {
        if (typeof allowedOrigin === 'string') {
          return origin === allowedOrigin;
        }
        return allowedOrigin.test(origin);
      });
      
      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // Allow all origins in development
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Enhanced body parsing with size limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ success: false, message: 'Invalid JSON format' });
      throw new Error('Invalid JSON');
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 1000
}));

app.use(express.static('public', {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true
}));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'error' : 'info';
    
    console.log(`[${logLevel.toUpperCase()}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - IP: ${req.ip}`);
    
    // Log slow requests
    if (duration > 1000) {
      console.warn(`Slow request detected: ${req.method} ${req.path} took ${duration}ms`);
    }
  });
  
  next();
});

// Enhanced input validation middleware
const validateSignup = (req, res, next) => {
  try {
    const { email, goals, timezone } = req.body;
    
    // Validate email
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'Email is required and must be a string' 
      });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedEmail = email.trim().toLowerCase();
    
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide a valid email address' 
      });
    }
    
    // Check for common disposable email domains
    const disposableDomains = ['10minutemail.com', 'tempmail.org', 'guerrillamail.com'];
    const emailDomain = normalizedEmail.split('@')[1];
    if (disposableDomains.includes(emailDomain)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please use a permanent email address' 
      });
    }
    
    // Validate goals
    if (!goals || typeof goals !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'Leadership goals are required' 
      });
    }
    
    const trimmedGoals = goals.trim();
    if (trimmedGoals.length < 20) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide more detailed leadership goals (at least 20 characters)' 
      });
    }
    
    if (trimmedGoals.length > 2000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Goals description too long (maximum 2000 characters)' 
      });
    }
    
    // Check for spam content
    const spamKeywords = ['bitcoin', 'crypto', 'investment', 'mlm', 'pyramid'];
    const hasSpam = spamKeywords.some(keyword => 
      trimmedGoals.toLowerCase().includes(keyword)
    );
    
    if (hasSpam) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide legitimate leadership development goals' 
      });
    }
    
    // Validate timezone
    if (!timezone || typeof timezone !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'Timezone is required' 
      });
    }
    
    const trimmedTimezone = timezone.trim();
    if (trimmedTimezone.length < 3) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid timezone format' 
      });
    }
    
    // Sanitize inputs
    req.body.email = normalizedEmail;
    req.body.goals = trimmedGoals;
    req.body.timezone = trimmedTimezone;
    
    next();
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Input validation failed' 
    });
  }
};

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false, 
      message: 'Admin authentication required' 
    });
  }
  
  const token = authHeader.substring(7);
  if (token !== adminPassword) {
    return res.status(403).json({ 
      success: false, 
      message: 'Invalid admin credentials' 
    });
  }
  
  next();
};

// Initialize application with enhanced error handling
const initializeApp = async () => {
  try {
    console.log('🚀 Initializing Go Leadership App...');
    
    // Check required environment variables
    const requiredEnvVars = ['DATABASE_URL', 'OPENAI_API_KEY', 'EMAIL_USER', 'EMAIL_PASSWORD'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
    
    // Initialize database with retry logic
    let dbInitialized = false;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (!dbInitialized && attempts < maxAttempts) {
      try {
        attempts++;
        console.log(`Database initialization attempt ${attempts}/${maxAttempts}`);
        await initDatabase();
        dbInitialized = true;
        console.log('✅ Database initialized successfully');
      } catch (error) {
        console.error(`Database initialization attempt ${attempts} failed:`, error.message);
        if (attempts === maxAttempts) {
          throw new Error(`Failed to initialize database after ${maxAttempts} attempts: ${error.message}`);
        }
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
      }
    }
    
    // Verify email configuration
    try {
      const emailWorking = await verifyEmailConfig();
      if (emailWorking) {
        console.log('✅ Email service verified');
      } else {
        console.warn('⚠️  Email configuration issues detected - emails may not work');
      }
    } catch (error) {
      console.warn('⚠️  Email verification failed:', error.message);
    }
    
    // Start the email scheduler
    try {
      scheduleWeeklyEmails();
      console.log('✅ Email scheduler started');
    } catch (error) {
      console.error('❌ Failed to start email scheduler:', error.message);
      // Don't fail the entire app if scheduler fails
    }
    
    console.log('🎉 Go Leadership App initialized successfully!');
    
  } catch (error) {
    console.error('❌ Critical error initializing app:', error);
    process.exit(1);
  }
};

// Routes with enhanced error handling

// Landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Success page
app.get('/success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'success.html'));
});

// Admin dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Enhanced user signup with comprehensive validation and error handling
app.post('/signup', signupLimiter, validateSignup, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { email, goals, timezone } = req.body;
    
    console.log(`New signup attempt: ${email} from IP: ${req.ip}`);
    
    // Create user in database with enhanced error handling
    let userId;
    try {
      userId = await createUser(email, timezone, goals);
    } catch (dbError) {
      if (dbError.message.includes('UNIQUE constraint failed')) {
        return res.status(409).json({ 
          success: false, 
          message: 'This email is already registered. Each email can only be used once.' 
        });
      }
      throw dbError;
    }
    
    // Generate AI analysis of goals with fallback
    let aiContent;
    try {
      aiContent = await analyzeGoals(goals);
    } catch (aiError) {
      console.error('AI analysis failed, using fallback:', aiError.message);
      // Fallback content if AI fails
      aiContent = {
        feedback: "Thank you for sharing your leadership goals with me. I'm here to support you on this journey over the next 12 weeks.",
        firstAction: "This week, take 15 minutes to reflect on your current leadership strengths and identify one area where you'd like to grow."
      };
    }
    
    // Send welcome email with retry logic
    let emailResult;
    try {
      emailResult = await sendWelcomeEmail({ 
        id: userId, 
        email, 
        goals 
      }, aiContent);
    } catch (emailError) {
      console.error('Welcome email failed:', emailError.message);
      emailResult = { success: false, error: emailError.message };
    }
    
    const processingTime = Date.now() - startTime;
    
    if (emailResult.success) {
      console.log(`✅ User ${userId} created and welcome email sent to ${email} in ${processingTime}ms`);
      res.json({ 
        success: true, 
        message: 'Welcome! Check your email for your first action item.',
        userId: userId,
        processingTime: `${processingTime}ms`
      });
    } else {
      console.error(`❌ User ${userId} created but welcome email failed:`, emailResult.error);
      res.status(500).json({ 
        success: false, 
        message: 'Account created but welcome email failed. Please contact support.',
        userId: userId // Still return user ID for potential recovery
      });
    }
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Signup error:', {
      error: error.message,
      email: req.body.email,
      ip: req.ip,
      processingTime: `${processingTime}ms`
    });
    
    // Determine appropriate error response
    if (error.message.includes('API key')) {
      res.status(503).json({ 
        success: false, 
        message: 'AI service temporarily unavailable. Please try again later.' 
      });
    } else if (error.message.includes('database') || error.message.includes('connection')) {
      res.status(503).json({ 
        success: false, 
        message: 'Database service temporarily unavailable. Please try again later.' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'An unexpected error occurred. Please try again later.' 
      });
    }
  }
});

// Admin API endpoints with authentication

// Get all users with pagination
app.get('/api/users', authenticateAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Max 100 per request
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    
    const users = await getAllUsers(limit, offset);
    res.json({ 
      success: true, 
      users,
      pagination: {
        limit,
        offset,
        count: users.length
      }
    });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ success: false, message: 'Error fetching users' });
  }
});

// Get specific user with enhanced data
app.get('/api/user/:id', authenticateAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }
    
    const user = await getUserById(userId);
    if (user) {
      // Get additional user data
      const { getEmailHistory } = require('./database');
      const emailHistory = await getEmailHistory(userId, 10); // Last 10 emails
      
      res.json({ 
        success: true, 
        user: {
          ...user,
          emailHistory
        }
      });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ success: false, message: 'Error fetching user' });
  }
});

// Get enhanced app statistics
app.get('/api/stats', authenticateAdmin, async (req, res) => {
  try {
    const stats = await getStats();
    
    // Add additional metrics
    const enhancedStats = {
      ...stats,
      successRate: stats.totalEmails > 0 
        ? ((stats.totalEmails - stats.failedEmails) / stats.totalEmails * 100).toFixed(2) + '%'
        : 'N/A',
      completionRate: stats.totalUsers > 0 
        ? (stats.completedUsers / stats.totalUsers * 100).toFixed(2) + '%'
        : 'N/A',
      lastUpdated: new Date().toISOString()
    };
    
    res.json({ success: true, stats: enhancedStats });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ success: false, message: 'Error fetching statistics' });
  }
});

// Manually send email to user
app.post('/api/send-email/:id', authenticateAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }
    
    await sendManualEmail(userId);
    console.log(`Manual email sent to user ${userId} by admin from IP: ${req.ip}`);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending manual email:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Test email functionality
app.post('/api/test-email', authenticateAdmin, async (req, res) => {
  try {
    const { email } = req.body;
    const testResult = await testEmail(email || 'test@example.com');
    
    if (testResult) {
      res.json({ success: true, message: 'Test email sent successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Test email failed' });
    }
  } catch (error) {
    console.error('Error testing email:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update user status with validation
app.post('/api/user/:id/status', authenticateAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { isActive } = req.body;
    
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive must be boolean' });
    }
    
    await updateUserStatus(userId, isActive);
    console.log(`User ${userId} status updated to ${isActive ? 'active' : 'inactive'} by admin`);
    res.json({ success: true, message: 'User status updated' });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ success: false, message: 'Error updating user status' });
  }
});

// Reset user progress
app.post('/api/user/:id/reset', authenticateAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }
    
    await resetUserProgress(userId);
    console.log(`User ${userId} progress reset by admin`);
    res.json({ success: true, message: 'User progress reset successfully' });
  } catch (error) {
    console.error('Error resetting user progress:', error);
    res.status(500).json({ success: false, message: 'Error resetting user progress' });
  }
});

// Get upcoming emails schedule
app.get('/api/upcoming-emails', authenticateAdmin, async (req, res) => {
  try {
    const upcoming = await getUpcomingEmails();
    res.json({ success: true, upcoming });
  } catch (error) {
    console.error('Error getting upcoming emails:', error);
    res.status(500).json({ success: false, message: 'Error fetching upcoming emails' });
  }
});

// Get users needing emails soon
app.get('/api/users-needing-emails', authenticateAdmin, async (req, res) => {
  try {
    const users = await getUsersNeedingEmails();
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error getting users needing emails:', error);
    res.status(500).json({ success: false, message: 'Error fetching users needing emails' });
  }
});

// Cron job endpoint (called by Replit cron or external scheduler)
app.post('/cron/weekly-emails', async (req, res) => {
  try {
    console.log('Manual cron trigger received from IP:', req.ip);
    const result = await processWeeklyEmails();
    res.json({ success: true, message: 'Weekly emails processed', result });
  } catch (error) {
    console.error('Error in cron job:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Test endpoints for development

// Test AI service
app.post('/test/ai', async (req, res) => {
  try {
    const result = await testAIService();
    res.json({ success: result, message: result ? 'AI service working' : 'AI service failed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Test scheduling logic
app.post('/test/scheduling', async (req, res) => {
  try {
    await testScheduling();
    res.json({ success: true, message: 'Check console for scheduling test results' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Test database connection
app.get('/test/database', async (req, res) => {
  try {
    const { testConnection } = require('./database');
    const connected = await testConnection();
    if (connected) {
      const stats = await getStats();
      res.json({ success: true, message: 'Database working', stats });
    } else {
      res.status(500).json({ success: false, message: 'Database connection failed' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Enhanced health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = await healthCheck();
    
    const response = {
      status: health.status,
      timestamp: health.timestamp,
      version: '1.0.0',
      port: PORT,
      database: health,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development'
    };
    
    if (health.status === 'healthy') {
      res.json(response);
    } else {
      res.status(503).json(response);
    }
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Enhanced error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : error.message;
    
  res.status(500).json({ 
    success: false, 
    message: message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  console.warn(`404 - Not found: ${req.method} ${req.path} from IP: ${req.ip}`);
  res.status(404).json({ 
    success: false, 
    message: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Gracefully shutting down Go Leadership App...`);
  
  // Stop accepting new connections
  server.close(() => {
    console.log('HTTP server closed');
  });
  
  // Close database connections
  try {
    const { closeDatabase } = require('./database');
    await closeDatabase();
  } catch (error) {
    console.error('Error closing database:', error);
  }
  
  console.log('✅ Graceful shutdown completed');
  process.exit(0);
};

// Start the server
const server = app.listen(PORT, async () => {
  console.log(`🚀 Go Leadership App running on port ${PORT}`);
  console.log(`📱 Access the app: http://localhost:${PORT}`);
  console.log(`⚙️  Admin dashboard: http://localhost:${PORT}/admin`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🐘 Database: PostgreSQL with connection pooling`);
  console.log(`🔒 Security: Helmet + Rate limiting enabled`);
  
  // Initialize the application
  await initializeApp();
  
  console.log('🎯 Ready to help leaders achieve their goals!');
});

// Graceful shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

module.exports = app;const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import our modules
const { 
  initDatabase, 
  createUser, 
  getAllUsers, 
  getUserById, 
  getStats, 
  updateUserStatus, 
  resetUserProgress,
  getUsersNeedingEmails 
} = require('./database');

const { analyzeGoals, testAIService } = require('./aiService');
const { sendWelcomeEmail, testEmail, verifyEmailConfig } = require('./emailService');
const { 
  scheduleWeeklyEmails, 
  processWeeklyEmails, 
  sendManualEmail, 
  testScheduling, 
  getUpcomingEmails 
} = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 signup attempts per 15 minutes
  message: 'Too many signup attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] 
    : true,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Input validation middleware
const validateSignup = (req, res, next) => {
  const { email, goals, timezone } = req.body;
  
  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Please provide a valid email address' 
    });
  }
  
  // Validate goals
  if (!goals || typeof goals !== 'string' || goals.trim().length < 20) {
    return res.status(400).json({ 
      success: false, 
      message: 'Please provide detailed leadership goals (at least 20 characters)' 
    });
  }
  
  if (goals.length > 2000) {
    return res.status(400).json({ 
      success: false, 
      message: 'Goals description too long (maximum 2000 characters)' 
    });
  }
  
  // Validate timezone
  if (!timezone || typeof timezone !== 'string') {
    return res.status(400).json({ 
      success: false, 
      message: 'Timezone is required' 
    });
  }
  
  // Sanitize inputs
  req.body.email = email.trim().toLowerCase();
  req.body.goals = goals.trim();
  req.body.timezone = timezone.trim();
  
  next();
};

// Initialize application
const initializeApp = async () => {
  try {
    console.log('🚀 Initializing Go Leadership App...');
    
    // Initialize database
    await initDatabase();
    console.log('✅ Database initialized');
    
    // Verify email configuration
    const emailWorking = await verifyEmailConfig();
    if (!emailWorking) {
      console.warn('⚠️  Email configuration issues detected');
    } else {
      console.log('✅ Email service verified');
    }
    
    // Start the email scheduler
    scheduleWeeklyEmails();
    console.log('✅ Email scheduler started');
    
    console.log('🎉 Go Leadership App initialized successfully!');
    
  } catch (error) {
    console.error('❌ Error initializing app:', error);
    process.exit(1);
  }
};

// Routes

// Landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Success page
app.get('/success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'success.html'));
});

// Admin dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// User signup with rate limiting and validation
app.post('/signup', signupLimiter, validateSignup, async (req, res) => {
  try {
    const { email, goals, timezone } = req.body;
    
    console.log(`New signup attempt: ${email}`);
    
    // Create user in database
    const userId = await createUser(email, timezone, goals);
    
    // Generate AI analysis of goals
    const aiContent = await analyzeGoals(goals);
    
    // Send welcome email
    const emailResult = await sendWelcomeEmail({ 
      id: userId, 
      email, 
      goals 
    }, aiContent);
    
    if (emailResult.success) {
      console.log(`✅ User ${userId} created and welcome email sent to ${email}`);
      res.json({ 
        success: true, 
        message: 'Welcome! Check your email for your first action item.',
        userId: userId 
      });
    } else {
      console.error(`❌ User ${userId} created but welcome email failed:`, emailResult.error);
      res.status(500).json({ 
        success: false, 
        message: 'Account created but welcome email failed. Please contact support.' 
      });
    }
    
  } catch (error) {
    console.error('Signup error:', error);
    
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ 
        success: false, 
        message: 'This email is already registered. Each email can only be used once.' 
      });
    } else if (error.message.includes('API key')) {
      res.status(500).json({ 
        success: false, 
        message: 'Service temporarily unavailable. Please try again later.' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'An error occurred during signup. Please try again.' 
      });
    }
  }
});

// Admin API endpoints

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ success: false, message: 'Error fetching users' });
  }
});

// Get specific user
app.get('/api/user/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }
    
    const user = await getUserById(userId);
    if (user) {
      res.json({ success: true, user });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ success: false, message: 'Error fetching user' });
  }
});

// Get app statistics
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await getStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ success: false, message: 'Error fetching statistics' });
  }
});

// Manually send email to user
app.post('/api/send-email/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }
    
    await sendManualEmail(userId);
    console.log(`Manual email sent to user ${userId}`);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending manual email:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Test email functionality
app.post('/api/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    const testResult = await testEmail(email || 'test@example.com');
    
    if (testResult) {
      res.json({ success: true, message: 'Test email sent successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Test email failed' });
    }
  } catch (error) {
    console.error('Error testing email:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update user status
app.post('/api/user/:id/status', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { isActive } = req.body;
    
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive must be boolean' });
    }
    
    await updateUserStatus(userId, isActive);
    console.log(`User ${userId} status updated to ${isActive ? 'active' : 'inactive'}`);
    res.json({ success: true, message: 'User status updated' });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ success: false, message: 'Error updating user status' });
  }
});

// Reset user progress
app.post('/api/user/:id/reset', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }
    
    await resetUserProgress(userId);
    console.log(`User ${userId} progress reset`);
    res.json({ success: true, message: 'User progress reset successfully' });
  } catch (error) {
    console.error('Error resetting user progress:', error);
    res.status(500).json({ success: false, message: 'Error resetting user progress' });
  }
});

// Get upcoming emails schedule
app.get('/api/upcoming-emails', async (req, res) => {
  try {
    const upcoming = await getUpcomingEmails();
    res.json({ success: true, upcoming });
  } catch (error) {
    console.error('Error getting upcoming emails:', error);
    res.status(500).json({ success: false, message: 'Error fetching upcoming emails' });
  }
});

// Get users needing emails soon
app.get('/api/users-needing-emails', async (req, res) => {
  try {
    const users = await getUsersNeedingEmails();
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error getting users needing emails:', error);
    res.status(500).json({ success: false, message: 'Error fetching users needing emails' });
  }
});

// Cron job endpoint (called by Replit cron or external scheduler)
app.post('/cron/weekly-emails', async (req, res) => {
  try {
    console.log('Manual cron trigger received');
    await processWeeklyEmails();
    res.json({ success: true, message: 'Weekly emails processed' });
  } catch (error) {
    console.error('Error in cron job:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Test endpoints for development

// Test AI service
app.post('/test/ai', async (req, res) => {
  try {
    const result = await testAIService();
    res.json({ success: result, message: result ? 'AI service working' : 'AI service failed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Test scheduling logic
app.post('/test/scheduling', async (req, res) => {
  try {
    await testScheduling();
    res.json({ success: true, message: 'Check console for scheduling test results' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Test database connection
app.get('/test/database', async (req, res) => {
  try {
    const stats = await getStats();
    res.json({ success: true, message: 'Database working', stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    port: PORT
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : error.message;
    
  res.status(500).json({ 
    success: false, 
    message: message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Endpoint not found' 
  });
});

// Graceful shutdown handler
const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Gracefully shutting down Go Leadership App...`);
  
  // Close database connections and other cleanup
  const { closeDatabase } = require('./database');
  closeDatabase();
  
  process.exit(0);
};

// Start the server
const server = app.listen(PORT, async () => {
  console.log(`🚀 Go Leadership App running on port ${PORT}`);
  console.log(`📱 Access the app: http://localhost:${PORT}`);
  console.log(`⚙️  Admin dashboard: http://localhost:${PORT}/admin`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  
  // Initialize the application
  await initializeApp();
  
  console.log('🎯 Ready to help leaders achieve their goals!');
});

// Graceful shutdown
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

module.exports = app;const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

// Import our modules
const { 
  initDatabase, 
  createUser, 
  getAllUsers, 
  getUserById, 
  getStats, 
  updateUserStatus, 
  resetUserProgress,
  getUsersNeedingEmails 
} = require('./database');

const { analyzeGoals, testAIService } = require('./aiService');
const { sendWelcomeEmail, testEmail, verifyEmailConfig } = require('./emailService');
const { 
  scheduleWeeklyEmails, 
  processWeeklyEmails, 
  sendManualEmail, 
  testScheduling, 
  getUpcomingEmails 
} = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Initialize application
const initializeApp = async () => {
  try {
    console.log('🚀 Initializing Go Leadership App...');
    
    // Initialize database
    await initDatabase();
    console.log('✅ Database initialized');
    
    // Verify email configuration
    const emailWorking = await verifyEmailConfig();
    if (!emailWorking) {
      console.warn('⚠️  Email configuration issues detected');
    }
    
    // Start the email scheduler
    scheduleWeeklyEmails();
    console.log('✅ Email scheduler started');
    
    console.log('🎉 Go Leadership App initialized successfully!');
    
  } catch (error) {
    console.error('❌ Error initializing app:', error);
    process.exit(1);
  }
};

// Routes

// Landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Success page
app.get('/success', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'success.html'));
});

// Admin dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// User signup
app.post('/signup', async (req, res) => {
  try {
    const { email, goals, timezone } = req.body;
    
    if (!email || !goals || !timezone) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email, goals, and timezone are required' 
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please enter a valid email address' 
      });
    }
    
    // Create user in database
    const userId = await createUser(email, timezone, goals);
    
    // Generate AI analysis of goals
    const aiContent = await analyzeGoals(goals);
    
    // Send welcome email
    const emailResult = await sendWelcomeEmail({ 
      id: userId, 
      email, 
      goals 
    }, aiContent);
    
    if (emailResult.success) {
      res.json({ 
        success: true, 
        message: 'Welcome! Check your email for your first action item.',
        userId: userId 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Account created but welcome email failed. Please contact support.' 
      });
    }
    
  } catch (error) {
    console.error('Signup error:', error);
    
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ 
        success: false, 
        message: 'This email is already registered. Each email can only be used once.' 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'An error occurred during signup. Please try again.' 
      });
    }
  }
});

// Admin API endpoints

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ success: false, message: 'Error fetching users' });
  }
});

// Get specific user
app.get('/api/user/:id', async (req, res) => {
  try {
    const user = await getUserById(parseInt(req.params.id));
    if (user) {
      res.json({ success: true, user });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ success: false, message: 'Error fetching user' });
  }
});

// Get app statistics
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await getStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ success: false, message: 'Error fetching statistics' });
  }
});

// Manually send email to user
app.post('/api/send-email/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    await sendManualEmail(userId);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending manual email:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Test email functionality
app.post('/api/test-email', async (req, res) => {
  try {
    const { email } = req.body;
    const testResult = await testEmail(email || 'test@example.com');
    
    if (testResult) {
      res.json({ success: true, message: 'Test email sent successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Test email failed' });
    }
  } catch (error) {
    console.error('Error testing email:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update user status
app.post('/api/user/:id/status', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { isActive } = req.body;
    
    await updateUserStatus(userId, isActive);
    res.json({ success: true, message: 'User status updated' });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ success: false, message: 'Error updating user status' });
  }
});

// Reset user progress
app.post('/api/user/:id/reset', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    await resetUserProgress(userId);
    res.json({ success: true, message: 'User progress reset successfully' });
  } catch (error) {
    console.error('Error resetting user progress:', error);
    res.status(500).json({ success: false, message: 'Error resetting user progress' });
  }
});

// Get upcoming emails schedule
app.get('/api/upcoming-emails', async (req, res) => {
  try {
    const upcoming = await getUpcomingEmails();
    res.json({ success: true, upcoming });
  } catch (error) {
    console.error('Error getting upcoming emails:', error);
    res.status(500).json({ success: false, message: 'Error fetching upcoming emails' });
  }
});

// Get users needing emails soon
app.get('/api/users-needing-emails', async (req, res) => {
  try {
    const users = await getUsersNeedingEmails();
    res.json({ success: true, users });
  } catch (error) {
    console.error('Error getting users needing emails:', error);
    res.status(500).json({ success: false, message: 'Error fetching users needing emails' });
  }
});

// Cron job endpoint (called by Replit cron or external scheduler)
app.post('/cron/weekly-emails', async (req, res) => {
  try {
    console.log('Manual cron trigger received');
    await processWeeklyEmails();
    res.json({ success: true, message: 'Weekly emails processed' });
  } catch (error) {
    console.error('Error in cron job:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Test endpoints for development

// Test AI service
app.post('/test/ai', async (req, res) => {
  try {
    const result = await testAIService();
    res.json({ success: result, message: result ? 'AI service working' : 'AI service failed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Test scheduling logic
app.post('/test/scheduling', async (req, res) => {
  try {
    await testScheduling();
    res.json({ success: true, message: 'Check console for scheduling test results' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Test database connection
app.get('/test/database', async (req, res) => {
  try {
    const stats = await getStats();
    res.json({ success: true, message: 'Database working', stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error' 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Endpoint not found' 
  });
});

// Start the server
app.listen(PORT, async () => {
  console.log(`🚀 Go Leadership App running on port ${PORT}`);
  console.log(`📱 Access the app: http://localhost:${PORT}`);
  console.log(`⚙️  Admin dashboard: http://localhost:${PORT}/admin`);
  
  // Initialize the application
  await initializeApp();
  
  console.log('🎯 Ready to help leaders achieve their goals!');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Gracefully shutting down Go Leadership App...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Gracefully shutting down Go Leadership App...');
  process.exit(0);
});

module.exports = app;