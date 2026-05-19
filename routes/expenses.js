const express = require('express');
const { getDatabase } = require('../db/schema');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
    try {
        const db = getDatabase();
        const { category, search, start_date, end_date, limit = 100, offset = 0 } = req.query;

        let sql = 'SELECT id, amount, category, description, date, created_at FROM expenses WHERE user_id = ?';
        const args = [req.userId];

        if (category && category !== 'all') {
            sql += ' AND category = ?';
            args.push(category);
        }
        if (search) {
            sql += ' AND (description LIKE ? OR category LIKE ?)';
            args.push(`%${search}%`, `%${search}%`);
        }
        if (start_date) {
            sql += ' AND date >= ?';
            args.push(start_date);
        }
        if (end_date) {
            sql += ' AND date <= ?';
            args.push(end_date);
        }

        sql += ' ORDER BY date DESC LIMIT ? OFFSET ?';
        args.push(parseInt(limit), parseInt(offset));

        const result = await db.execute({ sql, args });
        res.json({ expenses: result.rows });
    } catch (err) {
        console.error('Get expenses error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/', authenticate, async (req, res) => {
    try {
        const { amount, category, description, date } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valid amount is required' });
        }
        if (!category) {
            return res.status(400).json({ error: 'Category is required' });
        }
        if (!description) {
            return res.status(400).json({ error: 'Description is required' });
        }
        if (!date) {
            return res.status(400).json({ error: 'Date is required' });
        }

        const db = getDatabase();
        const result = await db.execute({
            sql: 'INSERT INTO expenses (user_id, amount, category, description, date) VALUES (?, ?, ?, ?, ?)',
            args: [req.userId, amount, category, description, date]
        });

        res.status(201).json({
            message: 'Expense created',
            expense: {
                id: Number(result.lastInsertRowid),
                amount,
                category,
                description,
                date
            }
        });
    } catch (err) {
        console.error('Create expense error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/:id', authenticate, async (req, res) => {
    try {
        const { amount, category, description, date } = req.body;
        const db = getDatabase();

        const existing = await db.execute({
            sql: 'SELECT id FROM expenses WHERE id = ? AND user_id = ?',
            args: [req.params.id, req.userId]
        });

        if (existing.rows.length === 0) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        await db.execute({
            sql: 'UPDATE expenses SET amount = ?, category = ?, description = ?, date = ? WHERE id = ? AND user_id = ?',
            args: [amount, category, description, date, req.params.id, req.userId]
        });

        res.json({
            message: 'Expense updated',
            expense: {
                id: parseInt(req.params.id),
                amount,
                category,
                description,
                date
            }
        });
    } catch (err) {
        console.error('Update expense error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/:id', authenticate, async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.execute({
            sql: 'DELETE FROM expenses WHERE id = ? AND user_id = ?',
            args: [req.params.id, req.userId]
        });

        if (result.rowsAffected === 0) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        res.json({ message: 'Expense deleted' });
    } catch (err) {
        console.error('Delete expense error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/stats', authenticate, async (req, res) => {
    try {
        const db = getDatabase();
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

        const monthlyResult = await db.execute({
            sql: 'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ? AND date >= ?',
            args: [req.userId, monthStart]
        });

        const allTimeResult = await db.execute({
            sql: 'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ?',
            args: [req.userId]
        });

        const categoryResult = await db.execute({
            sql: 'SELECT category, SUM(amount) as total, COUNT(*) as count FROM expenses WHERE user_id = ? GROUP BY category ORDER BY total DESC',
            args: [req.userId]
        });

        const dailyResult = await db.execute({
            sql: "SELECT date, SUM(amount) as total FROM expenses WHERE user_id = ? AND date >= date('now', '-30 days') GROUP BY date ORDER BY date ASC",
            args: [req.userId]
        });

        res.json({
            monthly_total: monthlyResult.rows[0] ? monthlyResult.rows[0].total : 0,
            all_time_total: allTimeResult.rows[0] ? allTimeResult.rows[0].total : 0,
            category_breakdown: categoryResult.rows,
            daily_totals: dailyResult.rows
        });
    } catch (err) {
        console.error('Get stats error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
