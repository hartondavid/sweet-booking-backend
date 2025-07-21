// app.js - Complete version with database functionality

import express from "express"
import dotenv from 'dotenv'
import cors from 'cors'
import db from './src/utils/database.mjs'
import corsOptions from './middleware.js'
import { readdirSync } from 'fs'
import { join } from 'path'

// Ensure migrations and seeds are included in deployment by referencing them
try {
    const migrationsDir = join(process.cwd(), 'migrations')
    const seedsDir = join(process.cwd(), 'seeds')

    // This will throw an error if directories don't exist, ensuring they're included
    const migrationFiles = readdirSync(migrationsDir)
    const seedFiles = readdirSync(seedsDir)

    console.log('📁 Migration files found:', migrationFiles.length)
    console.log('📁 Seed files found:', seedFiles.length)
} catch (error) {
    console.log('⚠️ Could not read migrations/seeds directories:', error.message)
}

const app = express();

// Load environment variables (but don't crash if .env doesn't exist)
try {
    dotenv.config()
} catch (error) {
    console.log('No .env file found, using environment variables');
}

// Basic middleware
app.use(express.json());

// Add CORS for frontend access - Direct configuration (Updated for Vercel deployment)
app.use((req, res, next) => {
    console.log(`🌐 ${req.method} ${req.url} - Origin: ${req.headers.origin || 'none'}`);

    // Set CORS headers for all requests - allow frontend domain and subdomains
    const origin = req.headers.origin;
    console.log('🔍 CORS Debug - Origin:', origin);
    console.log('🔍 CORS Debug - Starts with sweet-booking-frontend:', origin?.startsWith('https://sweet-booking-frontend.vercel.app'));
    console.log('🔍 CORS Debug - Starts with localhost:', origin?.startsWith('http://localhost:'));

    if (origin && (
        origin.startsWith('https://sweet-booking-frontend.vercel.app') ||
        origin.startsWith('http://localhost:') ||
        origin === 'https://sweet-booking-frontend-kem59jbf1.vercel.app'
    )) {
        console.log('✅ CORS Debug - Setting origin to:', origin);
        res.header('Access-Control-Allow-Origin', origin);
    } else {
        console.log('⚠️ CORS Debug - Using default origin');
        res.header('Access-Control-Allow-Origin', 'https://sweet-booking-frontend-kem59jbf1.vercel.app');
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.header('Access-Control-Expose-Headers', 'X-Auth-Token, X-Total-Count');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        console.log('🔄 OPTIONS preflight request handled');
        res.sendStatus(200);
        return;
    }

    next();
});

// CORS is already handled by the custom middleware above
// app.use(cors(corsOptions)); // Commented out to avoid conflicts

