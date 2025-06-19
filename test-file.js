// Simple test suite for Go Leadership App (PostgreSQL)
const path = require('path');
require('dotenv').config();

const { initDatabase, createUser, getActiveUsers, closeDatabase, testConnection } = require('./database');
const { analyzeGoals, testAIService } = require('./aiService');
const { testEmail, verifyEmailConfig } = require('./emailService');
const { testScheduling } = require('./scheduler');

async function runTests() {
    console.log('🧪 Running Go Leadership App Tests (PostgreSQL)\n');
    
    let passedTests = 0;
    let totalTests = 0;
    
    // Test Database Connection
    console.log('🐘 Testing PostgreSQL Connection...');
    totalTests++;
    try {
        const connected = await testConnection();
        if (connected) {
            console.log('✅ PostgreSQL connection: PASSED');
            passedTests++;
        } else {
            console.log('❌ PostgreSQL connection: FAILED');
        }
    } catch (error) {
        console.log('❌ PostgreSQL connection: FAILED', error.message);
    }
    
    // Test Database Initialization
    console.log('\n📊 Testing Database Initialization...');
    totalTests++;
    try {
        await initDatabase();
        console.log('✅ Database initialization: PASSED');
        passedTests++;
    } catch (error) {
        console.log('❌ Database initialization: FAILED', error.message);
    }
    
    // Test user creation
    totalTests++;
    try {
        const testEmail = `test-${Date.now()}@example.com`;
        const userId = await createUser(testEmail, 'America/New_York', 'Test leadership goals for automated testing with PostgreSQL');
        console.log('✅ User creation: PASSED');
        passedTests++;
    } catch (error) {
        console.log('❌ User creation: FAILED', error.message);
    }
    
    // Test AI Service
    console.log('\n🤖 Testing AI Service...');
    totalTests++;
    try {
        if (process.env.OPENAI_API_KEY) {
            const result = await testAIService();
            if (result) {
                console.log('✅ AI Service: PASSED');
                passedTests++;
            } else {
                console.log('❌ AI Service: FAILED');
            }
        } else {
            console.log('⚠️  AI Service: SKIPPED (No API key)');
        }
    } catch (error) {
        console.log('❌ AI Service: FAILED', error.message);
    }
    
    // Test Email Configuration
    console.log('\n📧 Testing Email Service...');
    totalTests++;
    try {
        const emailConfigValid = await verifyEmailConfig();
        if (emailConfigValid) {
            console.log('✅ Email configuration: PASSED');
            passedTests++;
        } else {
            console.log('❌ Email configuration: FAILED');
        }
    } catch (error) {
        console.log('❌ Email configuration: FAILED', error.message);
    }
    
    // Test Scheduling Logic
    console.log('\n⏰ Testing Scheduling...');
    totalTests++;
    try {
        await testScheduling();
        console.log('✅ Scheduling logic: PASSED');
        passedTests++;
    } catch (error) {
        console.log('❌ Scheduling logic: FAILED', error.message);
    }
    
    // Test Goal Analysis (if AI is available)
    if (process.env.OPENAI_API_KEY) {
        console.log('\n🎯 Testing Goal Analysis...');
        totalTests++;
        try {
            const testGoals = "I want to become a better communicator and learn to give constructive feedback to my team members while building trust and improving team dynamics.";
            const result = await analyzeGoals(testGoals);
            if (result.feedback && result.firstAction) {
                console.log('✅ Goal analysis: PASSED');
                console.log(`   Feedback: ${result.feedback.substring(0, 100)}...`);
                console.log(`   Action: ${result.firstAction.substring(0, 100)}...`);
                passedTests++;
            } else {
                console.log('❌ Goal analysis: FAILED - Invalid response format');
            }
        } catch (error) {
            console.log('❌ Goal analysis: FAILED', error.message);
        }
    }
    
    // Test Database Queries
    console.log('\n📋 Testing Database Queries...');
    totalTests++;
    try {
        const users = await getActiveUsers();
        console.log(`✅ Database queries: PASSED (${users.length} active users found)`);
        passedTests++;
    } catch (error) {
        console.log('❌ Database queries: FAILED', error.message);
    }
    
    // Test File Structure
    console.log('\n📁 Testing File Structure...');
    totalTests++;
    try {
        const fs = require('fs');
        const requiredFiles = [
            'server.js',
            'database.js', 
            'aiService.js',
            'emailService.js',
            'scheduler.js',
            'public/index.html',
            'public/style.css',
            'public/script.js',
            'public/admin.html',
            'public/success.html',
            'migrations/migrate.js'
        ];
        
        let missingFiles = [];
        requiredFiles.forEach(file => {
            if (!fs.existsSync(file)) {
                missingFiles.push(file);
            }
        });
        
        if (missingFiles.length === 0) {
            console.log('✅ File structure: PASSED');
            passedTests++;
        } else {
            console.log('❌ File structure: FAILED - Missing files:', missingFiles.join(', '));
        }
    } catch (error) {
        console.log('❌ File structure: FAILED', error.message);
    }
    
    // Test Environment Variables
    console.log('\n🔧 Testing Environment Variables...');
    totalTests++;
    try {
        const requiredVars = ['DATABASE_URL'];
        const missingVars = requiredVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length === 0) {
            console.log('✅ Environment variables: PASSED');
            // Test DATABASE_URL format
            const dbUrl = process.env.DATABASE_URL;
            if (dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')) {
                console.log('✅ DATABASE_URL format: VALID');
                passedTests++;
            } else {
                console.log('❌ DATABASE_URL format: INVALID (should start with postgresql://)');
            }
        } else {
            console.log('❌ Environment variables: MISSING -', missingVars.join(', '));
        }
    } catch (error) {
        console.log('❌ Environment variables: FAILED', error.message);
    }
    
    // Clean up
    try {
        await closeDatabase();
    } catch (error) {
        console.log('⚠️  Database cleanup warning:', error.message);
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All tests passed! Your Go Leadership App is ready for PostgreSQL!');
    } else {
        console.log('⚠️  Some tests failed. Please check the configuration and try again.');
        
        // Provide helpful setup guidance
        console.log('\n💡 PostgreSQL Setup Checklist:');
        console.log('   □ Set DATABASE_URL environment variable');
        console.log('   □ Run database migrations: npm run migrate up');
        console.log('   □ Add your OpenAI API key');
        console.log('   □ Configure email settings');
        console.log('   □ Install dependencies: npm install');
        console.log('   □ Check PostgreSQL connection');
    }
    
    return passedTests === totalTests;
}

