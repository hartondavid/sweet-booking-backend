require('dotenv').config();

// Optimized configuration for Aurora/RDS
module.exports = {
    client: 'mysql2',
    connection: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
        timezone: 'Z',  // Ensures all dates are treated as UTC
        decimalNumbers: true,
        // SSL configuration for Aurora/RDS
        ssl: process.env.DB_SSL === 'true' ? {
            rejectUnauthorized: false
        } : false,
        // Enhanced connection pooling for Aurora/RDS
        pool: {
            min: 2,
            max: 20, // Increased for Aurora/RDS
            acquireTimeoutMillis: 30000,
            createTimeoutMillis: 30000,
            destroyTimeoutMillis: 5000,
            idleTimeoutMillis: 30000,
            reapIntervalMillis: 1000,
            createRetryIntervalMillis: 100,
            // Aurora/RDS specific optimizations
            afterCreate: function (conn, done) {
                // Set session variables for better performance
                conn.query('SET SESSION sql_mode = "STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO"', done);
            }
        },
        // Aurora/RDS specific options
        charset: 'utf8mb4',
        supportBigNumbers: true,
        bigNumberStrings: true
    },
    migrations: {
        directory: './migrations'
    },
    seeds: {
        directory: './seeds'
    },
    debug: process.env.NODE_ENV === 'development'
};

