require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./db/schema');
const authRoutes = require('./routes/auth');
const expenseRoutes = require('./routes/expenses');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback - serve index.html for non-API routes
app.get('{*path}', (req, res) => {
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
        app.listen(PORT, () => {
            console.log(`FinTrack AI API server running on http://localhost:${PORT}`);
            console.log('Database: SQLite via @libsql/client');
        });
    }).catch(err => {
        console.error('Failed to initialize database:', err);
        process.exit(1);
    });
}

module.exports = app;