// Detailed system check for PostgreSQL
async function systemCheck() {
    console.log('🔍 Go Leadership App System Check (PostgreSQL)\n');
    
    // Check Node.js version
    console.log(`Node.js version: ${process.version}`);
    const nodeVersion = parseInt(process.version.slice(1).split('.')[0]);
    if (nodeVersion >= 18) {
        console.log('✅ Node.js version: Compatible');
    } else {
        console.log('❌ Node.js version: Requires Node.js 18+');
    }
    
    // Check PostgreSQL environment variables
    const requiredEnvVars = ['DATABASE_URL', 'OPENAI_API_KEY', 'EMAIL_USER', 'EMAIL_PASSWORD'];
    console.log('\n📋 Environment Variables:');
    
    requiredEnvVars.forEach(varName => {
        const value = process.env[varName];
        if (value) {
            if (varName === 'DATABASE_URL') {
                const isValidFormat = value.startsWith('postgresql://') || value.startsWith('postgres://');
                console.log(`${isValidFormat ? '✅' : '❌'} ${varName}: ${isValidFormat ? 'Valid PostgreSQL URL' : 'Invalid format'}`);
            } else {
                console.log(`✅ ${varName}: Set (${value.length} characters)`);
            }
        } else {
            console.log(`❌ ${varName}: Missing`);
        }
    });
    
    // Check optional variables
    const optionalEnvVars = ['PORT', 'ADMIN_PASSWORD', 'SMTP_HOST', 'NODE_ENV'];
    console.log('\n📋 Optional Variables:');
    
    optionalEnvVars.forEach(varName => {
        const value = process.env[varName];
        if (value) {
            console.log(`✅ ${varName}: ${value}`);
        } else {
            console.log(`⚪ ${varName}: Using default`);
        }
    });
    
    // Test PostgreSQL connection
    console.log('\n🐘 PostgreSQL Connection:');
    try {
        const connected = await testConnection();
        if (connected) {
            console.log('✅ PostgreSQL connection successful');
        } else {
            console.log('❌ PostgreSQL connection failed');
        }
    } catch (error) {
        console.log('❌ PostgreSQL connection error:', error.message);
    }
    
    // Check file structure
    console.log('\n📁 File Structure:');
    const fs = require('fs');
    const requiredFiles = [
        'server.js',
        'database.js', 
        'aiService.js',
        'emailService.js',
        'scheduler.js',
        'migrations/migrate.js',
        'public/index.html',
        'public/style.css',
        'public/script.js',
        'public/admin.html',
        'public/success.html',
        'package.json',
        '.env.example'
    ];
    
    requiredFiles.forEach(file => {
        if (fs.existsSync(file)) {
            console.log(`✅ ${file}: Found`);
        } else {
            console.log(`❌ ${file}: Missing`);
        }
    });
    
    // Check templates directory
    console.log('\n📧 Email Templates:');
    const templatesDir = 'templates';
    if (fs.existsSync(templatesDir)) {
        console.log(`✅ ${templatesDir}: Directory exists`);
        
        const templateFiles = ['welcome.html', 'weekly.html'];
        templateFiles.forEach(file => {
            const filePath = path.join(templatesDir, file);
            if (fs.existsSync(filePath)) {
                console.log(`✅ ${filePath}: Found`);
            } else {
                console.log(`❌ ${filePath}: Missing`);
            }
        });
    } else {
        console.log(`❌ ${templatesDir}: Directory missing`);
        console.log('💡 Create templates directory and add welcome.html, weekly.html');
    }
    
    // Check dependencies
    console.log('\n📦 Dependencies:');
    try {
        const packageJson = require('./package.json');
        const requiredDeps = ['express', 'pg', 'openai', 'nodemailer', 'node-cron', 'helmet', 'express-rate-limit'];
        
        requiredDeps.forEach(dep => {
            if (packageJson.dependencies[dep]) {
                console.log(`✅ ${dep}: ${packageJson.dependencies[dep]}`);
            } else {
                console.log(`❌ ${dep}: Missing`);
            }
        });
        
        // Check if old sqlite dependency exists
        if (packageJson.dependencies['better-sqlite3'] || packageJson.dependencies['sqlite3']) {
            console.log('⚠️  Old SQLite dependencies found - these should be removed');
        }
        
    } catch (error) {
        console.log('❌ package.json: Error reading file');
    }
    
    // Check migrations
    console.log('\n🗃️  Database Migrations:');
    try {
        const { showStatus } = require('./migrations/migrate');
        await showStatus();
    } catch (error) {
        console.log('❌ Migration check failed:', error.message);
        console.log('💡 Run: npm run migrate up');
    }
    
    // Check port availability
    console.log('\n🌐 Network:');
    const PORT = process.env.PORT || 5000;
    console.log(`📡 Configured port: ${PORT}`);
    console.log(`📱 App URL: http://localhost:${PORT}`);
    console.log(`⚙️  Admin URL: http://localhost:${PORT}/admin`);
    console.log(`🏥 Health URL: http://localhost:${PORT}/health`);
}