// Run migrations before starting the server
const runMigrations = async () => {
    try {
        console.log('🔄 Starting database setup...');

        // First, test database connection
        console.log('🔌 Testing database connection...');
        const knex = await db();
        console.log('✅ Database connection successful');

        // Check if database exists and show tables
        try {
            const tables = await knex.raw("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
            console.log('📋 Existing tables:', tables.rows.map(table => table.tablename));
        } catch (error) {
            console.log('⚠️ Could not check tables:', error.message);
        }

        console.log('🔄 Running migrations...');
        const dbInstance = await db();
        await dbInstance.migrate.latest();
        console.log('✅ Migrations completed successfully');

        // Check tables after migrations
        try {
            const tablesAfter = await knex.raw("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
            console.log('📋 Tables after migrations:', tablesAfter.rows.map(table => table.tablename));
        } catch (error) {
            console.log('⚠️ Could not check tables after migrations:', error.message);
        }

        // Run seeds after migrations
        console.log('🌱 Running database seeds...');
        await dbInstance.seed.run();
        console.log('✅ Seeds completed successfully');

        // Check data after seeds
        try {
            const users = await knex('users').select('id', 'name', 'email');
            console.log('👥 Users after seeds:', users);
        } catch (error) {
            console.log('⚠️ Could not check users after seeds:', error.message);
        }

        return true;
    } catch (error) {
        console.error('❌ Migration/Seed failed:', error.message);
        console.error('🔍 Error details:', error.stack);
        return false;
    }
};

// Function to run seed files
const runSeeds = async (options = {}) => {
    try {
        console.log('🌱 Starting seed execution...');

        // Get database connection
        const knex = await db();

        // Default options
        const seedOptions = {
            specific: options.specific,
            directory: options.directory || './seeds',
            loadExtensions: options.loadExtensions || ['.js', '.cjs'],
            recursive: options.recursive !== false
        };

        if (options.specific) {
            console.log(`📦 Running specific seed: ${options.specific}`);
            await knex.seed.run({ specific: options.specific });
            console.log(`✅ Seed ${options.specific} completed successfully`);
        } else {
            console.log('📦 Running all seeds...');
            await knex.seed.run(seedOptions);
            console.log('✅ All seeds completed successfully');
        }

        // Verify seed data if requested
        if (options.verify) {
            console.log('🔍 Verifying seed data...');
            try {
                const users = await knex('users').select('id', 'name', 'email');
                const rights = await knex('rights').select('id', 'name', 'right_code');
                const userRights = await knex('user_rights').select('*');

                console.log('👥 Users seeded:', users.length);
                console.log('🔐 Rights seeded:', rights.length);
                console.log('🔗 User rights seeded:', userRights.length);
            } catch (error) {
                console.log('⚠️ Could not verify seed data:', error.message);
            }
        }

        return true;
    } catch (error) {
        console.error('❌ Seed execution failed:', error.message);
        console.error('🔍 Error details:', error.stack);
        return false;
    }
};


// Import API routes (with error handling)
let apiRoutes = null;
try {
    // Run migrations first
    const migrationsSuccess = await runMigrations();
    if (!migrationsSuccess) {
        console.log('⚠️ Continuing without database migrations');
    }

    const { default: apiRoute } = await import('./src/routes/apiRoute.mjs');
    apiRoutes = apiRoute;
    console.log('✅ Database API routes loaded successfully');
} catch (error) {
    console.log('⚠️ Database API routes not available, using simplified version');
    console.log('🔍 Error:', error.message);
}

// Use API routes if available, otherwise use simplified routes
if (apiRoutes) {
    app.use('/api', apiRoutes);
    console.log('📡 Full API available at /api/*');
} else {
    console.log('📡 Using simplified API (no database)');
}



// Simple test route
app.get('/test', (req, res) => {
    console.log('Test route accessed');
    res.json({
        message: 'Test route working!',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production',
        port: process.env.PORT || 8080,
        database: apiRoutes ? 'connected' : 'not connected (simplified version)'
    });
});

// Root route
app.get('/', (req, res) => {
    console.log('Root route accessed');
    res.json({
        message: 'Delivery Backend API',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production',
        port: process.env.PORT || 8080,
        database: apiRoutes ? 'connected' : 'not connected (simplified version)',
        endpoints: {
            test: '/test',
            health: '/health',
            api: apiRoutes ? '/api/*' : 'not available (simplified version)'
        }
    });
});

// Simple health check route
app.get('/health', (req, res) => {
    console.log('Health route accessed');
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'production',
        port: process.env.PORT || 8080,
        database: apiRoutes ? 'connected' : 'not connected (simplified version)'
    });
});

// CORS test endpoint
app.get('/cors-test', (req, res) => {
    console.log('CORS test route accessed');
    console.log('Request origin:', req.headers.origin);
    console.log('Request method:', req.method);
    console.log('Request headers:', req.headers);

    res.json({
        message: 'CORS test successful - Updated with subdomain support',
        timestamp: new Date().toISOString(),
        origin: req.headers.origin,
        method: req.method,
        corsConfigured: true,
        deployment: 'latest',
        subdomainSupport: true
    });
});



