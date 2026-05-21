const express = require('express');
const { getDatabase } = require('../db/schema');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/search?q=term — search expenses and investments
router.get('/', authenticate, async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length === 0) {
            return res.json({ results: { expenses: [], investments: [] } });
        }

        const db = getDatabase();
        const searchTerm = `%${q.trim()}%`;

        // Search expenses
        const expenses = await db.execute({
            sql: 'SELECT id, amount, category, description, date, type FROM expenses WHERE user_id = ? AND (description LIKE ? OR category LIKE ? OR CAST(amount AS TEXT) LIKE ?) LIMIT 10',
            args: [req.userId, searchTerm, searchTerm, searchTerm]
        });

        // Search investments
        const investments = await db.execute({
            sql: 'SELECT id, symbol, name, quantity, buy_price, current_price FROM investments WHERE user_id = ? AND (symbol LIKE ? OR name LIKE ?) LIMIT 10',
            args: [req.userId, searchTerm, searchTerm]
        });

        res.json({
            results: {
                expenses: expenses.rows,
                investments: investments.rows
            }
        });
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