// Performance test for PostgreSQL
async function performanceTest() {
    console.log('⚡ PostgreSQL Performance Test\n');
    
    try {
        // Database performance
        console.log('🐘 Testing PostgreSQL performance...');
        const startTime = Date.now();
        
        await initDatabase();
        const dbInitTime = Date.now() - startTime;
        console.log(`✅ Database init: ${dbInitTime}ms`);
        
        // Create multiple test users
        const userCreationStart = Date.now();
        const testUsers = [];
        
        for (let i = 0; i < 10; i++) {
            const email = `perftest-${Date.now()}-${i}@example.com`;
            const userId = await createUser(email, 'America/New_York', `Performance test goals ${i} for PostgreSQL database testing`);
            testUsers.push(userId);
        }
        
        const userCreationTime = Date.now() - userCreationStart;
        console.log(`✅ Created 10 users: ${userCreationTime}ms (${userCreationTime/10}ms per user)`);
        
        // Query performance
        const queryStart = Date.now();
        const users = await getActiveUsers();
        const queryTime = Date.now() - queryStart;
        console.log(`✅ Query ${users.length} users: ${queryTime}ms`);
        
        // Connection pool test
        const poolTestStart = Date.now();
        const promises = [];
        for (let i = 0; i < 5; i++) {
            promises.push(getActiveUsers());
        }
        await Promise.all(promises);
        const poolTestTime = Date.now() - poolTestStart;
        console.log(`✅ 5 concurrent queries: ${poolTestTime}ms`);
        
        await closeDatabase();
        
    } catch (error) {
        console.log('❌ Performance test failed:', error.message);
    }
}