// Test database endpoint (not protected)
app.get('/test-db', async (req, res) => {
    try {
        console.log('🔍 Testing database connection...');

        // Test database connection
        const knex = await db();
        await knex.raw('SELECT 1');
        console.log('✅ Database connection successful');

        // Check if migrations table exists
        console.log('📋 Checking migrations table...');
        const migrationsTable = await knex.raw("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'knex_migrations'");
        const hasMigrationsTable = migrationsTable.rows.length > 0;
        console.log('📋 Migrations table exists:', hasMigrationsTable);

        // Check current migration status
        let currentVersion = 'none';
        let migrationHistory = [];
        if (hasMigrationsTable) {
            try {
                currentVersion = await knex.migrate.currentVersion();
                migrationHistory = await knex('knex_migrations').select('*').orderBy('id');
                console.log('📋 Current migration version:', currentVersion);
                console.log('📋 Migration history:', migrationHistory);
            } catch (error) {
                console.log('⚠️ Could not check migration status:', error.message);
            }
        }

        // Check all tables
        const tables = await knex.raw("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
        console.log('📋 All tables:', tables.rows.map(table => table.tablename));

        // Try to get users (this will fail if table doesn't exist)
        let users = [];
        let usersError = null;
        try {
            users = await knex('users').select('id', 'name', 'email', 'phone');
            console.log('📋 Found users:', users.length);
        } catch (error) {
            usersError = error.message;
            console.log('❌ Users table error:', error.message);
        }

        res.json({
            success: true,
            message: "Database test completed",
            data: {
                connection: 'successful',
                migrationsTableExists: hasMigrationsTable,
                currentMigrationVersion: currentVersion,
                migrationHistory: migrationHistory,
                allTables: tables.rows.map(table => table.tablename),
                usersTableExists: !usersError,
                usersCount: users.length,
                users: users,
                usersError: usersError
            }
        });
    } catch (error) {
        console.error("Database test error:", error);
        res.status(500).json({
            success: false,
            message: "Database test failed",
            data: {
                error: error.message,
                stack: error.stack
            }
        });
    }
});

// Manual migration endpoint (not protected) - for emergency use
app.post('/run-migrations', async (req, res) => {
    try {
        console.log('🔄 Manually running migrations...');

        // Get database connection
        const dbInstance = await db();
        console.log('✅ Database connection established');

        // Check current migration status
        console.log('📋 Checking current migration status...');
        const currentVersion = await dbInstance.migrate.currentVersion();
        console.log('📋 Current migration version:', currentVersion);

        // Check what migrations are available
        const migrationList = await dbInstance.migrate.list();
        console.log('📋 Available migrations:', migrationList);

        // Run migrations with detailed logging
        console.log('🔄 Running migrations...');
        const [batchNo, log] = await dbInstance.migrate.latest();
        console.log('📋 Migration batch number:', batchNo);
        console.log('📋 Migration log:', log);

        // Check tables after migrations
        const knex = await db();
        const tables = await knex.raw("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
        console.log('📋 Tables after manual migrations:', tables.rows.map(table => table.tablename));

        // Verify specific tables exist
        const hasUsersTable = tables.rows.some(table => table.tablename === 'users');
        console.log('📋 Users table exists:', hasUsersTable);

        res.json({
            success: true,
            message: "Manual migrations completed successfully",
            data: {
                batchNumber: batchNo,
                migrationsRun: log,
                tables: tables.rows.map(table => table.tablename),
                usersTableExists: hasUsersTable
            }
        });
    } catch (error) {
        console.error("Manual migration error:", error);
        console.error("Error stack:", error.stack);
        res.status(500).json({
            success: false,
            message: "Manual migration failed",
            data: {
                error: error.message,
                stack: error.stack,
                details: "Check server logs for more information"
            }
        });
    }
});

// GET version of run-migrations for browser access
app.get('/run-migrations', async (req, res) => {
    try {
        console.log('🔄 Manually running migrations via GET...');

        // Get database connection
        const dbInstance = await db();
        console.log('✅ Database connection established');

        // Check current migration status
        console.log('📋 Checking current migration status...');
        const currentVersion = await dbInstance.migrate.currentVersion();
        console.log('📋 Current migration version:', currentVersion);

        // Check what migrations are available
        const migrationList = await dbInstance.migrate.list();
        console.log('📋 Available migrations:', migrationList);

        // Run migrations with detailed logging
        console.log('🔄 Running migrations...');
        const [batchNo, log] = await dbInstance.migrate.latest();
        console.log('📋 Migration batch number:', batchNo);
        console.log('📋 Migration log:', log);

        // Check tables after migrations
        const knex = await db();
        const tables = await knex.raw("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
        console.log('📋 Tables after manual migrations:', tables.rows.map(table => table.tablename));

        // Verify specific tables exist
        const hasUsersTable = tables.rows.some(table => table.tablename === 'users');
        console.log('📋 Users table exists:', hasUsersTable);

        res.json({
            success: true,
            message: "Manual migrations completed successfully",
            data: {
                batchNumber: batchNo,
                migrationsRun: log,
                tables: tables.rows.map(table => table.tablename),
                usersTableExists: hasUsersTable
            }
        });
    } catch (error) {
        console.error("Manual migration error:", error);
        console.error("Error stack:", error.stack);
        res.status(500).json({
            success: false,
            message: "Manual migration failed",
            data: {
                error: error.message,
                stack: error.stack,
                details: "Check server logs for more information"
            }
        });
    }
});

// Manual seed endpoint (not protected) - for emergency use
app.get('/run-seeds', async (req, res) => {
    try {
        console.log('🌱 Manually running seeds...');

        // Run seeds
        const dbInstance = await db();
        await dbInstance.seed.run();
        console.log('✅ Manual seeds completed successfully');

        // Get all users after seeding
        const knex = await db();
        const users = await knex('users').select('id', 'name', 'email', 'phone');
        console.log('📋 Users after manual seeding:', users);

        res.json({
            success: true,
            message: "Manual seeding completed successfully",
            data: {
                usersCount: users.length,
                users: users
            }
        });
    } catch (error) {
        console.error("Manual seeding error:", error);
        res.status(500).json({
            success: false,
            message: "Manual seeding failed",
            data: {
                error: error.message,
                stack: error.stack
            }
        });
    }
});

// Debug headers endpoint (not protected)
app.get('/debug-headers', (req, res) => {
    console.log('🔍 Debug headers request received');
    console.log('📋 All headers:', req.headers);
    console.log('🔐 Authorization header:', req.headers.authorization);
    console.log('🌐 Origin:', req.headers.origin);
    console.log('📱 User-Agent:', req.headers['user-agent']);

    res.json({
        success: true,
        message: "Headers debug info",
        data: {
            authorization: req.headers.authorization,
            origin: req.headers.origin,
            userAgent: req.headers['user-agent'],
            allHeaders: req.headers
        }
    });
});

// Test token endpoint (not protected)
app.post('/test-token', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: "Token is required",
                data: []
            });
        }

        console.log('🔍 Testing token:', token.substring(0, 20) + '...');

        // Verify token
        const JWT_SECRET = process.env.JWT_SECRET;

        if (!JWT_SECRET || JWT_SECRET === 'your_jwt_secret') {
            console.error('❌ JWT_SECRET not properly configured! Please set JWT_SECRET environment variable.');
            return res.status(500).json({
                success: false,
                message: "Server configuration error - JWT_SECRET not set",
                data: []
            });
        }

        const jwt = await import('jsonwebtoken');
        const decodedToken = jwt.default.verify(token, JWT_SECRET);

        console.log('✅ Token verified:', decodedToken);

        // Get user from database
        const knex = await db();
        const user = await knex('users').where({ id: decodedToken.id }).first();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
                data: []
            });
        }

        res.json({
            success: true,
            message: "Token is valid",
            data: {
                token: decodedToken,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone
                }
            }
        });
    } catch (error) {
        console.error("Token test error:", error);
        res.status(400).json({
            success: false,
            message: "Invalid token",
            data: {
                error: error.message
            }
        });
    }
});

