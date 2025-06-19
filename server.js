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

const { analyzeGoals, testAIService } = require('./ai-service');
const { sendWelcomeEmail, testEmail, verifyEmailConfig } = require('./email-service');
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
  crossOriginEmbedderPolicy: false,
}));

// Enhanced rate limiting
const createRateLimiter = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { success: false, message },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalLimiter = createRateLimiter(15 * 60 * 1000, 100, 'Too many requests from this IP, please try again later.');
const signupLimiter = createRateLimiter(15 * 60 * 1000, 5, 'Too many signup attempts, please try again later.');
const adminLimiter = createRateLimiter(15 * 60 * 1000, 200, 'Too many admin requests, please try again later.');

app.use('/api/admin', adminLimiter);
app.use('/signup', signupLimiter);
app.use(generalLimiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [/\.replit\.dev$/, /\.repl\.co$/]
    : true,
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Input validation middleware
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
    
    // Validate timezone
    if (!timezone || typeof timezone !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'Timezone is required' 
      });
    }
    
    // Sanitize inputs
    req.body.email = normalizedEmail;
    req.body.goals = trimmedGoals;
    req.body.timezone = timezone.trim();
    
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

// Initialize application
const initializeApp = async () => {
  try {
    console.log('🚀 Initializing Go Leadership App...');
    
    // Check required environment variables
    const requiredEnvVars = ['DATABASE_URL', 'OPENAI_API_KEY', 'EMAIL_USER', 'EMAIL_PASSWORD'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
    
    // Initialize database
    await initDatabase();
    console.log('✅ Database initialized successfully');
    
    // Verify email configuration
    try {
      const emailWorking = await verifyEmailConfig();
      if (emailWorking) {
        console.log('✅ Email service verified');
      } else {
        console.warn('⚠️  Email configuration issues detected');
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
    }
    
    console.log('🎉 Go Leadership App initialized successfully!');
    
  } catch (error) {
    console.error('❌ Critical error initializing app:', error);
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
app.post('/signup', signupLimiter, validateSignup, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { email, goals, timezone } = req.body;
    
    console.log(`New signup attempt: ${email} from IP: ${req.ip}`);
    
    // Create user in database
    let userId;
    try {
      userId = await createUser(email, timezone, goals);
    } catch (dbError) {
      if (dbError.message.includes('Email already exists')) {
        return res.status(409).json({ 
          success: false, 
          message: 'This email is already registered. Each email can only be used once.' 
        });
      }
      throw dbError;
    }
    
    // Generate AI analysis of goals
    let aiContent;
    try {
      aiContent = await analyzeGoals(goals);
    } catch (aiError) {
      console.error('AI analysis failed, using fallback:', aiError.message);
      aiContent = {
        feedback: "Thank you for sharing your leadership goals with me. I'm here to support you on this journey over the next 12 weeks.",
        firstAction: "This week, take 15 minutes to reflect on your current leadership strengths and identify one area where you'd like to grow."
      };
    }
    
    // Send welcome email
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
        userId: userId
      });
    } else {
      console.error(`❌ User ${userId} created but welcome email failed:`, emailResult.error);
      res.status(500).json({ 
        success: false, 
        message: 'Account created but welcome email failed. Please contact support.',
        userId: userId
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
    
    res.status(500).json({ 
      success: false, 
      message: 'An unexpected error occurred. Please try again later.' 
    });
  }
});

// Admin API endpoints

// Get all users
app.get('/api/users', authenticateAdmin, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    
    const users = await getAllUsers(limit, offset);
    res.json({ 
      success: true, 
      users,
      pagination: { limit, offset, count: users.length }
    });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ success: false, message: 'Error fetching users' });
  }
});

// Get specific user
app.get('/api/user/:id', authenticateAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId) || userId <= 0) {
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
app.get('/api/stats', authenticateAdmin, async (req, res) => {
  try {
    const stats = await getStats();
    res.json({ success: true, stats });
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

// Update user status
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

// Cron job endpoint
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

// Test endpoints

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

// Health check endpoint
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

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  
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
  
  server.close(() => {
    console.log('HTTP server closed');
  });
  
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
  
  await initializeApp();
  
  console.log('🎯 Ready to help leaders achieve their goals!');
});

// Graceful shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

module.exports = app;