// Integration test for PostgreSQL
async function integrationTest() {
    console.log('🔗 PostgreSQL Integration Test\n');
    
    try {
        // Test full user journey
        console.log('👤 Testing complete user journey...');
        
        const testEmail = `integration-${Date.now()}@example.com`;
        const testGoals = "Integration test with PostgreSQL: I want to improve my leadership communication skills and build better team relationships using database-driven insights.";
        
        // 1. Create user
        const userId = await createUser(testEmail, 'America/New_York', testGoals);
        console.log(`✅ Step 1: User created (ID: ${userId})`);
        
        // 2. Test AI goal analysis (if available)
        if (process.env.OPENAI_API_KEY) {
            const aiResult = await analyzeGoals(testGoals);
            if (aiResult.feedback && aiResult.firstAction) {
                console.log('✅ Step 2: AI goal analysis completed');
            } else {
                console.log('❌ Step 2: AI goal analysis failed');
            }
        } else {
            console.log('⚪ Step 2: AI goal analysis skipped (no API key)');
        }
        
        // 3. Test email system (if configured)
        if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
            const emailTest = await testEmail('test@example.com');
            if (emailTest) {
                console.log('✅ Step 3: Email system working');
            } else {
                console.log('❌ Step 3: Email system failed');
            }
        } else {
            console.log('⚪ Step 3: Email test skipped (no email config)');
        }
        
        // 4. Test database queries
        const users = await getActiveUsers();
        const foundUser = users.find(u => u.id === userId);
        if (foundUser) {
            console.log('✅ Step 4: PostgreSQL queries working');
        } else {
            console.log('❌ Step 4: PostgreSQL queries failed');
        }
        
        console.log('🎉 PostgreSQL integration test completed');
        
    } catch (error) {
        console.log('❌ Integration test failed:', error.message);
    }
}

// Main test runner
async function main() {
    const args = process.argv.slice(2);
    
    try {
        if (args.includes('--check') || args.includes('-c')) {
            await systemCheck();
        } else if (args.includes('--performance') || args.includes('-p')) {
            await performanceTest();
        } else if (args.includes('--integration') || args.includes('-i')) {
            await integrationTest();
        } else if (args.includes('--all') || args.includes('-a')) {
            console.log('🚀 Running Complete PostgreSQL Test Suite\n');
            await systemCheck();
            console.log('\n' + '='.repeat(50) + '\n');
            const success = await runTests();
            console.log('\n' + '='.repeat(50) + '\n');
            await integrationTest();
            console.log('\n' + '='.repeat(50) + '\n');
            await performanceTest();
            process.exit(success ? 0 : 1);
        } else {
            const success = await runTests();
            process.exit(success ? 0 : 1);
        }
    } catch (error) {
        console.error('Test runner error:', error);
        process.exit(1);
    }
}

