const { Pool } = require('pg');

// Enhanced PostgreSQL connection with connection pooling
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Connection pool configuration
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
  maxUses: 7500, // Close (and replace) a connection after it has been used 7500 times
});

// Enhanced error handling for the pool
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Initialize database with comprehensive error handling
const initDatabase = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🐘 Initializing PostgreSQL database...');
    
    // Create users table with enhanced schema
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        timezone VARCHAR(100) NOT NULL,
        goals TEXT NOT NULL,
        signup_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        current_week INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        last_email_sent TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create email history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        week_number INTEGER NOT NULL,
        subject TEXT,
        content TEXT,
        action_item TEXT,
        sent_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        delivery_status VARCHAR(50) DEFAULT 'sent',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
      CREATE INDEX IF NOT EXISTS idx_users_week ON users(current_week);
      CREATE INDEX IF NOT EXISTS idx_email_history_user ON email_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_email_history_week ON email_history(week_number);
      CREATE INDEX IF NOT EXISTS idx_users_signup_date ON users(signup_date);
      CREATE INDEX IF NOT EXISTS idx_email_history_sent_date ON email_history(sent_date);
    `);
    
    // Create trigger for updated_at timestamp
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
    
    console.log('✅ PostgreSQL database initialized successfully');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Enhanced user creation with validation
const createUser = async (email, timezone, goals) => {
  const client = await pool.connect();
  
  try {
    // Validate inputs
    if (!email || !timezone || !goals) {
      throw new Error('Email, timezone, and goals are required');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }
    
    if (goals.length < 20) {
      throw new Error('Goals must be at least 20 characters long');
    }
    
    const result = await client.query(
      'INSERT INTO users (email, timezone, goals) VALUES ($1, $2, $3) RETURNING id',
      [email.toLowerCase().trim(), timezone.trim(), goals.trim()]
    );
    
    const userId = result.rows[0].id;
    console.log(`✅ User created successfully: ID ${userId}, Email: ${email}`);
    
    return userId;
  } catch (error) {
    if (error.code === '23505') { // Unique constraint violation
      throw new Error('Email already exists');
    }
    console.error('Error creating user:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get all users with pagination
const getAllUsers = async (limit = 50, offset = 0) => {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT 
        id, email, timezone, goals, signup_date, current_week, 
        is_active, last_email_sent, created_at, updated_at
      FROM users 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    return result.rows;
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get active users for email processing
const getActiveUsers = async () => {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT 
        id, email, timezone, goals, current_week, last_email_sent, is_active
      FROM users 
      WHERE is_active = TRUE AND current_week < 12
      ORDER BY last_email_sent ASC NULLS FIRST
    `);
    
    return result.rows;
  } catch (error) {
    console.error('Error getting active users:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get specific user by ID
const getUserById = async (userId) => {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error getting user by ID:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Update user's current week and last email sent
const updateUserWeek = async (userId, weekNumber, actionItem) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Update user's current week and last email sent
    await client.query(
      'UPDATE users SET current_week = $1, last_email_sent = CURRENT_TIMESTAMP WHERE id = $2',
      [weekNumber, userId]
    );
    
    // Log email history
    await client.query(
      'INSERT INTO email_history (user_id, week_number, action_item) VALUES ($1, $2, $3)',
      [userId, weekNumber, actionItem]
    );
    
    await client.query('COMMIT');
    console.log(`✅ User ${userId} updated to week ${weekNumber}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating user week:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get comprehensive app statistics
const getStats = async () => {
  const client = await pool.connect();
  
  try {
    const [usersResult, emailsResult, recentResult] = await Promise.all([
      client.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_users,
          COUNT(CASE WHEN current_week >= 12 THEN 1 END) as completed_users
        FROM users
      `),
      client.query('SELECT COUNT(*) as total_emails FROM email_history'),
      client.query(`
        SELECT COUNT(*) as recent_signups 
        FROM users 
        WHERE signup_date >= CURRENT_DATE - INTERVAL '7 days'
      `)
    ]);
    
    return {
      totalUsers: parseInt(usersResult.rows[0].total_users),
      activeUsers: parseInt(usersResult.rows[0].active_users),
      completedUsers: parseInt(usersResult.rows[0].completed_users),
      totalEmails: parseInt(emailsResult.rows[0].total_emails),
      recentSignups: parseInt(recentResult.rows[0].recent_signups)
    };
  } catch (error) {
    console.error('Error getting stats:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get email history for a user
const getEmailHistory = async (userId, limit = 10) => {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT 
        week_number, subject, action_item, sent_date, delivery_status
      FROM email_history 
      WHERE user_id = $1 
      ORDER BY sent_date DESC 
      LIMIT $2
    `, [userId, limit]);
    
    return result.rows;
  } catch (error) {
    console.error('Error getting email history:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Log email history
const logEmailHistory = async (userId, weekNumber, actionItem, subject, content) => {
  const client = await pool.connect();
  
  try {
    await client.query(`
      INSERT INTO email_history (user_id, week_number, action_item, subject, content)
      VALUES ($1, $2, $3, $4, $5)
    `, [userId, weekNumber, actionItem, subject, content]);
  } catch (error) {
    console.error('Error logging email history:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Update user status (active/inactive)
const updateUserStatus = async (userId, isActive) => {
  const client = await pool.connect();
  
  try {
    await client.query(
      'UPDATE users SET is_active = $1 WHERE id = $2',
      [isActive, userId]
    );
    console.log(`✅ User ${userId} status updated to ${isActive ? 'active' : 'inactive'}`);
  } catch (error) {
    console.error('Error updating user status:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Reset user progress
const resetUserProgress = async (userId) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Reset user's progress
    await client.query(
      'UPDATE users SET current_week = 0, last_email_sent = NULL WHERE id = $1',
      [userId]
    );
    
    // Optionally clear email history (uncomment if needed)
    // await client.query('DELETE FROM email_history WHERE user_id = $1', [userId]);
    
    await client.query('COMMIT');
    console.log(`✅ User ${userId} progress reset`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error resetting user progress:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get users needing emails soon
const getUsersNeedingEmails = async () => {
  const client = await pool.connect();
  
  try {
    const result = await client.query(`
      SELECT 
        id, email, current_week, last_email_sent, timezone,
        CASE 
          WHEN last_email_sent IS NULL THEN 'Needs welcome email'
          WHEN last_email_sent < CURRENT_TIMESTAMP - INTERVAL '6 days' THEN 'Due for weekly email'
          ELSE 'Up to date'
        END as next_email_due
      FROM users 
      WHERE is_active = TRUE AND current_week < 12
      ORDER BY last_email_sent ASC NULLS FIRST
      LIMIT 20
    `);
    
    return result.rows;
  } catch (error) {
    console.error('Error getting users needing emails:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Update email status
const updateEmailStatus = async (userId, weekNumber, status) => {
  const client = await pool.connect();
  
  try {
    await client.query(`
      UPDATE email_history 
      SET delivery_status = $1 
      WHERE user_id = $2 AND week_number = $3
    `, [status, userId, weekNumber]);
  } catch (error) {
    console.error('Error updating email status:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    client.release();
    
    console.log('✅ PostgreSQL connection successful');
    console.log(`🕐 Current time: ${result.rows[0].current_time}`);
    console.log(`🐘 PostgreSQL version: ${result.rows[0].pg_version.split(' ')[0]}`);
    
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error);
    return false;
  }
};

// Health check
const healthCheck = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'PostgreSQL',
      poolSize: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingClients: pool.waitingCount
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

// Close database connections
const closeDatabase = async () => {
  try {
    await pool.end();
    console.log('✅ PostgreSQL connections closed');
  } catch (error) {
    console.error('Error closing database:', error);
  }
};

// Export all functions
module.exports = {
  initDatabase,
  createUser,
  getAllUsers,
  getActiveUsers,
  getUserById,
  updateUserWeek,
  getStats,
  getEmailHistory,
  logEmailHistory,
  updateUserStatus,
  resetUserProgress,
  getUsersNeedingEmails,
  updateEmailStatus,
  testConnection,
  healthCheck,
  closeDatabase
};