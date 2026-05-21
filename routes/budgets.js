const express = require('express');
const { getDatabase } = require('../db/schema');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/budgets — list category budgets with spent amounts
router.get('/', authenticate, async (req, res) => {
    try {
        const db = getDatabase();
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

        const result = await db.execute({
            sql: `SELECT b.category, b.monthly_limit,
                         COALESCE(SUM(CASE WHEN e.type = 'expense' AND e.date >= ? THEN e.amount ELSE 0 END), 0) as spent
                  FROM budgets b
                  LEFT JOIN expenses e ON b.user_id = e.user_id AND b.category = e.category
                  WHERE b.user_id = ?
                  GROUP BY b.category, b.monthly_limit
                  ORDER BY b.category ASC`,
            args: [monthStart, req.userId]
        });

        res.json({ budgets: result.rows });
    } catch (err) {
        console.error('Get budgets error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/budgets — set/update a category budget
router.post('/', authenticate, async (req, res) => {
    try {
        const { category, monthly_limit } = req.body;

        if (!category || category.trim().length === 0) {
            return res.status(400).json({ error: 'Category is required' });
        }
        if (!monthly_limit || monthly_limit <= 0) {
            return res.status(400).json({ error: 'Monthly limit must be greater than 0' });
        }

        const db = getDatabase();
        await db.execute({
            sql: 'INSERT INTO budgets (user_id, category, monthly_limit) VALUES (?, ?, ?) ON CONFLICT(user_id, category) DO UPDATE SET monthly_limit = ?',
            args: [req.userId, category.trim(), monthly_limit, monthly_limit]
        });

        res.json({ message: 'Budget saved', category: category.trim(), monthly_limit });
    } catch (err) {
        console.error('Set budget error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/budgets/:category — remove budget for a category
router.delete('/:category', authenticate, async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.execute({
            sql: 'DELETE FROM budgets WHERE user_id = ? AND category = ?',
            args: [req.userId, req.params.category]
        });

        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Budget not found for this category' });
        }

        res.json({ message: 'Budget deleted', category: req.params.category });
    } catch (err) {
        console.error('Delete budget error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
