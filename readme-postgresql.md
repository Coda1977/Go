# Go Leadership App (PostgreSQL)

A 12-week leadership follow-through app that sends personalized, AI-generated emails to help users achieve their leadership goals. Built with Node.js, Express, PostgreSQL 15, and OpenAI GPT-4.

## 🌟 Features

- **Personalized AI Coaching**: GPT-4 powered goal analysis and weekly action items
- **Timezone-Aware Scheduling**: Sends emails at 9 AM local time every Monday
- **PostgreSQL Database**: Scalable, ACID-compliant data storage with connection pooling
- **Beautiful Email Templates**: Professional HTML emails with progress tracking
- **Admin Dashboard**: Comprehensive user management and analytics
- **IDEO-Inspired Design**: Clean, sophisticated user interface
- **Production Ready**: Security headers, rate limiting, error handling

## 🐘 PostgreSQL Advantages

- **Scalability**: Handles thousands of users with connection pooling
- **Data Integrity**: ACID compliance ensures reliable data storage
- **Performance**: Advanced indexing and query optimization
- **Reliability**: Battle-tested in production environments
- **Replit Compatible**: Perfect for Replit's PostgreSQL 15 offering

## 🚀 Quick Start (Replit)

### 1. Fork/Import to Replit
- Fork this repository to your Replit account
- Replit will automatically provide PostgreSQL 15

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables
```bash
npm run setup
```
This interactive script will help you configure:
- OpenAI API key
- Email settings
- Admin password
- DATABASE_URL (automatically provided by Replit)

### 4. Run Database Migrations
```bash
npm run migrate up
```

### 5. (Optional) Create Sample Data
```bash
npm run migrate sample
```

### 6. Start the Application
```bash
npm start
```

Your app will be available at `http://localhost:5000`

## 📊 Database Schema

### Users Table
```sql
CREATE TABLE users (
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
);
```

### Email History Table
```sql
CREATE TABLE email_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  subject TEXT,
  content TEXT,
  action_item TEXT,
  sent_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  delivery_status VARCHAR(50) DEFAULT 'sent',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🛠️ Available Scripts

### Application
- `npm start` - Start the application
- `npm run dev` - Start with nodemon for development
- `npm run setup` - Interactive setup script

### Database
- `npm run migrate up` - Apply all pending migrations
- `npm run migrate down [version]` - Rollback to specific version
- `npm run migrate status` - Show migration status
- `npm run migrate reset` - Reset database (down to 0, then up)
- `npm run migrate sample` - Create sample data
- `npm run migrate test` - Test database connection

### Testing
- `npm test` - Run basic functionality tests
- `npm run test -- --all` - Run complete test suite
- `npm run test -- --check` - System configuration check
- `npm run system-check` - Database and environment check

### Development
- `npm run test-email` - Test email functionality
- `npm run test-ai` - Test AI service
- `npm run test-scheduling` - Test scheduling logic

## 🔧 Environment Variables

Create a `.env` file with these variables:

```env
# PostgreSQL Database (provided by Replit)
DATABASE_URL=postgresql://username:password@localhost:5432/database_name

# OpenAI API
OPENAI_API_KEY=your_openai_api_key_here

# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your_app_password_here

# Server
PORT=5000
NODE_ENV=development

# Admin
ADMIN_PASSWORD=secure_admin_password
```

## 🗃️ Database Migrations

The app uses a custom migration system for PostgreSQL:

### Migration Commands
```bash
# Apply all pending migrations
npm run migrate up

# Check what migrations are applied
npm run migrate status

# Rollback to specific version
npm run migrate down 2

# Reset entire database
npm run migrate reset

# Create sample test data
npm run migrate sample
```

### Migration Files
Migrations are stored in `migrations/migrate.js` and include:
1. **Initial tables** - Users and email_history tables
2. **Indexes** - Performance optimization indexes
3. **Triggers** - Auto-update timestamps
4. **Migration tracking** - Track applied migrations

## 📧 Email System

### Templates
- `templates/welcome.html` - Welcome email with goal analysis
- `templates/weekly.html` - Weekly action item emails

### Email Features
- HTML templates with progress bars
- Timezone-aware delivery (9 AM local time)
- Retry logic with exponential backoff
- Delivery status tracking
- Admin manual email sending

## 🎯 How It Works

1. **User Signup**: User enters email and leadership goals
2. **AI Analysis**: GPT-4 analyzes goals and provides feedback
3. **Welcome Email**: Immediate personalized welcome with first action
4. **Weekly Emails**: Every Monday at 9 AM local time for 12 weeks
5. **Progress Tracking**: Each email builds on previous actions
6. **Completion**: 12-week transformation journey completed

## 🔒 Security Features

- **Helmet.js**: Security headers
- **Rate Limiting**: Prevents abuse and DDoS
- **Input Validation**: Sanitizes all user inputs
- **SQL Injection Prevention**: Parameterized queries
- **Environment Variables**: Secure credential storage

## 📱 Admin Dashboard

Access at `/admin` with features:
- User management and statistics
- Email scheduling and history
- Manual email sending
- System health monitoring
- Database analytics

## 🧪 Testing

Comprehensive test suite includes:
- Database connection and queries
- AI service functionality
- Email delivery
- Scheduling logic
- Security validation
- Performance benchmarks

## 🔄 Scheduling System

- **Cron Jobs**: Hourly checks for users needing emails
- **Timezone Handling**: Respects user's local timezone
- **Smart Logic**: Prevents duplicate emails
- **Error Handling**: Continues with other users if one fails
- **Manual Triggers**: Admin can send emails manually

## 📊 Performance

PostgreSQL optimizations:
- **Connection Pooling**: Efficient database connections
- **Prepared Statements**: Faster query execution
- **Indexes**: Optimized for common queries
- **Transactions**: ACID compliance for data integrity

## 🚀 Deployment

### Replit (Recommended)
1. Fork repository to Replit
2. Run `npm run setup`
3. Run `npm run migrate up`
4. Start with `npm start`

### Other Platforms
1. Set `DATABASE_URL` to your PostgreSQL connection string
2. Follow the same setup process
3. Ensure PostgreSQL 15+ compatibility

## 🛟 Troubleshooting

### Database Issues
```bash
# Test database connection
npm run migrate test

# Check migration status
npm run migrate status

# Reset database
npm run migrate reset
```

### Common Problems
- **DATABASE_URL not set**: Check environment variables
- **Migration errors**: Ensure PostgreSQL is accessible
- **Email failures**: Verify SMTP credentials
- **AI errors**: Check OpenAI API key

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Run tests: `npm run test -- --all`
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 📞 Support

- 🐛 **Issues**: GitHub Issues
- 📧 **Email**: support@go-leadership.app
- 📚 **Docs**: This README and inline comments

---

**Built with ❤️ for leaders who want to transform their potential into performance**