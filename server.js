// server.mjs (handles starting the server)
import app from './index.mjs';

const port = process.env.PORT || 8080;

// Start the server
app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${port}`);
});

// Simplified server startup with debugging
const startServer = async () => {
    try {
        console.log('🚀 Starting Delivery Backend Server...');
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'production'}`);
        console.log(`🔧 Port: ${port}`);
        console.log(`📡 Host: 0.0.0.0`);
        console.log('📦 App imported successfully');

        // Start the server immediately
        const server = app.listen(port, '0.0.0.0', () => {
            console.log(`✅ Server is running on http://localhost:${port}`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'production'}`);
            console.log(`📊 Health check: http://localhost:${port}/health`);
            console.log(`🏠 Root endpoint: http://localhost:${port}/`);
            console.log(`🔗 Test endpoint: http://localhost:${port}/test`);
            console.log('🎉 Server started successfully!');
        });

        // Add error handling for the server
        server.on('error', (error) => {
            console.error('❌ Server error:', error);
            if (error.code === 'EADDRINUSE') {
                console.error('💡 Port is already in use. Try a different port.');
            }
        });

        // Graceful shutdown
        process.on('SIGTERM', async () => {
            console.log('\n🔄 SIGTERM received, shutting down gracefully...');
            server.close(() => {
                console.log('✅ Server closed');
                process.exit(0);
            });
        });

        process.on('SIGINT', async () => {
            console.log('\n🔄 SIGINT received, shutting down gracefully...');
            server.close(() => {
                console.log('✅ Server closed');
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        console.error('🔍 Error details:', error.stack);
        process.exit(1);
    }
};

console.log('📦 Starting server initialization...');
startServer();
