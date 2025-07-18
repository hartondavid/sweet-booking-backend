// middleware.js - CORS configuration for production deployment

const allowedOrigins = [
    'https://sweet-booking-frontend.vercel.app', // <-- PASTE YOUR LIVE FRONTEND URL HERE
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173', // Vite default
    'http://localhost:8080'  // Your backend local port
];

const corsOptions = {
    origin: function (origin, callback) {
        console.log('CORS request from origin:', origin);
        console.log('Allowed origins:', allowedOrigins);

        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
            console.log('No origin provided, allowing request');
            return callback(null, true);
        }

        if (allowedOrigins.indexOf(origin) !== -1) {
            console.log('Origin allowed:', origin);
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin'
    ],
    exposedHeaders: ['X-Auth-Token', 'X-Total-Count'],
    credentials: true, // Allow cookies and authentication headers
    maxAge: 86400 // Cache preflight requests for 24 hours
};

export default corsOptions; 