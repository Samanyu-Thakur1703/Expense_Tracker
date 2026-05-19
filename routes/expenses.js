const express = require('express');
const { getDatabase } = require('../db/schema');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
    try {
        const db = getDatabase();
        const { category, search, start_date, end_date, limit = 100, offset = 0 } = req.query;

        let sql = 'SELECT id, amount, category, description, date, created_at FROM expenses WHERE user_id = ?';
        const params = [req.userId];

        if (category && category !== 'all') {
            sql += ' AND category = ?';
            params.push(category);
        }
        if (search) {
            sql += ' AND (description LIKE ? OR category LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        if (start_date) {
            sql += ' AND date >= ?';
            params.push(start_date);
        }
        if (end_date) {
            sql += ' AND date <= ?';
            params.push(end_date);
        }

        sql += ' ORDER BY date DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const expenses = db.prepare(sql).all(...params);
        res.json({ expenses });
    } catch (err) {
        console.error('Get expenses error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/', authenticate, (req, res) => {
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
        const result = db.prepare(
            'INSERT INTO expenses (user_id, amount, category, description, date) VALUES (?, ?, ?, ?, ?)'
        ).run(req.userId, amount, category, description, date);

        res.status(201).json({
            message: 'Expense created',
            expense: {
                id: result.lastInsertRowid,
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

router.put('/:id', authenticate, (req, res) => {
    try {
        const { amount, category, description, date } = req.body;
        const db = getDatabase();

        const existing = db.prepare('SELECT id FROM expenses WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
        if (!existing) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        db.prepare(
            'UPDATE expenses SET amount = ?, category = ?, description = ?, date = ? WHERE id = ? AND user_id = ?'
        ).run(amount, category, description, date, req.params.id, req.userId);

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

router.delete('/:id', authenticate, (req, res) => {
    try {
        const db = getDatabase();
        const result = db.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        res.json({ message: 'Expense deleted' });
    } catch (err) {
        console.error('Delete expense error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/stats', authenticate, (req, res) => {
    try {
        const db = getDatabase();
        const now = new Date();
        const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

        const monthlyTotal = db.prepare(
            'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ? AND date >= ?'
        ).get(req.userId, monthStart);

        const allTimeTotal = db.prepare(
            'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE user_id = ?'
        ).get(req.userId);

        const categoryTotals = db.prepare(
            'SELECT category, SUM(amount) as total, COUNT(*) as count FROM expenses WHERE user_id = ? GROUP BY category ORDER BY total DESC'
        ).all(req.userId);

        const dailyTotals = db.prepare(
            "SELECT date, SUM(amount) as total FROM expenses WHERE user_id = ? AND date >= date('now', '-30 days') GROUP BY date ORDER BY date ASC"
        ).all(req.userId);

        res.json({
            monthly_total: monthlyTotal.total,
            all_time_total: allTimeTotal.total,
            category_breakdown: categoryTotals,
            daily_totals: dailyTotals
        });
    } catch (err) {
        console.error('Get stats error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