// Display help
function showHelp() {
    console.log(`
🧪 Go Leadership App Test Suite (PostgreSQL)

Usage: node test.js [options]

Options:
  (no options)     Run basic functionality tests
  -c, --check      Run system check only
  -p, --performance Run performance tests
  -i, --integration Run integration tests
  -a, --all        Run complete test suite
  -h, --help       Show this help

Examples:
  npm test                    # Run basic tests
  npm run test -- --check     # System check
  npm run test -- --all       # Complete test suite

PostgreSQL Setup:
  npm run migrate up          # Run database migrations
  npm run migrate sample      # Create sample data
  npm run migrate status      # Check migration status
`);
}

// Run tests if called directly
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        showHelp();
        process.exit(0);
    }
    
    main().catch(error => {
        console.error('Test runner error:', error);
        process.exit(1);
    });
}

module.exports = { 
    runTests, 
    systemCheck, 
    performanceTest, 
    integrationTest 
};
const { analyzeGoals, testAIService } = require('./aiService');
const { testEmail, verifyEmailConfig } = require('./emailService');
const { testScheduling } = require('./scheduler');

async function runTests() {
    console.log('🧪 Running Go Leadership App Tests\n');
    
    let passedTests = 0;
    let totalTests = 0;
    
    // Test Database
    console.log('📊 Testing Database...');
    totalTests++;
    try {
        await initDatabase();
        console.log('✅ Database initialization: PASSED');
        passedTests++;
    } catch (error) {
        console.log('❌ Database initialization: FAILED', error.message);
    }
    
    // Test user creation
    totalTests++;
    try {
        const testEmail = `test-${Date.now()}@example.com`;
        const userId = await createUser(testEmail, 'America/New_York', 'Test leadership goals for automated testing');
        console.log('✅ User creation: PASSED');
        passedTests++;
    } catch (error) {
        console.log('❌ User creation: FAILED', error.message);
    }
    
    // Test AI Service
    console.log('\n🤖 Testing AI Service...');
    totalTests++;
    try {
        if (process.env.OPENAI_API_KEY) {
            const result = await testAIService();
            if (result) {
                console.log('✅ AI Service: PASSED');
                passedTests++;
            } else {
                console.log('❌ AI Service: FAILED');
            }
        } else {
            console.log('⚠️  AI Service: SKIPPED (No API key)');
        }
    } catch (error) {
        console.log('❌ AI Service: FAILED', error.message);
    }
    
    // Test Email Configuration
    console.log('\n📧 Testing Email Service...');
    totalTests++;
    try {
        const emailConfigValid = await verifyEmailConfig();
        if (emailConfigValid) {
            console.log('✅ Email configuration: PASSED');
            passedTests++;
        } else {
            console.log('❌ Email configuration: FAILED');
        }
    } catch (error) {
        console.log('❌ Email configuration: FAILED', error.message);
    }
    
    // Test Scheduling Logic
    console.log('\n⏰ Testing Scheduling...');
    totalTests++;
    try {
        await testScheduling();
        console.log('✅ Scheduling logic: PASSED');
        passedTests++;
    } catch (error) {
        console.log('❌ Scheduling logic: FAILED', error.message);
    }
    
    // Test Goal Analysis (if AI is available)
    if (process.env.OPENAI_API_KEY) {
        console.log('\n🎯 Testing Goal Analysis...');
        totalTests++;
        try {
            const testGoals = "I want to become a better communicator and learn to give constructive feedback to my team members while building trust.";
            const result = await analyzeGoals(testGoals);
            if (result.feedback && result.firstAction) {
                console.log('✅ Goal analysis: PASSED');
                console.log(`   Feedback: ${result.feedback.substring(0, 100)}...`);
                console.log(`   Action: ${result.firstAction.substring(0, 100)}...`);
                passedTests++;
            } else {
                console.log('❌ Goal analysis: FAILED - Invalid response format');
            }
        } catch (error) {
            console.log('❌ Goal analysis: FAILED', error.message);
        }
    }
    
    // Test Database Queries
    console.log('\n📋 Testing Database Queries...');
    totalTests++;
    try {
        const users = await getActiveUsers();
        console.log(`✅ Database queries: PASSED (${users.length} active users found)`);
        passedTests++;
    } catch (error) {
        console.log('❌ Database queries: FAILED', error.message);
    }
    
    // Test File Structure
    console.log('\n📁 Testing File Structure...');
    totalTests++;
    try {
        const fs = require('fs');
        const requiredFiles = [
            'server.js',
            'database.js', 
            'aiService.js',
            'emailService.js',
            'scheduler.js',
            'public/index.html',
            'public/style.css',
            'public/script.js',
            'public/admin.html',
            'public/success.html'
        ];
        
        let missingFiles = [];
        requiredFiles.forEach(file => {
            if (!fs.existsSync(file)) {
                missingFiles.push(file);
            }
        });
        
        if (missingFiles.length === 0) {
            console.log('✅ File structure: PASSED');
            passedTests++;
        } else {
            console.log('❌ File structure: FAILED - Missing files:', missingFiles.join(', '));
        }
    } catch (error) {
        console.log('❌ File structure: FAILED', error.message);
    }
    
    // Clean up
    try {
        closeDatabase();
    } catch (error) {
        console.log('⚠️  Database cleanup warning:', error.message);
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All tests passed! Your Go Leadership App is ready to go!');
    } else {
        console.log('⚠️  Some tests failed. Please check the configuration and try again.');
        
        // Provide helpful setup guidance
        console.log('\n💡 Setup Checklist:');
        console.log('   □ Create .env file from .env.example');
        console.log('   □ Add your OpenAI API key');
        console.log('   □ Configure email settings');
        console.log('   □ Install dependencies: npm install');
        console.log('   □ Create templates directory');
        console.log('   □ Check file permissions');
    }
    
    return passedTests === totalTests;
}

