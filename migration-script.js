// Database migration script for PostgreSQL
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Migration functions
const migrations = [
  {
    version: 1,
    name: 'Initial tables',
    up: async (client) => {
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
      
      console.log('✅ Created initial tables');
    },
    down: async (client) => {
      await client.query('DROP TABLE IF EXISTS email_history CASCADE');
      await client.query('DROP TABLE IF EXISTS users CASCADE');
      console.log('✅ Dropped initial tables');
    }
  },
  {
    version: 2,
    name: 'Add indexes',
    up: async (client) => {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
        CREATE INDEX IF NOT EXISTS idx_users_week ON users(current_week);
        CREATE INDEX IF NOT EXISTS idx_email_history_user ON email_history(user_id);
        CREATE INDEX IF NOT EXISTS idx_email_history_week ON email_history(week_number);
        CREATE INDEX IF NOT EXISTS idx_users_signup_date ON users(signup_date);
        CREATE INDEX IF NOT EXISTS idx_email_history_sent_date ON email_history(sent_date);
      `);
      console.log('✅ Created indexes');
    },
    down: async (client) => {
      await client.query(`
        DROP INDEX IF EXISTS idx_users_email;
        DROP INDEX IF EXISTS idx_users_active;
        DROP INDEX IF EXISTS idx_users_week;
        DROP INDEX IF EXISTS idx_email_history_user;
        DROP INDEX IF EXISTS idx_email_history_week;
        DROP INDEX IF EXISTS idx_users_signup_date;
        DROP INDEX IF EXISTS idx_email_history_sent_date;
      `);
      console.log('✅ Dropped indexes');
    }
  },
  {
    version: 3,
    name: 'Add triggers',
    up: async (client) => {
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
      
      console.log('✅ Created triggers');
    },
    down: async (client) => {
      await client.query('DROP TRIGGER IF EXISTS update_users_updated_at ON users');
      await client.query('DROP FUNCTION IF EXISTS update_updated_at_column()');
      console.log('✅ Dropped triggers');
    }
  },
  {
    version: 4,
    name: 'Add migration tracking',
    up: async (client) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          version INTEGER UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Created migrations table');
    },
    down: async (client) => {
      await client.query('DROP TABLE IF EXISTS migrations');
      console.log('✅ Dropped migrations table');
    }
  }
];

// Get applied migrations
async function getAppliedMigrations(client) {
  try {
    const result = await client.query('SELECT version FROM migrations ORDER BY version');
    return result.rows.map(row => row.version);
  } catch (error) {
    // If migrations table doesn't exist, return empty array
    return [];
  }
}

// Mark migration as applied
async function markMigrationApplied(client, migration) {
  await client.query(
    'INSERT INTO migrations (version, name) VALUES ($1, $2)',
    [migration.version, migration.name]
  );
}

// Mark migration as reverted
async function markMigrationReverted(client, version) {
  await client.query('DELETE FROM migrations WHERE version = $1', [version]);
}

// Run migrations up
async function migrateUp() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Running database migrations...');
    
    await client.query('BEGIN');
    
    const appliedMigrations = await getAppliedMigrations(client);
    console.log('📋 Applied migrations:', appliedMigrations);
    
    for (const migration of migrations) {
      const isApplied = appliedMigrations.includes(migration.version);
      const status = isApplied ? '✅ Applied' : '⏳ Pending';
      console.log(`${status} - Version ${migration.version}: ${migration.name}`);
    }
    
    console.log('\n📈 Database Statistics:');
    
    // Get table counts
    const tables = ['users', 'email_history'];
    for (const table of tables) {
      try {
        const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`📋 ${table}: ${result.rows[0].count} records`);
      } catch (error) {
        console.log(`📋 ${table}: Table not found`);
      }
    }
    
  } catch (error) {
    console.error('❌ Status check failed:', error);
  } finally {
    client.release();
  }
}

// Test database connection
async function testConnection() {
  const client = await pool.connect();
  
  try {
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log('✅ Database connection successful');
    console.log(`🕐 Current time: ${result.rows[0].current_time}`);
    console.log(`🐘 PostgreSQL version: ${result.rows[0].pg_version.split(' ')[0]}`);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  } finally {
    client.release();
  }
}

// Create sample data for testing
async function createSampleData() {
  const client = await pool.connect();
  
  try {
    console.log('🎭 Creating sample data...');
    
    await client.query('BEGIN');
    
    // Check if sample data already exists
    const userCount = await client.query('SELECT COUNT(*) as count FROM users');
    if (parseInt(userCount.rows[0].count) > 0) {
      console.log('⚪ Sample data already exists');
      return;
    }
    
    // Create sample users
    const sampleUsers = [
      {
        email: 'demo@example.com',
        timezone: 'America/New_York',
        goals: 'I want to improve my communication skills and become a better team leader who can inspire and motivate others.'
      },
      {
        email: 'test@example.com',
        timezone: 'Europe/London',
        goals: 'My goal is to develop better decision-making skills and learn how to delegate effectively while maintaining quality standards.'
      },
      {
        email: 'sample@example.com',
        timezone: 'Asia/Tokyo',
        goals: 'I aim to build stronger relationships with team members and create a more positive work environment through better emotional intelligence.'
      }
    ];
    
    for (const user of sampleUsers) {
      const result = await client.query(`
        INSERT INTO users (email, timezone, goals, current_week)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [user.email, user.timezone, user.goals, Math.floor(Math.random() * 5)]);
      
      const userId = result.rows[0].id;
      
      // Add some sample email history
      for (let week = 1; week <= Math.floor(Math.random() * 3) + 1; week++) {
        await client.query(`
          INSERT INTO email_history (user_id, week_number, subject, action_item)
          VALUES ($1, $2, $3, $4)
        `, [
          userId,
          week,
          `Week ${week}: Keep the momentum going!`,
          `Sample action item for week ${week}`
        ]);
      }
    }
    
    await client.query('COMMIT');
    console.log('✅ Sample data created successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to create sample data:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    // Test connection first
    const connected = await testConnection();
    if (!connected) {
      console.error('❌ Cannot connect to database. Check your DATABASE_URL environment variable.');
      process.exit(1);
    }
    
    switch (command) {
      case 'up':
        await migrateUp();
        break;
        
      case 'down':
        const targetVersion = parseInt(args[1]) || 0;
        await migrateDown(targetVersion);
        break;
        
      case 'status':
        await showStatus();
        break;
        
      case 'reset':
        console.log('⚠️  Resetting database...');
        await migrateDown(0);
        await migrateUp();
        console.log('🎉 Database reset completed');
        break;
        
      case 'sample':
        await migrateUp(); // Ensure migrations are applied first
        await createSampleData();
        break;
        
      case 'test':
        await testConnection();
        break;
        
      default:
        console.log(`
🗃️  Go Leadership App - Database Migration Tool

Usage: node migrations/migrate.js <command> [options]

Commands:
  up                    Apply all pending migrations
  down [version]        Rollback to specific version (default: 0)
  status               Show migration status
  reset                Reset database (down to 0, then up)
  sample               Create sample data for testing
  test                 Test database connection

Examples:
  node migrations/migrate.js up
  node migrations/migrate.js down 2
  node migrations/migrate.js status
  node migrations/migrate.js reset
  node migrations/migrate.js sample

Environment:
  DATABASE_URL         PostgreSQL connection string (required)
        `);
        process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Migration command failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Export functions for use in other scripts
module.exports = {
  migrateUp,
  migrateDown,
  showStatus,
  testConnection,
  createSampleData
};

// Run if called directly
if (require.main === module) {
  main();
}) {
      if (!appliedMigrations.includes(migration.version)) {
        console.log(`⬆️  Applying migration ${migration.version}: ${migration.name}`);
        await migration.up(client);
        await markMigrationApplied(client, migration);
        console.log(`✅ Migration ${migration.version} applied successfully`);
      } else {
        console.log(`⚪ Migration ${migration.version} already applied`);
      }
    }
    
    await client.query('COMMIT');
    console.log('🎉 All migrations completed successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migrations down
async function migrateDown(targetVersion = 0) {
  const client = await pool.connect();
  
  try {
    console.log(`⬇️  Rolling back migrations to version ${targetVersion}...`);
    
    await client.query('BEGIN');
    
    const appliedMigrations = await getAppliedMigrations(client);
    const migrationsToRevert = appliedMigrations
      .filter(version => version > targetVersion)
      .sort((a, b) => b - a); // Reverse order for rollback
    
    for (const version of migrationsToRevert) {
      const migration = migrations.find(m => m.version === version);
      if (migration) {
        console.log(`⬇️  Reverting migration ${version}: ${migration.name}`);
        await migration.down(client);
        await markMigrationReverted(client, version);
        console.log(`✅ Migration ${version} reverted successfully`);
      }
    }
    
    await client.query('COMMIT');
    console.log('🎉 Rollback completed successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Rollback failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Show migration status
async function showStatus() {
  const client = await pool.connect();
  
  try {
    console.log('📊 Migration Status:');
    console.log('==================');
    
    const appliedMigrations = await getAppliedMigrations(client);
    
    for (const migration of migrations