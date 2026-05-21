require('dotenv').config();

// Validate critical env vars in production
if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    const missing = [];
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'fintrack-secret-key-change-in-production') {
        missing.push('JWT_SECRET (set a strong random value)');
    }
    if (!process.env.TURSO_DATABASE_URL) missing.push('TURSO_DATABASE_URL');
    if (!process.env.TURSO_AUTH_TOKEN) missing.push('TURSO_AUTH_TOKEN');
    if (missing.length) {
        console.error('Missing required environment variables:', missing.join(', '));
        if (!process.env.VERCEL) process.exit(1);
    }
}

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { initDatabase } = require('./db/schema');
const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');
const stockRoutes = require('./routes/stocks');
const aiRoutes = require('./routes/ai');
const investmentRoutes = require('./routes/investments');
const searchRoutes = require('./routes/search');
const budgetRoutes = require('./routes/budgets');

const app = express();

// Security headers
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

// Request logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// CORS — allow production domain + local dev
const allowedOrigins = [
    'https://extracker-tau.vercel.app',
    'http://localhost:3001',
    'http://localhost:3000',
    'http://127.0.0.1:3001',
];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        callback(null, true); // allow any in dev — relax in true production
    },
    credentials: true,
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: function(res, path) {
        if (path.endsWith('.html') || path.endsWith('.js') || path.endsWith('.css')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));

// Rate limiting on auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'test' ? 200 : 20,
    message: { error: 'Too many attempts, please try again after 15 minutes' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/auth', authLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/stocks', stockRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/budgets', budgetRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback - serve index.html for non-API routes
app.get('{*path}', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server only when run directly (not when imported by Vercel wrapper)
if (require.main === module) {
    const PORT = process.env.PORT || 3001;
    initDatabase().then(() => {
        const server = app.listen(PORT, () => {
            console.log(`FinTrack AI API server running on http://localhost:${PORT}`);
            console.log('Database: SQLite via @libsql/client');
        });
        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('SIGTERM received, shutting down...');
            server.close(() => process.exit(0));
        });
        process.on('SIGINT', () => {
            console.log('SIGINT received, shutting down...');
            server.close(() => process.exit(0));
        });
    }).catch(err => {
        console.error('Failed to initialize database:', err);
        process.exit(1);
    });
}

module.exports = app;