// Detailed system check
async function systemCheck() {
    console.log('🔍 Go Leadership App System Check\n');
    
    // Check Node.js version
    console.log(`Node.js version: ${process.version}`);
    const nodeVersion = parseInt(process.version.slice(1).split('.')[0]);
    if (nodeVersion >= 18) {
        console.log('✅ Node.js version: Compatible');
    } else {
        console.log('❌ Node.js version: Requires Node.js 18+');
    }
    
    // Check environment variables
    const requiredEnvVars = ['OPENAI_API_KEY', 'EMAIL_USER', 'EMAIL_PASSWORD'];
    console.log('\n📋 Environment Variables:');
    
    requiredEnvVars.forEach(varName => {
        const value = process.env[varName];
        if (value) {
            console.log(`✅ ${varName}: Set (${value.length} characters)`);
        } else {
            console.log(`❌ ${varName}: Missing`);
        }
    });
    
    // Check optional variables
    const optionalEnvVars = ['PORT', 'ADMIN_PASSWORD', 'SMTP_HOST', 'NODE_ENV'];
    console.log('\n📋 Optional Variables:');
    
    optionalEnvVars.forEach(varName => {
        const value = process.env[varName];
        if (value) {
            console.log(`✅ ${varName}: ${value}`);
        } else {
            console.log(`⚪ ${varName}: Using default`);
        }
    });
    
    // Check file structure
    console.log('\n📁 File Structure:');
    const fs = require('fs');
    const requiredFiles = [
        'server.js',
        'database.js', 
        'aiService.js',
        'emailService.js',
        'scheduler.js',
        'public/index.html',
        'public/style.css',
        'public/script.js',
        'public/admin.html',
        'public/success.html',
        'package.json',
        '.env.example'
    ];
    
    requiredFiles.forEach(file => {
        if (fs.existsSync(file)) {
            console.log(`✅ ${file}: Found`);
        } else {
            console.log(`❌ ${file}: Missing`);
        }
    });
    
    // Check templates directory
    console.log('\n📧 Email Templates:');
    const templatesDir = 'templates';
    if (fs.existsSync(templatesDir)) {
        console.log(`✅ ${templatesDir}: Directory exists`);
        
        const templateFiles = ['welcome.html', 'weekly.html'];
        templateFiles.forEach(file => {
            const filePath = path.join(templatesDir, file);
            if (fs.existsSync(filePath)) {
                console.log(`✅ ${filePath}: Found`);
            } else {
                console.log(`❌ ${filePath}: Missing`);
            }
        });
    } else {
        console.log(`❌ ${templatesDir}: Directory missing`);
        console.log('💡 Create templates directory and add welcome.html, weekly.html');
    }
    
    // Check dependencies
    console.log('\n📦 Dependencies:');
    try {
        const packageJson = require('./package.json');
        const requiredDeps = ['express', 'better-sqlite3', 'openai', 'nodemailer', 'node-cron', 'helmet', 'express-rate-limit'];
        
        requiredDeps.forEach(dep => {
            if (packageJson.dependencies[dep]) {
                console.log(`✅ ${dep}: ${packageJson.dependencies[dep]}`);
            } else {
                console.log(`❌ ${dep}: Missing`);
            }
        });
    } catch (error) {
        console.log('❌ package.json: Error reading file');
    }
    
    // Check port availability
    console.log('\n🌐 Network:');
    const PORT = process.env.PORT || 5000;
    console.log(`📡 Configured port: ${PORT}`);
    console.log(`📱 App URL: http://localhost:${PORT}`);
    console.log(`⚙️  Admin URL: http://localhost:${PORT}/admin`);
    console.// Simple test suite for Go Leadership App
const { initDatabase, createUser, getActiveUsers } = require('./database');
const { analyzeGoals, testAIService } = require('./aiService');
const { testEmail, verifyEmailConfig } = require('./emailService');
const { testScheduling } = require('./scheduler');

async function runTests() {
    console.log('🧪 Running Go Leadership App Tests\n');
    
    let passedTests = 0;
    let totalTests = 0;
    
    // Test Database
    console.log('📊 Testing Database...');
    totalTests++;
    try {
        await initDatabase();
        console.log('✅ Database initialization: PASSED');
        passedTests++;
    } catch (error) {
        console.log('❌ Database initialization: FAILED', error.message);
    }
    
    // Test user creation
    totalTests++;
    try {
        const testEmail = `test-${Date.now()}@example.com`;
        const userId = await createUser(testEmail, 'America/New_York', 'Test leadership goals');
        console.log('✅ User creation: PASSED');
        passedTests++;
    } catch (error) {
        console.log('❌ User creation: FAILED', error.message);
    }
    
    // Test AI Service
    console.log('\n🤖 Testing AI Service...');
    totalTests++;
    try {
        if (process.env.OPENAI_API_KEY) {
            const result = await testAIService();
            if (result) {
                console.log('✅ AI Service: PASSED');
                passedTests++;
            } else {
                console.log('❌ AI Service: FAILED');
            }
        } else {
            console.log('⚠️  AI Service: SKIPPED (No API key)');
        }
    } catch (error) {
        console.log('❌ AI Service: FAILED', error.message);
    }
    
    // Test Email Configuration
    console.log('\n📧 Testing Email Service...');
    totalTests++;
    try {
        const emailConfigValid = await verifyEmailConfig();
        if (emailConfigValid) {
            console.log('✅ Email configuration: PASSED');
            passedTests++;
        } else {
            console.log('❌ Email configuration: FAILED');
        }
    } catch (error) {
        console.log('❌ Email configuration: FAILED', error.message);
    }
    
    // Test Scheduling Logic
    console.log('\n⏰ Testing Scheduling...');
    totalTests++;
    try {
        await testScheduling();
        console.log('✅ Scheduling logic: PASSED');
        passedTests++;
    } catch (error) {
        console.log('❌ Scheduling logic: FAILED', error.message);
    }
    
    // Test Goal Analysis (if AI is available)
    if (process.env.OPENAI_API_KEY) {
        console.log('\n🎯 Testing Goal Analysis...');
        totalTests++;
        try {
            const testGoals = "I want to become a better communicator and learn to give constructive feedback.";
            const result = await analyzeGoals(testGoals);
            if (result.feedback && result.firstAction) {
                console.log('✅ Goal analysis: PASSED');
                console.log(`   Feedback: ${result.feedback.substring(0, 100)}...`);
                console.log(`   Action: ${result.firstAction.substring(0, 100)}...`);
                passedTests++;
            } else {
                console.log('❌ Goal analysis: FAILED - Invalid response format');
            }
        } catch (error) {
            console.log('❌ Goal analysis: FAILED', error.message);
        }
    }
    
    // Test Database Queries
    console.log('\n📋 Testing Database Queries...');
    totalTests++;
    try {
        const users = await getActiveUsers();
        console.log(`✅ Database queries: PASSED (${users.length} active users found)`);
        passedTests++;
    } catch (error) {
        console.log('❌ Database queries: FAILED', error.message);
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log('🎉 All tests passed! Your Go Leadership App is ready to go!');
    } else {
        console.log('⚠️  Some tests failed. Please check the configuration and try again.');
        
        // Provide helpful setup guidance
        console.log('\n💡 Setup Checklist:');
        console.log('   □ Create .env file from .env.example');
        console.log('   □ Add your OpenAI API key');
        console.log('   □ Configure email settings');
        console.log('   □ Install dependencies: npm install');
        console.log('   □ Check database permissions');
    }
    
    return passedTests === totalTests;
}

// Detailed system check
async function systemCheck() {
    console.log('🔍 Go Leadership App System Check\n');
    
    // Check Node.js version
    console.log(`Node.js version: ${process.version}`);
    
    // Check environment variables
    const requiredEnvVars = ['OPENAI_API_KEY', 'EMAIL_USER', 'EMAIL_PASSWORD'];
    console.log('\n📋 Environment Variables:');
    
    requiredEnvVars.forEach(varName => {
        const value = process.env[varName];
        if (value) {
            console.log(`✅ ${varName}: Set`);
        } else {
            console.log(`❌ ${varName}: Missing`);
        }
    });
    
    // Check optional variables
    const optionalEnvVars = ['PORT', 'ADMIN_PASSWORD', 'SMTP_HOST'];
    console.log('\n📋 Optional Variables:');
    
    optionalEnvVars.forEach(varName => {
        const value = process.env[varName];
        if (value) {
            console.log(`✅ ${varName}: Set`);
        } else {
            console.log(`⚪ ${varName}: Using default`);
        }
    });
    
    // Check file structure
    console.log('\n📁 File Structure:');
    const fs = require('fs');
    const requiredFiles = [
        'server.js',
        'database.js', 
        'aiService.js',
        'emailService.js',
        'scheduler.js',
        'public/index.html',
        'public/style.css',
        'public/script.js'
    ];
    
    requiredFiles.forEach(file => {
        if (fs.existsSync(file)) {
            console.log(`✅ ${file}: Found`);
        } else {
            console.log(`❌ ${file}: Missing`);
        }
    });
    
    // Check dependencies
    console.log('\n📦 Dependencies:');
    const packageJson = require('./package.json');
    const requiredDeps = ['express', 'sqlite3', 'openai', 'nodemailer', 'node-cron'];
    
    requiredDeps.forEach(dep => {
        if (packageJson.dependencies[dep]) {
            console.log(`✅ ${dep}: ${packageJson.dependencies[dep]}`);
        } else {
            console.log(`❌ ${dep}: Missing`);
        }
    });
}

// Main test runner
async function main() {
    const args = process.argv.slice(2);
    
    if (args.includes('--check') || args.includes('-c')) {
        await systemCheck();
    } else {
        const success = await runTests();
        process.exit(success ? 0 : 1);
    }
}

// Run tests if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('Test runner error:', error);
        process.exit(1);
    });
}

module.exports = { runTests, systemCheck };