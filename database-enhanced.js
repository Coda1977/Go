const { Pool } = require('pg');
const path = require('path');

// Database connection pool with optimized configuration
let pool;

// Initialize database connection pool with best practices
const initializeDb = () => {
  try {
    // Get connection string from environment
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Optimized pool configuration based on PostgreSQL best practices
    pool = new Pool({
      connectionString: connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 20, // Maximum number of clients in the pool
      min: 5,  // Minimum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
      acquireTimeoutMillis: 60000, // Return an error after 60 seconds if unable to acquire a connection
      statement_timeout: 30000, // Terminate any statement that takes more than 30 seconds
      query_timeout: 30000, // Query timeout
      application_name: 'go_leadership_app', // Application name for monitoring
    });

    // Enhanced pool error handling
    pool.on('error', (err, client) => {
      console.error('Unexpected error on idle PostgreSQL client:', err);
      // Don't exit the process, just log the error
    });

    pool.on('connect', (client) => {
      console.log('New PostgreSQL client connected');
      // Set session-level configurations
      client.query('SET search_path TO public');
    });

    pool.on('remove', (client) => {
      console.log('PostgreSQL client removed from pool');
    });

    console.log('PostgreSQL connection pool initialized successfully');
    return pool;
  } catch (error) {
    console.error('Database connection pool initialization failed:', error);
    throw error;
  }
};