// Login endpoint (not protected)
app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
                data: []
            });
        }

        console.log('🔍 Login attempt for:', email);

        // Get user from database
        const knex = await db();
        const user = await knex('users').where({ email }).first();

        if (!user) {
            console.log('❌ User not found:', email);
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
                data: []
            });
        }

        console.log('✅ User found:', { id: user.id, name: user.name, email: user.email });

        // Hash password for comparison
        const crypto = await import('crypto');
        const hashedPassword = crypto.default.createHash('md5').update(password + password).digest('hex');
        console.log('🔐 Password check:', { provided: hashedPassword, stored: user.password });

        if (hashedPassword !== user.password) {
            console.log('❌ Password mismatch');
            return res.status(401).json({
                success: false,
                message: "Invalid credentials",
                data: []
            });
        }

        console.log('✅ Password verified successfully');

        // Generate JWT token
        const JWT_SECRET = process.env.JWT_SECRET;

        if (!JWT_SECRET || JWT_SECRET === 'your_jwt_secret') {
            console.error('❌ JWT_SECRET not properly configured! Please set JWT_SECRET environment variable.');
            return res.status(500).json({
                success: false,
                message: "Server configuration error - JWT_SECRET not set",
                data: []
            });
        }

        const jwt = await import('jsonwebtoken');
        const token = jwt.default.sign(
            { id: user.id, phone: user.phone, guest: false, employee: true },
            JWT_SECRET,
            { expiresIn: '1d' }
        );

        console.log('🎫 Token generated:', token.substring(0, 20) + '...');

        // Update last login
        await knex('users')
            .where({ id: user.id })
            .update({ last_login: parseInt(Date.now() / 1000) });

        // Set custom header
        res.set('X-Auth-Token', token);

        res.json({
            success: true,
            message: "Successfully logged in!",
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone
                },
                token: token
            }
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            data: []
        });
    }
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
    console.log('404 route accessed:', req.originalUrl);
    res.status(404).json({
        error: 'Route not found',
        message: `Cannot ${req.method} ${req.originalUrl}`,
        availableRoutes: {
            root: '/',
            test: '/test',
            health: '/health',
            testDb: '/test-db',
            runMigrations: '/run-migrations',
            runSeeds: '/run-seeds',
            testToken: '/test-token',
            debugHeaders: '/debug-headers',
            login: '/login',
            api: apiRoutes ? '/api/*' : 'not available (simplified version)'
        }
    });
});

export default app;