// Get database client from pool with automatic retry
const getClient = async (retries = 3) => {
  if (!pool) {
    initializeDb();
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await pool.connect();
      return client;
    } catch (error) {
      console.error(`Database connection attempt ${attempt} failed:`, error);
      
      if (attempt === retries) {
        throw new Error(`Failed to acquire database connection after ${retries} attempts: ${error.message}`);
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Execute query with automatic retry and proper error handling
const executeQuery = async (query, params = [], retries = 2) => {
  let client;
  
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      client = await getClient();
      const result = await client.query(query, params);
      return result;
    } catch (error) {
      // Log the error with context
      console.error('Query execution error:', {
        query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        params: params,
        attempt: attempt,
        error: error.message
      });

      // Check if it's a retryable error
      const isRetryable = error.code === 'ECONNRESET' || 
                         error.code === 'ENOTFOUND' || 
                         error.code === 'ETIMEDOUT' ||
                         error.message.includes('connection');

      if (attempt <= retries && isRetryable) {
        console.log(`Retrying query attempt ${attempt + 1}/${retries + 1}`);
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }
};

// Initialize database tables with enhanced schema
const initDatabase = async () => {
  try {
    await executeQuery('BEGIN');

    // Users table with enhanced constraints and indexes
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });

    console.log('PostgreSQL pool initialized successfully');
    return pool;
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
};

// Get database client from pool
const getClient = async () => {
  if (!pool) {
    initializeDb();
  }
  return await pool.connect();
};

// Initialize database tables
const initDatabase = async () => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');

    // Users table
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
    
    // Email history table
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

    // Create trigger to update updated_at column
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $ language 'plpgsql';
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query('COMMIT');
    console.log('Database initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get all active users
const getActiveUsers = async () => {
  const client = await getClient();
  
  try {
    const result = await client.query(`
      SELECT * FROM users 
      WHERE is_active = TRUE AND current_week < 12
      ORDER BY signup_date ASC
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
  const client = await getClient();
  
  try {
    const result = await client.query(`
      SELECT * FROM users WHERE id = $1
    `, [userId]);
    return result.rows[0];
  } catch (error) {
    console.error('Error getting user by ID:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get user by email
const getUserByEmail = async (email) => {
  const client = await getClient();
  
  try {
    const result = await client.query(`
      SELECT * FROM users WHERE email = $1
    `, [email]);
    return result.rows[0];
  } catch (error) {
    console.error('Error getting user by email:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Create new user
const createUser = async (email, timezone, goals) => {
  const client = await getClient();
  
  try {
    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      throw new Error('UNIQUE constraint failed: users.email');
    }
    
    const result = await client.query(`
      INSERT INTO users (email, timezone, goals, signup_date, current_week, is_active)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 0, TRUE)
      RETURNING id
    `, [email, timezone, goals]);
    
    const userId = result.rows[0].id;
    console.log(`User created with ID: ${userId}`);
    return userId;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Update user's current week and last email sent date
const updateUserWeek = async (userId, newWeek, actionItem) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Update user
    const result = await client.query(`
      UPDATE users 
      SET current_week = $1, last_email_sent = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [newWeek, userId]);
    
    // Log email history
    const defaultSubject = `Week ${newWeek}: Keep the momentum going!`;
    await client.query(`
      INSERT INTO email_history (user_id, week_number, subject, content, action_item, sent_date, delivery_status)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, 'sent')
    `, [userId, newWeek, defaultSubject, '', actionItem || '']);
    
    await client.query('COMMIT');
    return result.rowCount;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating user week:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Log email to history
const logEmailHistory = async (userId, weekNumber, actionItem, subject = null, content = null) => {
  const client = await getClient();
  
  try {
    const defaultSubject = `Week ${weekNumber}: Keep the momentum going!`;
    const result = await client.query(`
      INSERT INTO email_history (user_id, week_number, subject, content, action_item, sent_date, delivery_status)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, 'sent')
      RETURNING id
    `, [userId, weekNumber, subject || defaultSubject, content || '', actionItem || '']);
    
    return result.rows[0].id;
  } catch (error) {
    console.error('Error logging email history:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get email history for a user
const getEmailHistory = async (userId) => {
  const client = await getClient();
  
  try {
    const result = await client.query(`
      SELECT * FROM email_history 
      WHERE user_id = $1
      ORDER BY sent_date DESC
    `, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error getting email history:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get all users for admin dashboard
const getAllUsers = async () => {
  const client = await getClient();
  
  try {
    const result = await client.query(`
      SELECT 
        u.*,
        COUNT(e.id) as email_count,
        MAX(e.sent_date) as last_email_date
      FROM users u
      LEFT JOIN email_history e ON u.id = e.user_id
      GROUP BY u.id
      ORDER BY u.signup_date DESC
    `);
    return result.rows;
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Update user's active status
const updateUserStatus = async (userId, isActive) => {
  const client = await getClient();
  
  try {
    const result = await client.query(`
      UPDATE users SET is_active = $1 WHERE id = $2
    `, [isActive, userId]);
    return result.rowCount;
  } catch (error) {
    console.error('Error updating user status:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get statistics for admin dashboard
const getStats = async () => {
  const client = await getClient();
  
  try {
    const queries = [
      { name: 'totalUsers', query: 'SELECT COUNT(*) as count FROM users' },
      { name: 'activeUsers', query: 'SELECT COUNT(*) as count FROM users WHERE is_active = TRUE' },
      { name: 'completedUsers', query: 'SELECT COUNT(*) as count FROM users WHERE current_week >= 12' },
      { name: 'totalEmails', query: 'SELECT COUNT(*) as count FROM email_history' },
      { name: 'recentSignups', query: 'SELECT COUNT(*) as count FROM users WHERE signup_date >= CURRENT_DATE - INTERVAL \'7 days\'' }
    ];
    
    const stats = {};
    
    for (const { name, query } of queries) {
      const result = await client.query(query);
      stats[name] = parseInt(result.rows[0].count);
    }
    
    return stats;
  } catch (error) {
    console.error('Error getting stats:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Update email delivery status
const updateEmailStatus = async (userId, weekNumber, status) => {
  const client = await getClient();
  
  try {
    const result = await client.query(`
      UPDATE email_history 
      SET delivery_status = $1
      WHERE user_id = $2 AND week_number = $3
      AND id = (
        SELECT id FROM email_history 
        WHERE user_id = $2 AND week_number = $3
        ORDER BY sent_date DESC 
        LIMIT 1
      )
    `, [status, userId, weekNumber]);
    
    return result.rowCount;
  } catch (error) {
    console.error('Error updating email status:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Reset user's progress (for testing/admin)
const resetUserProgress = async (userId) => {
  const client = await getClient();
  
  try {
    const result = await client.query(`
      UPDATE users 
      SET current_week = 0, last_email_sent = NULL
      WHERE id = $1
    `, [userId]);
    return result.rowCount;
  } catch (error) {
    console.error('Error resetting user progress:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get users who need emails soon (for admin monitoring)
const getUsersNeedingEmails = async () => {
  const client = await getClient();
  
  try {
    const result = await client.query(`
      SELECT 
        u.*,
        CASE 
          WHEN u.last_email_sent IS NULL THEN 'Never sent'
          ELSE (u.last_email_sent + INTERVAL '7 days')::text
        END as next_email_due
      FROM users u
      WHERE u.is_active = TRUE AND u.current_week < 12
      ORDER BY 
        CASE 
          WHEN u.last_email_sent IS NULL THEN '1900-01-01'::timestamp
          ELSE u.last_email_sent
        END ASC
    `);
    return result.rows;
  } catch (error) {
    console.error('Error getting users needing emails:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Close database connection pool
const closeDatabase = async () => {
  try {
    if (pool) {
      await pool.end();
      console.log('Database pool closed');
    }
  } catch (error) {
    console.error('Error closing database pool:', error);
    throw error;
  }
};

// Test database connection
const testConnection = async () => {
  const client = await getClient();
  
  try {
    const result = await client.query('SELECT NOW()');
    console.log('Database connection test successful:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  } finally {
    client.release();
  }
};

// Graceful shutdown
process.on('exit', async () => {
  await closeDatabase();
});

process.on('SIGINT', async () => {
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeDatabase();
  process.exit(0);
});

// Export all functions
module.exports = {
  initDatabase,
  getActiveUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUserWeek,
  logEmailHistory,
  getEmailHistory,
  getAllUsers,
  updateUserStatus,
  getStats,
  updateEmailStatus,
  resetUserProgress,
  getUsersNeedingEmails,
  closeDatabase,
  testConnection
};

// Initialize database tables
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    try {
      if (!db) {
        initializeDb();
      }

      // Users table
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          timezone TEXT NOT NULL,
          goals TEXT NOT NULL,
          signup_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          current_week INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT 1,
          last_email_sent DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Email history table
      db.exec(`
        CREATE TABLE IF NOT EXISTS email_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          week_number INTEGER NOT NULL,
          subject TEXT,
          content TEXT,
          action_item TEXT,
          sent_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          delivery_status TEXT DEFAULT 'sent',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Create indexes for better performance
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
        CREATE INDEX IF NOT EXISTS idx_users_week ON users(current_week);
        CREATE INDEX IF NOT EXISTS idx_email_history_user ON email_history(user_id);
        CREATE INDEX IF NOT EXISTS idx_email_history_week ON email_history(week_number);
      `);
      
      console.log('Database initialized successfully');
      resolve();
    } catch (error) {
      console.error('Error initializing database:', error);
      reject(error);
    }
  });
};

// Prepared statements for better performance
const statements = {
  getActiveUsers: null,
  getUserById: null,
  getUserByEmail: null,
  createUser: null,
  updateUserWeek: null,
  logEmailHistory: null,
  getEmailHistory: null,
  getAllUsers: null,
  updateUserStatus: null,
  resetUserProgress: null,
  getUsersNeedingEmails: null
};

// Initialize prepared statements
const initStatements = () => {
  if (!db) initializeDb();

  statements.getActiveUsers = db.prepare(`
    SELECT * FROM users 
    WHERE is_active = 1 AND current_week < 12
    ORDER BY signup_date ASC
  `);

  statements.getUserById = db.prepare(`
    SELECT * FROM users WHERE id = ?
  `);

  statements.getUserByEmail = db.prepare(`
    SELECT * FROM users WHERE email = ?
  `);

  statements.createUser = db.prepare(`
    INSERT INTO users (email, timezone, goals, signup_date, current_week, is_active)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, 0, 1)
  `);

  statements.updateUserWeek = db.prepare(`
    UPDATE users 
    SET current_week = ?, last_email_sent = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  statements.logEmailHistory = db.prepare(`
    INSERT INTO email_history (user_id, week_number, subject, content, action_item, sent_date, delivery_status)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'sent')
  `);

  statements.getEmailHistory = db.prepare(`
    SELECT * FROM email_history 
    WHERE user_id = ?
    ORDER BY sent_date DESC
  `);

  statements.getAllUsers = db.prepare(`
    SELECT 
      u.*,
      COUNT(e.id) as email_count,
      MAX(e.sent_date) as last_email_date
    FROM users u
    LEFT JOIN email_history e ON u.id = e.user_id
    GROUP BY u.id
    ORDER BY u.signup_date DESC
  `);

  statements.updateUserStatus = db.prepare(`
    UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `);

  statements.resetUserProgress = db.prepare(`
    UPDATE users 
    SET current_week = 0, last_email_sent = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  statements.getUsersNeedingEmails = db.prepare(`
    SELECT 
      u.*,
      CASE 
        WHEN u.last_email_sent IS NULL THEN 'Never sent'
        ELSE datetime(u.last_email_sent, '+7 days')
      END as next_email_due
    FROM users u
    WHERE u.is_active = 1 AND u.current_week < 12
    ORDER BY 
      CASE 
        WHEN u.last_email_sent IS NULL THEN '1900-01-01'
        ELSE u.last_email_sent
      END ASC
  `);
};

// Get all active users
const getActiveUsers = () => {
  try {
    if (!statements.getActiveUsers) initStatements();
    return statements.getActiveUsers.all();
  } catch (error) {
    console.error('Error getting active users:', error);
    throw error;
  }
};

// Get specific user by ID
const getUserById = (userId) => {
  try {
    if (!statements.getUserById) initStatements();
    return statements.getUserById.get(userId);
  } catch (error) {
    console.error('Error getting user by ID:', error);
    throw error;
  }
};

// Get user by email
const getUserByEmail = (email) => {
  try {
    if (!statements.getUserByEmail) initStatements();
    return statements.getUserByEmail.get(email);
  } catch (error) {
    console.error('Error getting user by email:', error);
    throw error;
  }
};

// Create new user
const createUser = (email, timezone, goals) => {
  try {
    if (!statements.createUser) initStatements();
    
    // Check if user already exists
    const existingUser = getUserByEmail(email);
    if (existingUser) {
      throw new Error('UNIQUE constraint failed: users.email');
    }
    
    const result = statements.createUser.run(email, timezone, goals);
    console.log(`User created with ID: ${result.lastInsertRowid}`);
    return result.lastInsertRowid;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

// Update user's current week and last email sent date
const updateUserWeek = (userId, newWeek, actionItem) => {
  try {
    if (!statements.updateUserWeek || !statements.logEmailHistory) initStatements();
    
    const transaction = db.transaction(() => {
      // Update user
      const result = statements.updateUserWeek.run(newWeek, userId);
      
      // Log email history
      const defaultSubject = `Week ${newWeek}: Keep the momentum going!`;
      statements.logEmailHistory.run(userId, newWeek, defaultSubject, '', actionItem || '');
      
      return result.changes;
    });
    
    return transaction();
  } catch (error) {
    console.error('Error updating user week:', error);
    throw error;
  }
};

// Log email to history
const logEmailHistory = (userId, weekNumber, actionItem, subject = null, content = null) => {
  try {
    if (!statements.logEmailHistory) initStatements();
    
    const defaultSubject = `Week ${weekNumber}: Keep the momentum going!`;
    const result = statements.logEmailHistory.run(
      userId, 
      weekNumber, 
      subject || defaultSubject, 
      content || '', 
      actionItem || ''
    );
    
    return result.lastInsertRowid;
  } catch (error) {
    console.error('Error logging email history:', error);
    throw error;
  }
};

// Get email history for a user
const getEmailHistory = (userId) => {
  try {
    if (!statements.getEmailHistory) initStatements();
    return statements.getEmailHistory.all(userId);
  } catch (error) {
    console.error('Error getting email history:', error);
    throw error;
  }
};

// Get all users for admin dashboard
const getAllUsers = () => {
  try {
    if (!statements.getAllUsers) initStatements();
    return statements.getAllUsers.all();
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  }
};

// Update user's active status
const updateUserStatus = (userId, isActive) => {
  try {
    if (!statements.updateUserStatus) initStatements();
    const result = statements.updateUserStatus.run(isActive ? 1 : 0, userId);
    return result.changes;
  } catch (error) {
    console.error('Error updating user status:', error);
    throw error;
  }
};

// Get statistics for admin dashboard
const getStats = () => {
  try {
    if (!db) initializeDb();
    
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const activeUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get().count;
    const completedUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE current_week >= 12').get().count;
    const totalEmails = db.prepare('SELECT COUNT(*) as count FROM email_history').get().count;
    const recentSignups = db.prepare('SELECT COUNT(*) as count FROM users WHERE date(signup_date) >= date(\'now\', \'-7 days\')').get().count;
    
    return {
      totalUsers,
      activeUsers,
      completedUsers,
      totalEmails,
      recentSignups
    };
  } catch (error) {
    console.error('Error getting stats:', error);
    throw error;
  }
};

// Update email delivery status
const updateEmailStatus = (userId, weekNumber, status) => {
  try {
    if (!db) initializeDb();
    
    const stmt = db.prepare(`
      UPDATE email_history 
      SET delivery_status = ?
      WHERE user_id = ? AND week_number = ?
      ORDER BY sent_date DESC
      LIMIT 1
    `);
    
    const result = stmt.run(status, userId, weekNumber);
    return result.changes;
  } catch (error) {
    console.error('Error updating email status:', error);
    throw error;
  }
};

// Reset user's progress (for testing/admin)
const resetUserProgress = (userId) => {
  try {
    if (!statements.resetUserProgress) initStatements();
    const result = statements.resetUserProgress.run(userId);
    return result.changes;
  } catch (error) {
    console.error('Error resetting user progress:', error);
    throw error;
  }
};

// Get users who need emails soon (for admin monitoring)
const getUsersNeedingEmails = () => {
  try {
    if (!statements.getUsersNeedingEmails) initStatements();
    return statements.getUsersNeedingEmails.all();
  } catch (error) {
    console.error('Error getting users needing emails:', error);
    throw error;
  }
};

// Close database connection
const closeDatabase = () => {
  try {
    if (db) {
      db.close();
      console.log('Database connection closed');
    }
  } catch (error) {
    console.error('Error closing database:', error);
    throw error;
  }
};

// Graceful shutdown
process.on('exit', () => {
  closeDatabase();
});

process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDatabase();
  process.exit(0);
});

// Export all functions
module.exports = {
  initDatabase,
  getActiveUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUserWeek,
  logEmailHistory,
  getEmailHistory,
  getAllUsers,
  updateUserStatus,
  getStats,
  updateEmailStatus,
  resetUserProgress,
  getUsersNeedingEmails,
  closeDatabase
};

// Initialize database tables
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        timezone TEXT NOT NULL,
        goals TEXT NOT NULL,
        signup_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        current_week INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        last_email_sent DATETIME
      )
    `, (err) => {
      if (err) {
        console.error('Error creating users table:', err);
        reject(err);
        return;
      }
      
      // Email history table
      db.run(`
        CREATE TABLE IF NOT EXISTS email_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          week_number INTEGER,
          subject TEXT,
          content TEXT,
          action_item TEXT,
          sent_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          delivery_status TEXT DEFAULT 'sent',
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating email_history table:', err);
          reject(err);
          return;
        }
        
        console.log('Database initialized successfully');
        resolve();
      });
    });
  });
};

// Get all active users
const getActiveUsers = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT * FROM users 
      WHERE is_active = 1 AND current_week < 12
      ORDER BY signup_date ASC
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('Error getting active users:', err);
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
};

// Get specific user by ID
const getUserById = (userId) => {
  return new Promise((resolve, reject) => {
    const query = `SELECT * FROM users WHERE id = ?`;
    
    db.get(query, [userId], (err, row) => {
      if (err) {
        console.error('Error getting user by ID:', err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

// Get user by email
const getUserByEmail = (email) => {
  return new Promise((resolve, reject) => {
    const query = `SELECT * FROM users WHERE email = ?`;
    
    db.get(query, [email], (err, row) => {
      if (err) {
        console.error('Error getting user by email:', err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

// Create new user
const createUser = (email, timezone, goals) => {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO users (email, timezone, goals, signup_date, current_week, is_active)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, 0, 1)
    `;
    
    db.run(query, [email, timezone, goals], function(err) {
      if (err) {
        console.error('Error creating user:', err);
        reject(err);
      } else {
        console.log(`User created with ID: ${this.lastID}`);
        resolve(this.lastID);
      }
    });
  });
};

// Update user's current week and last email sent date
const updateUserWeek = (userId, newWeek, actionItem) => {
  return new Promise((resolve, reject) => {
    const query = `
      UPDATE users 
      SET current_week = ?, last_email_sent = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    db.run(query, [newWeek, userId], function(err) {
      if (err) {
        console.error('Error updating user week:', err);
        reject(err);
      } else {
        // Also log the email in history
        logEmailHistory(userId, newWeek, actionItem)
          .then(() => resolve(this.changes))
          .catch(reject);
      }
    });
  });
};

// Log email to history
const logEmailHistory = (userId, weekNumber, actionItem, subject = null, content = null) => {
  return new Promise((resolve, reject) => {
    const defaultSubject = `Week ${weekNumber}: Keep the momentum going!`;
    
    const query = `
      INSERT INTO email_history (user_id, week_number, subject, content, action_item, sent_date, delivery_status)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'sent')
    `;
    
    db.run(query, [
      userId, 
      weekNumber, 
      subject || defaultSubject, 
      content || '', 
      actionItem || ''
    ], function(err) {
      if (err) {
        console.error('Error logging email history:', err);
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
  });
};

// Get email history for a user
const getEmailHistory = (userId) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT * FROM email_history 
      WHERE user_id = ?
      ORDER BY sent_date DESC
    `;
    
    db.all(query, [userId], (err, rows) => {
      if (err) {
        console.error('Error getting email history:', err);
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
};

// Get all users for admin dashboard
const getAllUsers = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        u.*,
        COUNT(e.id) as email_count,
        MAX(e.sent_date) as last_email_date
      FROM users u
      LEFT JOIN email_history e ON u.id = e.user_id
      GROUP BY u.id
      ORDER BY u.signup_date DESC
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('Error getting all users:', err);
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
};

// Update user's active status
const updateUserStatus = (userId, isActive) => {
  return new Promise((resolve, reject) => {
    const query = `UPDATE users SET is_active = ? WHERE id = ?`;
    
    db.run(query, [isActive ? 1 : 0, userId], function(err) {
      if (err) {
        console.error('Error updating user status:', err);
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
};

// Get statistics for admin dashboard
const getStats = () => {
  return new Promise((resolve, reject) => {
    const queries = {
      totalUsers: `SELECT COUNT(*) as count FROM users`,
      activeUsers: `SELECT COUNT(*) as count FROM users WHERE is_active = 1`,
      completedUsers: `SELECT COUNT(*) as count FROM users WHERE current_week >= 12`,
      totalEmails: `SELECT COUNT(*) as count FROM email_history`,
      recentSignups: `SELECT COUNT(*) as count FROM users WHERE date(signup_date) >= date('now', '-7 days')`
    };
    
    const stats = {};
    const promises = Object.keys(queries).map(key => {
      return new Promise((resolve, reject) => {
        db.get(queries[key], [], (err, row) => {
          if (err) {
            reject(err);
          } else {
            stats[key] = row.count;
            resolve();
          }
        });
      });
    });
    
    Promise.all(promises)
      .then(() => resolve(stats))
      .catch(reject);
  });
};

// Update email delivery status
const updateEmailStatus = (userId, weekNumber, status) => {
  return new Promise((resolve, reject) => {
    const query = `
      UPDATE email_history 
      SET delivery_status = ?
      WHERE user_id = ? AND week_number = ?
      ORDER BY sent_date DESC
      LIMIT 1
    `;
    
    db.run(query, [status, userId, weekNumber], function(err) {
      if (err) {
        console.error('Error updating email status:', err);
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
};

// Reset user's progress (for testing/admin)
const resetUserProgress = (userId) => {
  return new Promise((resolve, reject) => {
    const query = `
      UPDATE users 
      SET current_week = 0, last_email_sent = NULL
      WHERE id = ?
    `;
    
    db.run(query, [userId], function(err) {
      if (err) {
        console.error('Error resetting user progress:', err);
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
};

// Get users who need emails soon (for admin monitoring)
const getUsersNeedingEmails = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        u.*,
        CASE 
          WHEN u.last_email_sent IS NULL THEN 'Never sent'
          ELSE datetime(u.last_email_sent, '+7 days')
        END as next_email_due
      FROM users u
      WHERE u.is_active = 1 AND u.current_week < 12
      ORDER BY 
        CASE 
          WHEN u.last_email_sent IS NULL THEN '1900-01-01'
          ELSE u.last_email_sent
        END ASC
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('Error getting users needing emails:', err);
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
};

// Close database connection
const closeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
        reject(err);
      } else {
        console.log('Database connection closed');
        resolve();
      }
    });
  });
};

// Export all functions
module.exports = {
  initDatabase,
  getActiveUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUserWeek,
  logEmailHistory,
  getEmailHistory,
  getAllUsers,
  updateUserStatus,
  getStats,
  updateEmailStatus,
  resetUserProgress,
  getUsersNeedingEmails,
  closeDatabase
};),
        timezone VARCHAR(100) NOT NULL CHECK (LENGTH(timezone) >= 3),
        goals TEXT NOT NULL CHECK (LENGTH(goals) >= 20 AND LENGTH(goals) <= 2000),
        signup_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        current_week INTEGER DEFAULT 0 CHECK (current_week >= 0 AND current_week <= 12),
        is_active BOOLEAN DEFAULT TRUE,
        last_email_sent TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Email history table with enhanced constraints
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS email_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        week_number INTEGER NOT NULL CHECK (week_number >= 0 AND week_number <= 12),
        subject TEXT CHECK (LENGTH(subject) <= 255),
        content TEXT,
        action_item TEXT CHECK (LENGTH(action_item) <= 1000),
        sent_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        delivery_status VARCHAR(50) DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'failed', 'pending', 'delivered')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, week_number)
      )
    `);

    // Create optimized indexes for better performance
    await executeQuery(`
      CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
      CREATE INDEX IF NOT EXISTS idx_users_active_week ON users(is_active, current_week) WHERE is_active = TRUE;
      CREATE INDEX IF NOT EXISTS idx_users_signup_date ON users(signup_date);
      CREATE INDEX IF NOT EXISTS idx_users_last_email ON users(last_email_sent) WHERE last_email_sent IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_email_history_user_week ON email_history(user_id, week_number);
      CREATE INDEX IF NOT EXISTS idx_email_history_sent_date ON email_history(sent_date);
      CREATE INDEX IF NOT EXISTS idx_email_history_status ON email_history(delivery_status);
    `);

    // Create trigger function for automatic timestamp updates
    await executeQuery(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $ language 'plpgsql';
    `);

    // Create trigger for users table
    await executeQuery(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // Create function for safe email validation
    await executeQuery(`
      CREATE OR REPLACE FUNCTION is_valid_email(email_text TEXT)
      RETURNS BOOLEAN AS $
      BEGIN
        RETURN email_text ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });

    console.log('PostgreSQL pool initialized successfully');
    return pool;
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
};

// Get database client from pool
const getClient = async () => {
  if (!pool) {
    initializeDb();
  }
  return await pool.connect();
};

// Initialize database tables
const initDatabase = async () => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');

    // Users table
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
    
    // Email history table
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

    // Create trigger to update updated_at column
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $ language 'plpgsql';
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query('COMMIT');
    console.log('Database initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get all active users
const getActiveUsers = async () => {
  const client = await getClient();
  
  try {
    const result = await client.query(`
      SELECT * FROM users 
      WHERE is_active = TRUE AND current_week < 12
      ORDER BY signup_date ASC
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
  const client = await getClient();
  
  try {
    const result = await client.query(`
      SELECT * FROM users WHERE id = $1
    `, [userId]);
    return result.rows[0];
  } catch (error) {
    console.error('Error getting user by ID:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get user by email
const getUserByEmail = async (email) => {
  const client = await getClient();
  
  try {
    const result = await client.query(`
      SELECT * FROM users WHERE email = $1
    `, [email]);
    return result.rows[0];
  } catch (error) {
    console.error('Error getting user by email:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Create new user
const createUser = async (email, timezone, goals) => {
  const client = await getClient();
  
  try {
    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      throw new Error('UNIQUE constraint failed: users.email');
    }
    
    const result = await client.query(`
      INSERT INTO users (email, timezone, goals, signup_date, current_week, is_active)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 0, TRUE)
      RETURNING id
    `, [email, timezone, goals]);
    
    const userId = result.rows[0].id;
    console.log(`User created with ID: ${userId}`);
    return userId;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Update user's current week and last email sent date
const updateUserWeek = async (userId, newWeek, actionItem) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Update user
    const result = await client.query(`
      UPDATE users 
      SET current_week = $1, last_email_sent = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [newWeek, userId]);
    
    // Log email history
    const defaultSubject = `Week ${newWeek}: Keep the momentum going!`;
    await client.query(`
      INSERT INTO email_history (user_id, week_number, subject, content, action_item, sent_date, delivery_status)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, 'sent')
    `, [userId, newWeek, defaultSubject, '', actionItem || '']);
    
    await client.query('COMMIT');
    return result.rowCount;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating user week:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Log email to history
const logEmailHistory = async (userId, weekNumber, actionItem, subject = null, content = null) => {
  const client = await getClient();
  
  try {
    const defaultSubject = `Week ${weekNumber}: Keep the momentum going!`;
    const result = await client.query(`
      INSERT INTO email_history (user_id, week_number, subject, content, action_item, sent_date, delivery_status)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, 'sent')
      RETURNING id
    `, [userId, weekNumber, subject || defaultSubject, content || '', actionItem || '']);
    
    return result.rows[0].id;
  } catch (error) {
    console.error('Error logging email history:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get email history for a user
const getEmailHistory = async (userId) => {
  const client = await getClient();
  
  try {
    const result = await client.query(`
      SELECT * FROM email_history 
      WHERE user_id = $1
      ORDER BY sent_date DESC
    `, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error getting email history:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get all users for admin dashboard
const getAllUsers = async () => {
  const client = await getClient();
  
  try {
    const result = await client.query(`
      SELECT 
        u.*,
        COUNT(e.id) as email_count,
        MAX(e.sent_date) as last_email_date
      FROM users u
      LEFT JOIN email_history e ON u.id = e.user_id
      GROUP BY u.id
      ORDER BY u.signup_date DESC
    `);
    return result.rows;
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Update user's active status
const updateUserStatus = async (userId, isActive) => {
  const client = await getClient();
  
  try {
    const result = await client.query(`
      UPDATE users SET is_active = $1 WHERE id = $2
    `, [isActive, userId]);
    return result.rowCount;
  } catch (error) {
    console.error('Error updating user status:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get statistics for admin dashboard
const getStats = async () => {
  const client = await getClient();
  
  try {
    const queries = [
      { name: 'totalUsers', query: 'SELECT COUNT(*) as count FROM users' },
      { name: 'activeUsers', query: 'SELECT COUNT(*) as count FROM users WHERE is_active = TRUE' },
      { name: 'completedUsers', query: 'SELECT COUNT(*) as count FROM users WHERE current_week >= 12' },
      { name: 'totalEmails', query: 'SELECT COUNT(*) as count FROM email_history' },
      { name: 'recentSignups', query: 'SELECT COUNT(*) as count FROM users WHERE signup_date >= CURRENT_DATE - INTERVAL \'7 days\'' }
    ];
    
    const stats = {};
    
    for (const { name, query } of queries) {
      const result = await client.query(query);
      stats[name] = parseInt(result.rows[0].count);
    }
    
    return stats;
  } catch (error) {
    console.error('Error getting stats:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Update email delivery status
const updateEmailStatus = async (userId, weekNumber, status) => {
  const client = await getClient();
  
  try {
    const result = await client.query(`
      UPDATE email_history 
      SET delivery_status = $1
      WHERE user_id = $2 AND week_number = $3
      AND id = (
        SELECT id FROM email_history 
        WHERE user_id = $2 AND week_number = $3
        ORDER BY sent_date DESC 
        LIMIT 1
      )
    `, [status, userId, weekNumber]);
    
    return result.rowCount;
  } catch (error) {
    console.error('Error updating email status:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Reset user's progress (for testing/admin)
const resetUserProgress = async (userId) => {
  const client = await getClient();
  
  try {
    const result = await client.query(`
      UPDATE users 
      SET current_week = 0, last_email_sent = NULL
      WHERE id = $1
    `, [userId]);
    return result.rowCount;
  } catch (error) {
    console.error('Error resetting user progress:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get users who need emails soon (for admin monitoring)
const getUsersNeedingEmails = async () => {
  const client = await getClient();
  
  try {
    const result = await client.query(`
      SELECT 
        u.*,
        CASE 
          WHEN u.last_email_sent IS NULL THEN 'Never sent'
          ELSE (u.last_email_sent + INTERVAL '7 days')::text
        END as next_email_due
      FROM users u
      WHERE u.is_active = TRUE AND u.current_week < 12
      ORDER BY 
        CASE 
          WHEN u.last_email_sent IS NULL THEN '1900-01-01'::timestamp
          ELSE u.last_email_sent
        END ASC
    `);
    return result.rows;
  } catch (error) {
    console.error('Error getting users needing emails:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Close database connection pool
const closeDatabase = async () => {
  try {
    if (pool) {
      await pool.end();
      console.log('Database pool closed');
    }
  } catch (error) {
    console.error('Error closing database pool:', error);
    throw error;
  }
};

// Test database connection
const testConnection = async () => {
  const client = await getClient();
  
  try {
    const result = await client.query('SELECT NOW()');
    console.log('Database connection test successful:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  } finally {
    client.release();
  }
};

// Graceful shutdown
process.on('exit', async () => {
  await closeDatabase();
});

process.on('SIGINT', async () => {
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeDatabase();
  process.exit(0);
});

// Export all functions
module.exports = {
  initDatabase,
  getActiveUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUserWeek,
  logEmailHistory,
  getEmailHistory,
  getAllUsers,
  updateUserStatus,
  getStats,
  updateEmailStatus,
  resetUserProgress,
  getUsersNeedingEmails,
  closeDatabase,
  testConnection
};

// Initialize database tables
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    try {
      if (!db) {
        initializeDb();
      }

      // Users table
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          timezone TEXT NOT NULL,
          goals TEXT NOT NULL,
          signup_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          current_week INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT 1,
          last_email_sent DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Email history table
      db.exec(`
        CREATE TABLE IF NOT EXISTS email_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          week_number INTEGER NOT NULL,
          subject TEXT,
          content TEXT,
          action_item TEXT,
          sent_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          delivery_status TEXT DEFAULT 'sent',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Create indexes for better performance
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
        CREATE INDEX IF NOT EXISTS idx_users_week ON users(current_week);
        CREATE INDEX IF NOT EXISTS idx_email_history_user ON email_history(user_id);
        CREATE INDEX IF NOT EXISTS idx_email_history_week ON email_history(week_number);
      `);
      
      console.log('Database initialized successfully');
      resolve();
    } catch (error) {
      console.error('Error initializing database:', error);
      reject(error);
    }
  });
};

// Prepared statements for better performance
const statements = {
  getActiveUsers: null,
  getUserById: null,
  getUserByEmail: null,
  createUser: null,
  updateUserWeek: null,
  logEmailHistory: null,
  getEmailHistory: null,
  getAllUsers: null,
  updateUserStatus: null,
  resetUserProgress: null,
  getUsersNeedingEmails: null
};

// Initialize prepared statements
const initStatements = () => {
  if (!db) initializeDb();

  statements.getActiveUsers = db.prepare(`
    SELECT * FROM users 
    WHERE is_active = 1 AND current_week < 12
    ORDER BY signup_date ASC
  `);

  statements.getUserById = db.prepare(`
    SELECT * FROM users WHERE id = ?
  `);

  statements.getUserByEmail = db.prepare(`
    SELECT * FROM users WHERE email = ?
  `);

  statements.createUser = db.prepare(`
    INSERT INTO users (email, timezone, goals, signup_date, current_week, is_active)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, 0, 1)
  `);

  statements.updateUserWeek = db.prepare(`
    UPDATE users 
    SET current_week = ?, last_email_sent = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  statements.logEmailHistory = db.prepare(`
    INSERT INTO email_history (user_id, week_number, subject, content, action_item, sent_date, delivery_status)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'sent')
  `);

  statements.getEmailHistory = db.prepare(`
    SELECT * FROM email_history 
    WHERE user_id = ?
    ORDER BY sent_date DESC
  `);

  statements.getAllUsers = db.prepare(`
    SELECT 
      u.*,
      COUNT(e.id) as email_count,
      MAX(e.sent_date) as last_email_date
    FROM users u
    LEFT JOIN email_history e ON u.id = e.user_id
    GROUP BY u.id
    ORDER BY u.signup_date DESC
  `);

  statements.updateUserStatus = db.prepare(`
    UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `);

  statements.resetUserProgress = db.prepare(`
    UPDATE users 
    SET current_week = 0, last_email_sent = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  statements.getUsersNeedingEmails = db.prepare(`
    SELECT 
      u.*,
      CASE 
        WHEN u.last_email_sent IS NULL THEN 'Never sent'
        ELSE datetime(u.last_email_sent, '+7 days')
      END as next_email_due
    FROM users u
    WHERE u.is_active = 1 AND u.current_week < 12
    ORDER BY 
      CASE 
        WHEN u.last_email_sent IS NULL THEN '1900-01-01'
        ELSE u.last_email_sent
      END ASC
  `);
};

// Get all active users
const getActiveUsers = () => {
  try {
    if (!statements.getActiveUsers) initStatements();
    return statements.getActiveUsers.all();
  } catch (error) {
    console.error('Error getting active users:', error);
    throw error;
  }
};

// Get specific user by ID
const getUserById = (userId) => {
  try {
    if (!statements.getUserById) initStatements();
    return statements.getUserById.get(userId);
  } catch (error) {
    console.error('Error getting user by ID:', error);
    throw error;
  }
};

// Get user by email
const getUserByEmail = (email) => {
  try {
    if (!statements.getUserByEmail) initStatements();
    return statements.getUserByEmail.get(email);
  } catch (error) {
    console.error('Error getting user by email:', error);
    throw error;
  }
};

// Create new user
const createUser = (email, timezone, goals) => {
  try {
    if (!statements.createUser) initStatements();
    
    // Check if user already exists
    const existingUser = getUserByEmail(email);
    if (existingUser) {
      throw new Error('UNIQUE constraint failed: users.email');
    }
    
    const result = statements.createUser.run(email, timezone, goals);
    console.log(`User created with ID: ${result.lastInsertRowid}`);
    return result.lastInsertRowid;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

// Update user's current week and last email sent date
const updateUserWeek = (userId, newWeek, actionItem) => {
  try {
    if (!statements.updateUserWeek || !statements.logEmailHistory) initStatements();
    
    const transaction = db.transaction(() => {
      // Update user
      const result = statements.updateUserWeek.run(newWeek, userId);
      
      // Log email history
      const defaultSubject = `Week ${newWeek}: Keep the momentum going!`;
      statements.logEmailHistory.run(userId, newWeek, defaultSubject, '', actionItem || '');
      
      return result.changes;
    });
    
    return transaction();
  } catch (error) {
    console.error('Error updating user week:', error);
    throw error;
  }
};

// Log email to history
const logEmailHistory = (userId, weekNumber, actionItem, subject = null, content = null) => {
  try {
    if (!statements.logEmailHistory) initStatements();
    
    const defaultSubject = `Week ${weekNumber}: Keep the momentum going!`;
    const result = statements.logEmailHistory.run(
      userId, 
      weekNumber, 
      subject || defaultSubject, 
      content || '', 
      actionItem || ''
    );
    
    return result.lastInsertRowid;
  } catch (error) {
    console.error('Error logging email history:', error);
    throw error;
  }
};

// Get email history for a user
const getEmailHistory = (userId) => {
  try {
    if (!statements.getEmailHistory) initStatements();
    return statements.getEmailHistory.all(userId);
  } catch (error) {
    console.error('Error getting email history:', error);
    throw error;
  }
};

// Get all users for admin dashboard
const getAllUsers = () => {
  try {
    if (!statements.getAllUsers) initStatements();
    return statements.getAllUsers.all();
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  }
};

// Update user's active status
const updateUserStatus = (userId, isActive) => {
  try {
    if (!statements.updateUserStatus) initStatements();
    const result = statements.updateUserStatus.run(isActive ? 1 : 0, userId);
    return result.changes;
  } catch (error) {
    console.error('Error updating user status:', error);
    throw error;
  }
};

// Get statistics for admin dashboard
const getStats = () => {
  try {
    if (!db) initializeDb();
    
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const activeUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get().count;
    const completedUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE current_week >= 12').get().count;
    const totalEmails = db.prepare('SELECT COUNT(*) as count FROM email_history').get().count;
    const recentSignups = db.prepare('SELECT COUNT(*) as count FROM users WHERE date(signup_date) >= date(\'now\', \'-7 days\')').get().count;
    
    return {
      totalUsers,
      activeUsers,
      completedUsers,
      totalEmails,
      recentSignups
    };
  } catch (error) {
    console.error('Error getting stats:', error);
    throw error;
  }
};

// Update email delivery status
const updateEmailStatus = (userId, weekNumber, status) => {
  try {
    if (!db) initializeDb();
    
    const stmt = db.prepare(`
      UPDATE email_history 
      SET delivery_status = ?
      WHERE user_id = ? AND week_number = ?
      ORDER BY sent_date DESC
      LIMIT 1
    `);
    
    const result = stmt.run(status, userId, weekNumber);
    return result.changes;
  } catch (error) {
    console.error('Error updating email status:', error);
    throw error;
  }
};

// Reset user's progress (for testing/admin)
const resetUserProgress = (userId) => {
  try {
    if (!statements.resetUserProgress) initStatements();
    const result = statements.resetUserProgress.run(userId);
    return result.changes;
  } catch (error) {
    console.error('Error resetting user progress:', error);
    throw error;
  }
};

// Get users who need emails soon (for admin monitoring)
const getUsersNeedingEmails = () => {
  try {
    if (!statements.getUsersNeedingEmails) initStatements();
    return statements.getUsersNeedingEmails.all();
  } catch (error) {
    console.error('Error getting users needing emails:', error);
    throw error;
  }
};

// Close database connection
const closeDatabase = () => {
  try {
    if (db) {
      db.close();
      console.log('Database connection closed');
    }
  } catch (error) {
    console.error('Error closing database:', error);
    throw error;
  }
};

// Graceful shutdown
process.on('exit', () => {
  closeDatabase();
});

process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDatabase();
  process.exit(0);
});

// Export all functions
module.exports = {
  initDatabase,
  getActiveUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUserWeek,
  logEmailHistory,
  getEmailHistory,
  getAllUsers,
  updateUserStatus,
  getStats,
  updateEmailStatus,
  resetUserProgress,
  getUsersNeedingEmails,
  closeDatabase
};

// Initialize database tables
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        timezone TEXT NOT NULL,
        goals TEXT NOT NULL,
        signup_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        current_week INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        last_email_sent DATETIME
      )
    `, (err) => {
      if (err) {
        console.error('Error creating users table:', err);
        reject(err);
        return;
      }
      
      // Email history table
      db.run(`
        CREATE TABLE IF NOT EXISTS email_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          week_number INTEGER,
          subject TEXT,
          content TEXT,
          action_item TEXT,
          sent_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          delivery_status TEXT DEFAULT 'sent',
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating email_history table:', err);
          reject(err);
          return;
        }
        
        console.log('Database initialized successfully');
        resolve();
      });
    });
  });
};

// Get all active users
const getActiveUsers = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT * FROM users 
      WHERE is_active = 1 AND current_week < 12
      ORDER BY signup_date ASC
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('Error getting active users:', err);
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
};

// Get specific user by ID
const getUserById = (userId) => {
  return new Promise((resolve, reject) => {
    const query = `SELECT * FROM users WHERE id = ?`;
    
    db.get(query, [userId], (err, row) => {
      if (err) {
        console.error('Error getting user by ID:', err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

// Get user by email
const getUserByEmail = (email) => {
  return new Promise((resolve, reject) => {
    const query = `SELECT * FROM users WHERE email = ?`;
    
    db.get(query, [email], (err, row) => {
      if (err) {
        console.error('Error getting user by email:', err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

// Create new user
const createUser = (email, timezone, goals) => {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO users (email, timezone, goals, signup_date, current_week, is_active)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, 0, 1)
    `;
    
    db.run(query, [email, timezone, goals], function(err) {
      if (err) {
        console.error('Error creating user:', err);
        reject(err);
      } else {
        console.log(`User created with ID: ${this.lastID}`);
        resolve(this.lastID);
      }
    });
  });
};

// Update user's current week and last email sent date
const updateUserWeek = (userId, newWeek, actionItem) => {
  return new Promise((resolve, reject) => {
    const query = `
      UPDATE users 
      SET current_week = ?, last_email_sent = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    db.run(query, [newWeek, userId], function(err) {
      if (err) {
        console.error('Error updating user week:', err);
        reject(err);
      } else {
        // Also log the email in history
        logEmailHistory(userId, newWeek, actionItem)
          .then(() => resolve(this.changes))
          .catch(reject);
      }
    });
  });
};

// Log email to history
const logEmailHistory = (userId, weekNumber, actionItem, subject = null, content = null) => {
  return new Promise((resolve, reject) => {
    const defaultSubject = `Week ${weekNumber}: Keep the momentum going!`;
    
    const query = `
      INSERT INTO email_history (user_id, week_number, subject, content, action_item, sent_date, delivery_status)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'sent')
    `;
    
    db.run(query, [
      userId, 
      weekNumber, 
      subject || defaultSubject, 
      content || '', 
      actionItem || ''
    ], function(err) {
      if (err) {
        console.error('Error logging email history:', err);
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
  });
};

// Get email history for a user
const getEmailHistory = (userId) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT * FROM email_history 
      WHERE user_id = ?
      ORDER BY sent_date DESC
    `;
    
    db.all(query, [userId], (err, rows) => {
      if (err) {
        console.error('Error getting email history:', err);
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
};

// Get all users for admin dashboard
const getAllUsers = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        u.*,
        COUNT(e.id) as email_count,
        MAX(e.sent_date) as last_email_date
      FROM users u
      LEFT JOIN email_history e ON u.id = e.user_id
      GROUP BY u.id
      ORDER BY u.signup_date DESC
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('Error getting all users:', err);
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
};

// Update user's active status
const updateUserStatus = (userId, isActive) => {
  return new Promise((resolve, reject) => {
    const query = `UPDATE users SET is_active = ? WHERE id = ?`;
    
    db.run(query, [isActive ? 1 : 0, userId], function(err) {
      if (err) {
        console.error('Error updating user status:', err);
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
};

// Get statistics for admin dashboard
const getStats = () => {
  return new Promise((resolve, reject) => {
    const queries = {
      totalUsers: `SELECT COUNT(*) as count FROM users`,
      activeUsers: `SELECT COUNT(*) as count FROM users WHERE is_active = 1`,
      completedUsers: `SELECT COUNT(*) as count FROM users WHERE current_week >= 12`,
      totalEmails: `SELECT COUNT(*) as count FROM email_history`,
      recentSignups: `SELECT COUNT(*) as count FROM users WHERE date(signup_date) >= date('now', '-7 days')`
    };
    
    const stats = {};
    const promises = Object.keys(queries).map(key => {
      return new Promise((resolve, reject) => {
        db.get(queries[key], [], (err, row) => {
          if (err) {
            reject(err);
          } else {
            stats[key] = row.count;
            resolve();
          }
        });
      });
    });
    
    Promise.all(promises)
      .then(() => resolve(stats))
      .catch(reject);
  });
};

// Update email delivery status
const updateEmailStatus = (userId, weekNumber, status) => {
  return new Promise((resolve, reject) => {
    const query = `
      UPDATE email_history 
      SET delivery_status = ?
      WHERE user_id = ? AND week_number = ?
      ORDER BY sent_date DESC
      LIMIT 1
    `;
    
    db.run(query, [status, userId, weekNumber], function(err) {
      if (err) {
        console.error('Error updating email status:', err);
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
};

// Reset user's progress (for testing/admin)
const resetUserProgress = (userId) => {
  return new Promise((resolve, reject) => {
    const query = `
      UPDATE users 
      SET current_week = 0, last_email_sent = NULL
      WHERE id = ?
    `;
    
    db.run(query, [userId], function(err) {
      if (err) {
        console.error('Error resetting user progress:', err);
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
};

// Get users who need emails soon (for admin monitoring)
const getUsersNeedingEmails = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        u.*,
        CASE 
          WHEN u.last_email_sent IS NULL THEN 'Never sent'
          ELSE datetime(u.last_email_sent, '+7 days')
        END as next_email_due
      FROM users u
      WHERE u.is_active = 1 AND u.current_week < 12
      ORDER BY 
        CASE 
          WHEN u.last_email_sent IS NULL THEN '1900-01-01'
          ELSE u.last_email_sent
        END ASC
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('Error getting users needing emails:', err);
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
};

// Close database connection
const closeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
        reject(err);
      } else {
        console.log('Database connection closed');
        resolve();
      }
    });
  });
};

// Export all functions
module.exports = {
  initDatabase,
  getActiveUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUserWeek,
  logEmailHistory,
  getEmailHistory,
  getAllUsers,
  updateUserStatus,
  getStats,
  updateEmailStatus,
  resetUserProgress,
  getUsersNeedingEmails,
  closeDatabase
};;
      END;
      $ LANGUAGE plpgsql IMMUTABLE;
    `);

    await executeQuery('COMMIT');
    console.log('Database initialized successfully with enhanced schema');
  } catch (error) {
    await executeQuery('ROLLBACK');
    console.error('Error initializing database:', error);
    throw error;
  }
};

// Get all active users with parameterized query
const getActiveUsers = async () => {
  try {
    const result = await executeQuery(`
      SELECT 
        id, email, timezone, goals, signup_date, current_week, 
        is_active, last_email_sent, created_at, updated_at
      FROM users 
      WHERE is_active = $1 AND current_week < $2
      ORDER BY signup_date ASC
      LIMIT 1000
    `, [true, 12]);
    
    return result.rows;
  } catch (error) {
    console.error('Error getting active users:', error);
    throw error;
  }
};

// Get specific user by ID with input validation
const getUserById = async (userId) => {
  try {
    // Input validation
    const id = parseInt(userId);
    if (isNaN(id) || id <= 0) {
      throw new Error('Invalid user ID provided');
    }

    const result = await executeQuery(`
      SELECT 
        id, email, timezone, goals, signup_date, current_week, 
        is_active, last_email_sent, created_at, updated_at
      FROM users 
      WHERE id = $1
    `, [id]);
    
    return result.rows[0];
  } catch (error) {
    console.error('Error getting user by ID:', error);
    throw error;
  }
};

// Get user by email with case-insensitive search
const getUserByEmail = async (email) => {
  try {
    // Input validation
    if (!email || typeof email !== 'string') {
      throw new Error('Valid email is required');
    }

    const normalizedEmail = email.trim().toLowerCase();
    
    // Additional email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new Error('Invalid email format');
    }

    const result = await executeQuery(`
      SELECT 
        id, email, timezone, goals, signup_date, current_week, 
        is_active, last_email_sent, created_at, updated_at
      FROM users 
      WHERE LOWER(email) = $1
    `, [normalizedEmail]);
    
    return result.rows[0];
  } catch (error) {
    console.error('Error getting user by email:', error);
    throw error;
  }
};

// Create new user with comprehensive validation
const createUser = async (email, timezone, goals) => {
  try {
    // Input validation
    if (!email || !timezone || !goals) {
      throw new Error('Email, timezone, and goals are required');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedTimezone = timezone.trim();
    const trimmedGoals = goals.trim();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      throw new Error('Invalid email format');
    }

    // Validate goals length
    if (trimmedGoals.length < 20 || trimmedGoals.length > 2000) {
      throw new Error('Goals must be between 20 and 2000 characters');
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(normalizedEmail);
    if (existingUser) {
      throw new Error('UNIQUE constraint failed: users.email');
    }
    
    const result = await executeQuery(`
      INSERT INTO users (email, timezone, goals, signup_date, current_week, is_active)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 0, TRUE)
      RETURNING id, email, created_at
    `, [normalizedEmail, trimmedTimezone, trimmedGoals]);
    
    const userId = result.rows[0].id;
    console.log(`User created successfully with ID: ${userId}, email: ${normalizedEmail}`);
    return userId;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

// Update user's current week using transaction
const updateUserWeek = async (userId, newWeek, actionItem) => {
  let client;
  
  try {
    // Input validation
    const id = parseInt(userId);
    const week = parseInt(newWeek);
    
    if (isNaN(id) || id <= 0) {
      throw new Error('Invalid user ID');
    }
    
    if (isNaN(week) || week < 0 || week > 12) {
      throw new Error('Invalid week number (must be 0-12)');
    }

    client = await getClient();
    await client.query('BEGIN');
    
    // Update user with optimistic locking
    const updateResult = await client.query(`
      UPDATE users 
      SET current_week = $1, last_email_sent = CURRENT_TIMESTAMP
      WHERE id = $2 AND current_week = $3
      RETURNING id, current_week
    `, [week, id, week - 1]);
    
    if (updateResult.rowCount === 0) {
      throw new Error('User not found or week conflict detected');
    }
    
    // Log email history
    const defaultSubject = `Week ${week}: Keep the momentum going!`;
    await client.query(`
      INSERT INTO email_history (user_id, week_number, subject, content, action_item, sent_date, delivery_status)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, 'sent')
      ON CONFLICT (user_id, week_number) 
      DO UPDATE SET 
        action_item = EXCLUDED.action_item,
        sent_date = EXCLUDED.sent_date,
        delivery_status = EXCLUDED.delivery_status
    `, [id, week, defaultSubject, '', actionItem || '']);
    
    await client.query('COMMIT');
    return updateResult.rowCount;
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }
    console.error('Error updating user week:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
};

// Log email to history with validation
const logEmailHistory = async (userId, weekNumber, actionItem, subject = null, content = null) => {
  try {
    // Input validation
    const id = parseInt(userId);
    const week = parseInt(weekNumber);
    
    if (isNaN(id) || id <= 0) {
      throw new Error('Invalid user ID');
    }
    
    if (isNaN(week) || week < 0 || week > 12) {
      throw new Error('Invalid week number');
    }
    
    const defaultSubject = `Week ${week}: Keep the momentum going!`;
    const finalSubject = subject || defaultSubject;
    const finalContent = content || '';
    const finalActionItem = actionItem || '';
    
    // Validate lengths
    if (finalSubject.length > 255) {
      throw new Error('Subject too long (max 255 characters)');
    }
    
    if (finalActionItem.length > 1000) {
      throw new Error('Action item too long (max 1000 characters)');
    }
    
    const result = await executeQuery(`
      INSERT INTO email_history (user_id, week_number, subject, content, action_item, sent_date, delivery_status)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, 'sent')
      ON CONFLICT (user_id, week_number) 
      DO UPDATE SET 
        subject = EXCLUDED.subject,
        content = EXCLUDED.content,
        action_item = EXCLUDED.action_item,
        sent_date = EXCLUDED.sent_date,
        delivery_status = EXCLUDED.delivery_status
      RETURNING id
    `, [id, week, finalSubject, finalContent, finalActionItem]);
    
    return result.rows[0].id;
  } catch (error) {
    console.error('Error logging email history:', error);
    throw error;
  }
};

// Get email history for a user with pagination
const getEmailHistory = async (userId, limit = 50, offset = 0) => {
  try {
    const id = parseInt(userId);
    if (isNaN(id) || id <= 0) {
      throw new Error('Invalid user ID');
    }

    const result = await executeQuery(`
      SELECT 
        id, user_id, week_number, subject, content, action_item,
        sent_date, delivery_status, created_at
      FROM email_history 
      WHERE user_id = $1
      ORDER BY sent_date DESC
      LIMIT $2 OFFSET $3
    `, [id, limit, offset]);
    
    return result.rows;
  } catch (error) {
    console.error('Error getting email history:', error);
    throw error;
  }
};

// Get all users for admin dashboard with enhanced data
const getAllUsers = async (limit = 100, offset = 0) => {
  try {
    const result = await executeQuery(`
      SELECT 
        u.id, u.email, u.timezone, u.goals, u.signup_date, u.current_week,
        u.is_active, u.last_email_sent, u.created_at, u.updated_at,
        COUNT(e.id) as email_count,
        MAX(e.sent_date) as last_email_date,
        COUNT(CASE WHEN e.delivery_status = 'failed' THEN 1 END) as failed_emails
      FROM users u
      LEFT JOIN email_history e ON u.id = e.user_id
      GROUP BY u.id, u.email, u.timezone, u.goals, u.signup_date, u.current_week,
               u.is_active, u.last_email_sent, u.created_at, u.updated_at
      ORDER BY u.signup_date DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    return result.rows;
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  }
};

// Update user's active status with validation
const updateUserStatus = async (userId, isActive) => {
  try {
    const id = parseInt(userId);
    if (isNaN(id) || id <= 0) {
      throw new Error('Invalid user ID');
    }

    if (typeof isActive !== 'boolean') {
      throw new Error('isActive must be a boolean value');
    }

    const result = await executeQuery(`
      UPDATE users 
      SET is_active = $1
      WHERE id = $2
      RETURNING id, is_active
    `, [isActive, id]);
    
    if (result.rowCount === 0) {
      throw new Error('User not found');
    }
    
    return result.rowCount;
  } catch (error) {
    console.error('Error updating user status:', error);
    throw error;
  }
};

// Get comprehensive statistics with error handling
const getStats = async () => {
  try {
    const queries = [
      { name: 'totalUsers', query: 'SELECT COUNT(*) as count FROM users' },
      { name: 'activeUsers', query: 'SELECT COUNT(*) as count FROM users WHERE is_active = TRUE' },
      { name: 'completedUsers', query: 'SELECT COUNT(*) as count FROM users WHERE current_week >= 12' },
      { name: 'totalEmails', query: 'SELECT COUNT(*) as count FROM email_history' },
      { name: 'recentSignups', query: 'SELECT COUNT(*) as count FROM users WHERE signup_date >= CURRENT_DATE - INTERVAL \'7 days\'' },
      { name: 'failedEmails', query: 'SELECT COUNT(*) as count FROM email_history WHERE delivery_status = \'failed\'' },
      { name: 'avgWeekProgress', query: 'SELECT ROUND(AVG(current_week), 2) as avg FROM users WHERE is_active = TRUE' }
    ];
    
    const stats = {};
    
    // Execute all queries in parallel for better performance
    const results = await Promise.all(
      queries.map(({ query }) => executeQuery(query))
    );
    
    queries.forEach(({ name }, index) => {
      const result = results[index];
      stats[name] = name === 'avgWeekProgress' 
        ? parseFloat(result.rows[0].avg) || 0
        : parseInt(result.rows[0].count) || 0;
    });
    
    return stats;
  } catch (error) {
    console.error('Error getting stats:', error);
    throw error;
  }
};

// Update email delivery status with validation
const updateEmailStatus = async (userId, weekNumber, status) => {
  try {
    const id = parseInt(userId);
    const week = parseInt(weekNumber);
    
    if (isNaN(id) || id <= 0) {
      throw new Error('Invalid user ID');
    }
    
    if (isNaN(week) || week < 0 || week > 12) {
      throw new Error('Invalid week number');
    }
    
    const validStatuses = ['sent', 'failed', 'pending', 'delivered'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const result = await executeQuery(`
      UPDATE email_history 
      SET delivery_status = $1
      WHERE user_id = $2 AND week_number = $3
      AND id = (
        SELECT id FROM email_history 
        WHERE user_id = $2 AND week_number = $3
        ORDER BY sent_date DESC 
        LIMIT 1
      )
      RETURNING id, delivery_status
    `, [status, id, week]);
    
    return result.rowCount;
  } catch (error) {
    console.error('Error updating email status:', error);
    throw error;
  }
};

// Reset user's progress with validation
const resetUserProgress = async (userId) => {
  try {
    const id = parseInt(userId);
    if (isNaN(id) || id <= 0) {
      throw new Error('Invalid user ID');
    }

    const result = await executeQuery(`
      UPDATE users 
      SET current_week = 0, last_email_sent = NULL
      WHERE id = $1
      RETURNING id, current_week
    `, [id]);
    
    if (result.rowCount === 0) {
      throw new Error('User not found');
    }
    
    return result.rowCount;
  } catch (error) {
    console.error('Error resetting user progress:', error);
    throw error;
  }
};

// Get users who need emails soon with enhanced logic
const getUsersNeedingEmails = async () => {
  try {
    const result = await executeQuery(`
      SELECT 
        u.id, u.email, u.timezone, u.current_week, u.last_email_sent,
        CASE 
          WHEN u.last_email_sent IS NULL THEN 'Never sent'
          ELSE TO_CHAR(u.last_email_sent + INTERVAL '7 days', 'YYYY-MM-DD HH24:MI:SS TZ')
        END as next_email_due,
        CASE 
          WHEN u.last_email_sent IS NULL THEN TRUE
          ELSE (u.last_email_sent + INTERVAL '7 days') <= CURRENT_TIMESTAMP
        END as email_due
      FROM users u
      WHERE u.is_active = TRUE AND u.current_week < 12
      ORDER BY 
        CASE 
          WHEN u.last_email_sent IS NULL THEN '1900-01-01'::timestamp
          ELSE u.last_email_sent
        END ASC
      LIMIT 100
    `);
    
    return result.rows;
  } catch (error) {
    console.error('Error getting users needing emails:', error);
    throw error;
  }
};

// Close database connection pool gracefully
const closeDatabase = async () => {
  try {
    if (pool) {
      await pool.end();
      console.log('PostgreSQL connection pool closed gracefully');
    }
  } catch (error) {
    console.error('Error closing database pool:', error);
    throw error;
  }
};

// Test database connection with comprehensive checks
const testConnection = async () => {
  try {
    const client = await getClient();
    
    // Test basic connectivity
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('Database connection test successful:', {
      timestamp: result.rows[0].current_time,
      version: result.rows[0].pg_version.split(' ')[0]
    });
    
    // Test table existence
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'email_history')
    `);
    
    console.log('Available tables:', tableCheck.rows.map(row => row.table_name));
    
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
};

// Health check for monitoring
const healthCheck = async () => {
  try {
    const start = Date.now();
    await executeQuery('SELECT 1');
    const responseTime = Date.now() - start;
    
    const poolInfo = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    };
    
    return {
      status: 'healthy',
      responseTime: `${responseTime}ms`,
      pool: poolInfo,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  console.log('Received SIGINT, closing database connections...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing database connections...');
  await closeDatabase();
  process.exit(0);
});

process.on('exit', async () => {
  await closeDatabase();
});

// Export all functions
module.exports = {
  initDatabase,
  getActiveUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUserWeek,
  logEmailHistory,
  getEmailHistory,
  getAllUsers,
  updateUserStatus,
  getStats,
  updateEmailStatus,
  resetUserProgress,
  getUsersNeedingEmails,
  closeDatabase,
  testConnection,
  healthCheck,
  executeQuery // Export for advanced usage
};

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });

    console.log('PostgreSQL pool initialized successfully');
    return pool;
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
};

// Get database client from pool
const getClient = async () => {
  if (!pool) {
    initializeDb();
  }
  return await pool.connect();
};

// Initialize database tables
const initDatabase = async () => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');

    // Users table
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
    
    // Email history table
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

    // Create trigger to update updated_at column
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $ language 'plpgsql';
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS update_users_updated_at ON users;
      CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    await client.query('COMMIT');
    console.log('Database initialized successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get all active users
const getActiveUsers = async () => {
  const client = await getClient();
  
  try {
    const result = await client.query(`
      SELECT * FROM users 
      WHERE is_active = TRUE AND current_week < 12
      ORDER BY signup_date ASC
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
  const client = await getClient();
  
  try {
    const result = await client.query(`
      SELECT * FROM users WHERE id = $1
    `, [userId]);
    return result.rows[0];
  } catch (error) {
    console.error('Error getting user by ID:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get user by email
const getUserByEmail = async (email) => {
  const client = await getClient();
  
  try {
    const result = await client.query(`
      SELECT * FROM users WHERE email = $1
    `, [email]);
    return result.rows[0];
  } catch (error) {
    console.error('Error getting user by email:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Create new user
const createUser = async (email, timezone, goals) => {
  const client = await getClient();
  
  try {
    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      throw new Error('UNIQUE constraint failed: users.email');
    }
    
    const result = await client.query(`
      INSERT INTO users (email, timezone, goals, signup_date, current_week, is_active)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 0, TRUE)
      RETURNING id
    `, [email, timezone, goals]);
    
    const userId = result.rows[0].id;
    console.log(`User created with ID: ${userId}`);
    return userId;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Update user's current week and last email sent date
const updateUserWeek = async (userId, newWeek, actionItem) => {
  const client = await getClient();
  
  try {
    await client.query('BEGIN');
    
    // Update user
    const result = await client.query(`
      UPDATE users 
      SET current_week = $1, last_email_sent = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [newWeek, userId]);
    
    // Log email history
    const defaultSubject = `Week ${newWeek}: Keep the momentum going!`;
    await client.query(`
      INSERT INTO email_history (user_id, week_number, subject, content, action_item, sent_date, delivery_status)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, 'sent')
    `, [userId, newWeek, defaultSubject, '', actionItem || '']);
    
    await client.query('COMMIT');
    return result.rowCount;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating user week:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Log email to history
const logEmailHistory = async (userId, weekNumber, actionItem, subject = null, content = null) => {
  const client = await getClient();
  
  try {
    const defaultSubject = `Week ${weekNumber}: Keep the momentum going!`;
    const result = await client.query(`
      INSERT INTO email_history (user_id, week_number, subject, content, action_item, sent_date, delivery_status)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, 'sent')
      RETURNING id
    `, [userId, weekNumber, subject || defaultSubject, content || '', actionItem || '']);
    
    return result.rows[0].id;
  } catch (error) {
    console.error('Error logging email history:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get email history for a user
const getEmailHistory = async (userId) => {
  const client = await getClient();
  
  try {
    const result = await client.query(`
      SELECT * FROM email_history 
      WHERE user_id = $1
      ORDER BY sent_date DESC
    `, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error getting email history:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get all users for admin dashboard
const getAllUsers = async () => {
  const client = await getClient();
  
  try {
    const result = await client.query(`
      SELECT 
        u.*,
        COUNT(e.id) as email_count,
        MAX(e.sent_date) as last_email_date
      FROM users u
      LEFT JOIN email_history e ON u.id = e.user_id
      GROUP BY u.id
      ORDER BY u.signup_date DESC
    `);
    return result.rows;
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Update user's active status
const updateUserStatus = async (userId, isActive) => {
  const client = await getClient();
  
  try {
    const result = await client.query(`
      UPDATE users SET is_active = $1 WHERE id = $2
    `, [isActive, userId]);
    return result.rowCount;
  } catch (error) {
    console.error('Error updating user status:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get statistics for admin dashboard
const getStats = async () => {
  const client = await getClient();
  
  try {
    const queries = [
      { name: 'totalUsers', query: 'SELECT COUNT(*) as count FROM users' },
      { name: 'activeUsers', query: 'SELECT COUNT(*) as count FROM users WHERE is_active = TRUE' },
      { name: 'completedUsers', query: 'SELECT COUNT(*) as count FROM users WHERE current_week >= 12' },
      { name: 'totalEmails', query: 'SELECT COUNT(*) as count FROM email_history' },
      { name: 'recentSignups', query: 'SELECT COUNT(*) as count FROM users WHERE signup_date >= CURRENT_DATE - INTERVAL \'7 days\'' }
    ];
    
    const stats = {};
    
    for (const { name, query } of queries) {
      const result = await client.query(query);
      stats[name] = parseInt(result.rows[0].count);
    }
    
    return stats;
  } catch (error) {
    console.error('Error getting stats:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Update email delivery status
const updateEmailStatus = async (userId, weekNumber, status) => {
  const client = await getClient();
  
  try {
    const result = await client.query(`
      UPDATE email_history 
      SET delivery_status = $1
      WHERE user_id = $2 AND week_number = $3
      AND id = (
        SELECT id FROM email_history 
        WHERE user_id = $2 AND week_number = $3
        ORDER BY sent_date DESC 
        LIMIT 1
      )
    `, [status, userId, weekNumber]);
    
    return result.rowCount;
  } catch (error) {
    console.error('Error updating email status:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Reset user's progress (for testing/admin)
const resetUserProgress = async (userId) => {
  const client = await getClient();
  
  try {
    const result = await client.query(`
      UPDATE users 
      SET current_week = 0, last_email_sent = NULL
      WHERE id = $1
    `, [userId]);
    return result.rowCount;
  } catch (error) {
    console.error('Error resetting user progress:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Get users who need emails soon (for admin monitoring)
const getUsersNeedingEmails = async () => {
  const client = await getClient();
  
  try {
    const result = await client.query(`
      SELECT 
        u.*,
        CASE 
          WHEN u.last_email_sent IS NULL THEN 'Never sent'
          ELSE (u.last_email_sent + INTERVAL '7 days')::text
        END as next_email_due
      FROM users u
      WHERE u.is_active = TRUE AND u.current_week < 12
      ORDER BY 
        CASE 
          WHEN u.last_email_sent IS NULL THEN '1900-01-01'::timestamp
          ELSE u.last_email_sent
        END ASC
    `);
    return result.rows;
  } catch (error) {
    console.error('Error getting users needing emails:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Close database connection pool
const closeDatabase = async () => {
  try {
    if (pool) {
      await pool.end();
      console.log('Database pool closed');
    }
  } catch (error) {
    console.error('Error closing database pool:', error);
    throw error;
  }
};

// Test database connection
const testConnection = async () => {
  const client = await getClient();
  
  try {
    const result = await client.query('SELECT NOW()');
    console.log('Database connection test successful:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  } finally {
    client.release();
  }
};

// Graceful shutdown
process.on('exit', async () => {
  await closeDatabase();
});

process.on('SIGINT', async () => {
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeDatabase();
  process.exit(0);
});

// Export all functions
module.exports = {
  initDatabase,
  getActiveUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUserWeek,
  logEmailHistory,
  getEmailHistory,
  getAllUsers,
  updateUserStatus,
  getStats,
  updateEmailStatus,
  resetUserProgress,
  getUsersNeedingEmails,
  closeDatabase,
  testConnection
};

// Initialize database tables
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    try {
      if (!db) {
        initializeDb();
      }

      // Users table
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          timezone TEXT NOT NULL,
          goals TEXT NOT NULL,
          signup_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          current_week INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT 1,
          last_email_sent DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Email history table
      db.exec(`
        CREATE TABLE IF NOT EXISTS email_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          week_number INTEGER NOT NULL,
          subject TEXT,
          content TEXT,
          action_item TEXT,
          sent_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          delivery_status TEXT DEFAULT 'sent',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Create indexes for better performance
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
        CREATE INDEX IF NOT EXISTS idx_users_week ON users(current_week);
        CREATE INDEX IF NOT EXISTS idx_email_history_user ON email_history(user_id);
        CREATE INDEX IF NOT EXISTS idx_email_history_week ON email_history(week_number);
      `);
      
      console.log('Database initialized successfully');
      resolve();
    } catch (error) {
      console.error('Error initializing database:', error);
      reject(error);
    }
  });
};

// Prepared statements for better performance
const statements = {
  getActiveUsers: null,
  getUserById: null,
  getUserByEmail: null,
  createUser: null,
  updateUserWeek: null,
  logEmailHistory: null,
  getEmailHistory: null,
  getAllUsers: null,
  updateUserStatus: null,
  resetUserProgress: null,
  getUsersNeedingEmails: null
};

// Initialize prepared statements
const initStatements = () => {
  if (!db) initializeDb();

  statements.getActiveUsers = db.prepare(`
    SELECT * FROM users 
    WHERE is_active = 1 AND current_week < 12
    ORDER BY signup_date ASC
  `);

  statements.getUserById = db.prepare(`
    SELECT * FROM users WHERE id = ?
  `);

  statements.getUserByEmail = db.prepare(`
    SELECT * FROM users WHERE email = ?
  `);

  statements.createUser = db.prepare(`
    INSERT INTO users (email, timezone, goals, signup_date, current_week, is_active)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP, 0, 1)
  `);

  statements.updateUserWeek = db.prepare(`
    UPDATE users 
    SET current_week = ?, last_email_sent = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  statements.logEmailHistory = db.prepare(`
    INSERT INTO email_history (user_id, week_number, subject, content, action_item, sent_date, delivery_status)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'sent')
  `);

  statements.getEmailHistory = db.prepare(`
    SELECT * FROM email_history 
    WHERE user_id = ?
    ORDER BY sent_date DESC
  `);

  statements.getAllUsers = db.prepare(`
    SELECT 
      u.*,
      COUNT(e.id) as email_count,
      MAX(e.sent_date) as last_email_date
    FROM users u
    LEFT JOIN email_history e ON u.id = e.user_id
    GROUP BY u.id
    ORDER BY u.signup_date DESC
  `);

  statements.updateUserStatus = db.prepare(`
    UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `);

  statements.resetUserProgress = db.prepare(`
    UPDATE users 
    SET current_week = 0, last_email_sent = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  statements.getUsersNeedingEmails = db.prepare(`
    SELECT 
      u.*,
      CASE 
        WHEN u.last_email_sent IS NULL THEN 'Never sent'
        ELSE datetime(u.last_email_sent, '+7 days')
      END as next_email_due
    FROM users u
    WHERE u.is_active = 1 AND u.current_week < 12
    ORDER BY 
      CASE 
        WHEN u.last_email_sent IS NULL THEN '1900-01-01'
        ELSE u.last_email_sent
      END ASC
  `);
};

// Get all active users
const getActiveUsers = () => {
  try {
    if (!statements.getActiveUsers) initStatements();
    return statements.getActiveUsers.all();
  } catch (error) {
    console.error('Error getting active users:', error);
    throw error;
  }
};

// Get specific user by ID
const getUserById = (userId) => {
  try {
    if (!statements.getUserById) initStatements();
    return statements.getUserById.get(userId);
  } catch (error) {
    console.error('Error getting user by ID:', error);
    throw error;
  }
};

// Get user by email
const getUserByEmail = (email) => {
  try {
    if (!statements.getUserByEmail) initStatements();
    return statements.getUserByEmail.get(email);
  } catch (error) {
    console.error('Error getting user by email:', error);
    throw error;
  }
};

// Create new user
const createUser = (email, timezone, goals) => {
  try {
    if (!statements.createUser) initStatements();
    
    // Check if user already exists
    const existingUser = getUserByEmail(email);
    if (existingUser) {
      throw new Error('UNIQUE constraint failed: users.email');
    }
    
    const result = statements.createUser.run(email, timezone, goals);
    console.log(`User created with ID: ${result.lastInsertRowid}`);
    return result.lastInsertRowid;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

// Update user's current week and last email sent date
const updateUserWeek = (userId, newWeek, actionItem) => {
  try {
    if (!statements.updateUserWeek || !statements.logEmailHistory) initStatements();
    
    const transaction = db.transaction(() => {
      // Update user
      const result = statements.updateUserWeek.run(newWeek, userId);
      
      // Log email history
      const defaultSubject = `Week ${newWeek}: Keep the momentum going!`;
      statements.logEmailHistory.run(userId, newWeek, defaultSubject, '', actionItem || '');
      
      return result.changes;
    });
    
    return transaction();
  } catch (error) {
    console.error('Error updating user week:', error);
    throw error;
  }
};

// Log email to history
const logEmailHistory = (userId, weekNumber, actionItem, subject = null, content = null) => {
  try {
    if (!statements.logEmailHistory) initStatements();
    
    const defaultSubject = `Week ${weekNumber}: Keep the momentum going!`;
    const result = statements.logEmailHistory.run(
      userId, 
      weekNumber, 
      subject || defaultSubject, 
      content || '', 
      actionItem || ''
    );
    
    return result.lastInsertRowid;
  } catch (error) {
    console.error('Error logging email history:', error);
    throw error;
  }
};

// Get email history for a user
const getEmailHistory = (userId) => {
  try {
    if (!statements.getEmailHistory) initStatements();
    return statements.getEmailHistory.all(userId);
  } catch (error) {
    console.error('Error getting email history:', error);
    throw error;
  }
};

// Get all users for admin dashboard
const getAllUsers = () => {
  try {
    if (!statements.getAllUsers) initStatements();
    return statements.getAllUsers.all();
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  }
};

// Update user's active status
const updateUserStatus = (userId, isActive) => {
  try {
    if (!statements.updateUserStatus) initStatements();
    const result = statements.updateUserStatus.run(isActive ? 1 : 0, userId);
    return result.changes;
  } catch (error) {
    console.error('Error updating user status:', error);
    throw error;
  }
};

// Get statistics for admin dashboard
const getStats = () => {
  try {
    if (!db) initializeDb();
    
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const activeUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get().count;
    const completedUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE current_week >= 12').get().count;
    const totalEmails = db.prepare('SELECT COUNT(*) as count FROM email_history').get().count;
    const recentSignups = db.prepare('SELECT COUNT(*) as count FROM users WHERE date(signup_date) >= date(\'now\', \'-7 days\')').get().count;
    
    return {
      totalUsers,
      activeUsers,
      completedUsers,
      totalEmails,
      recentSignups
    };
  } catch (error) {
    console.error('Error getting stats:', error);
    throw error;
  }
};

// Update email delivery status
const updateEmailStatus = (userId, weekNumber, status) => {
  try {
    if (!db) initializeDb();
    
    const stmt = db.prepare(`
      UPDATE email_history 
      SET delivery_status = ?
      WHERE user_id = ? AND week_number = ?
      ORDER BY sent_date DESC
      LIMIT 1
    `);
    
    const result = stmt.run(status, userId, weekNumber);
    return result.changes;
  } catch (error) {
    console.error('Error updating email status:', error);
    throw error;
  }
};

// Reset user's progress (for testing/admin)
const resetUserProgress = (userId) => {
  try {
    if (!statements.resetUserProgress) initStatements();
    const result = statements.resetUserProgress.run(userId);
    return result.changes;
  } catch (error) {
    console.error('Error resetting user progress:', error);
    throw error;
  }
};

// Get users who need emails soon (for admin monitoring)
const getUsersNeedingEmails = () => {
  try {
    if (!statements.getUsersNeedingEmails) initStatements();
    return statements.getUsersNeedingEmails.all();
  } catch (error) {
    console.error('Error getting users needing emails:', error);
    throw error;
  }
};

// Close database connection
const closeDatabase = () => {
  try {
    if (db) {
      db.close();
      console.log('Database connection closed');
    }
  } catch (error) {
    console.error('Error closing database:', error);
    throw error;
  }
};

// Graceful shutdown
process.on('exit', () => {
  closeDatabase();
});

process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDatabase();
  process.exit(0);
});

// Export all functions
module.exports = {
  initDatabase,
  getActiveUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUserWeek,
  logEmailHistory,
  getEmailHistory,
  getAllUsers,
  updateUserStatus,
  getStats,
  updateEmailStatus,
  resetUserProgress,
  getUsersNeedingEmails,
  closeDatabase
};

// Initialize database tables
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        timezone TEXT NOT NULL,
        goals TEXT NOT NULL,
        signup_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        current_week INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        last_email_sent DATETIME
      )
    `, (err) => {
      if (err) {
        console.error('Error creating users table:', err);
        reject(err);
        return;
      }
      
      // Email history table
      db.run(`
        CREATE TABLE IF NOT EXISTS email_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          week_number INTEGER,
          subject TEXT,
          content TEXT,
          action_item TEXT,
          sent_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          delivery_status TEXT DEFAULT 'sent',
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating email_history table:', err);
          reject(err);
          return;
        }
        
        console.log('Database initialized successfully');
        resolve();
      });
    });
  });
};

// Get all active users
const getActiveUsers = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT * FROM users 
      WHERE is_active = 1 AND current_week < 12
      ORDER BY signup_date ASC
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('Error getting active users:', err);
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
};

// Get specific user by ID
const getUserById = (userId) => {
  return new Promise((resolve, reject) => {
    const query = `SELECT * FROM users WHERE id = ?`;
    
    db.get(query, [userId], (err, row) => {
      if (err) {
        console.error('Error getting user by ID:', err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

// Get user by email
const getUserByEmail = (email) => {
  return new Promise((resolve, reject) => {
    const query = `SELECT * FROM users WHERE email = ?`;
    
    db.get(query, [email], (err, row) => {
      if (err) {
        console.error('Error getting user by email:', err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

// Create new user
const createUser = (email, timezone, goals) => {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO users (email, timezone, goals, signup_date, current_week, is_active)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, 0, 1)
    `;
    
    db.run(query, [email, timezone, goals], function(err) {
      if (err) {
        console.error('Error creating user:', err);
        reject(err);
      } else {
        console.log(`User created with ID: ${this.lastID}`);
        resolve(this.lastID);
      }
    });
  });
};

// Update user's current week and last email sent date
const updateUserWeek = (userId, newWeek, actionItem) => {
  return new Promise((resolve, reject) => {
    const query = `
      UPDATE users 
      SET current_week = ?, last_email_sent = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    db.run(query, [newWeek, userId], function(err) {
      if (err) {
        console.error('Error updating user week:', err);
        reject(err);
      } else {
        // Also log the email in history
        logEmailHistory(userId, newWeek, actionItem)
          .then(() => resolve(this.changes))
          .catch(reject);
      }
    });
  });
};

// Log email to history
const logEmailHistory = (userId, weekNumber, actionItem, subject = null, content = null) => {
  return new Promise((resolve, reject) => {
    const defaultSubject = `Week ${weekNumber}: Keep the momentum going!`;
    
    const query = `
      INSERT INTO email_history (user_id, week_number, subject, content, action_item, sent_date, delivery_status)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'sent')
    `;
    
    db.run(query, [
      userId, 
      weekNumber, 
      subject || defaultSubject, 
      content || '', 
      actionItem || ''
    ], function(err) {
      if (err) {
        console.error('Error logging email history:', err);
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
  });
};

// Get email history for a user
const getEmailHistory = (userId) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT * FROM email_history 
      WHERE user_id = ?
      ORDER BY sent_date DESC
    `;
    
    db.all(query, [userId], (err, rows) => {
      if (err) {
        console.error('Error getting email history:', err);
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
};

// Get all users for admin dashboard
const getAllUsers = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        u.*,
        COUNT(e.id) as email_count,
        MAX(e.sent_date) as last_email_date
      FROM users u
      LEFT JOIN email_history e ON u.id = e.user_id
      GROUP BY u.id
      ORDER BY u.signup_date DESC
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('Error getting all users:', err);
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
};

// Update user's active status
const updateUserStatus = (userId, isActive) => {
  return new Promise((resolve, reject) => {
    const query = `UPDATE users SET is_active = ? WHERE id = ?`;
    
    db.run(query, [isActive ? 1 : 0, userId], function(err) {
      if (err) {
        console.error('Error updating user status:', err);
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
};

// Get statistics for admin dashboard
const getStats = () => {
  return new Promise((resolve, reject) => {
    const queries = {
      totalUsers: `SELECT COUNT(*) as count FROM users`,
      activeUsers: `SELECT COUNT(*) as count FROM users WHERE is_active = 1`,
      completedUsers: `SELECT COUNT(*) as count FROM users WHERE current_week >= 12`,
      totalEmails: `SELECT COUNT(*) as count FROM email_history`,
      recentSignups: `SELECT COUNT(*) as count FROM users WHERE date(signup_date) >= date('now', '-7 days')`
    };
    
    const stats = {};
    const promises = Object.keys(queries).map(key => {
      return new Promise((resolve, reject) => {
        db.get(queries[key], [], (err, row) => {
          if (err) {
            reject(err);
          } else {
            stats[key] = row.count;
            resolve();
          }
        });
      });
    });
    
    Promise.all(promises)
      .then(() => resolve(stats))
      .catch(reject);
  });
};

// Update email delivery status
const updateEmailStatus = (userId, weekNumber, status) => {
  return new Promise((resolve, reject) => {
    const query = `
      UPDATE email_history 
      SET delivery_status = ?
      WHERE user_id = ? AND week_number = ?
      ORDER BY sent_date DESC
      LIMIT 1
    `;
    
    db.run(query, [status, userId, weekNumber], function(err) {
      if (err) {
        console.error('Error updating email status:', err);
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
};

// Reset user's progress (for testing/admin)
const resetUserProgress = (userId) => {
  return new Promise((resolve, reject) => {
    const query = `
      UPDATE users 
      SET current_week = 0, last_email_sent = NULL
      WHERE id = ?
    `;
    
    db.run(query, [userId], function(err) {
      if (err) {
        console.error('Error resetting user progress:', err);
        reject(err);
      } else {
        resolve(this.changes);
      }
    });
  });
};

// Get users who need emails soon (for admin monitoring)
const getUsersNeedingEmails = () => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        u.*,
        CASE 
          WHEN u.last_email_sent IS NULL THEN 'Never sent'
          ELSE datetime(u.last_email_sent, '+7 days')
        END as next_email_due
      FROM users u
      WHERE u.is_active = 1 AND u.current_week < 12
      ORDER BY 
        CASE 
          WHEN u.last_email_sent IS NULL THEN '1900-01-01'
          ELSE u.last_email_sent
        END ASC
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('Error getting users needing emails:', err);
        reject(err);
      } else {
        resolve(rows || []);
      }
    });
  });
};

// Close database connection
const closeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
        reject(err);
      } else {
        console.log('Database connection closed');
        resolve();
      }
    });
  });
};

// Export all functions
module.exports = {
  initDatabase,
  getActiveUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUserWeek,
  logEmailHistory,
  getEmailHistory,
  getAllUsers,
  updateUserStatus,
  getStats,
  updateEmailStatus,
  resetUserProgress,
  getUsersNeedingEmails,
  closeDatabase
};