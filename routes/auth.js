const express = require('express');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../db/schema');
const { generateToken, authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }
        if (name.length < 2) {
            return res.status(400).json({ error: 'Name must be at least 2 characters' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        const db = getDatabase();
        const existing = await db.execute({
            sql: 'SELECT id FROM users WHERE email = ?',
            args: [email]
        });

        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Email already registered' });
        }

        const passwordHash = bcrypt.hashSync(password, 8);
        const insertRes = await db.execute({
            sql: 'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
            args: [name, email, passwordHash]
        });

        const token = generateToken(Number(insertRes.lastInsertRowid), email);

        res.status(201).json({
            message: 'Account created successfully',
            user: { id: Number(insertRes.lastInsertRowid), name, email },
            token
        });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        if (password.length < 4) {
            return res.status(400).json({ error: 'Password must be at least 4 characters' });
        }

        const db = getDatabase();
        const result = await db.execute({
            sql: 'SELECT id, name, email, password_hash, balance, budget FROM users WHERE email = ?',
            args: [email]
        });

        const user = result.rows[0];
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (!bcrypt.compareSync(password, user.password_hash)) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = generateToken(user.id, user.email);

        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                balance: user.balance,
                budget: user.budget
            },
            token
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/me', authenticate, async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.execute({
            sql: 'SELECT id, name, email, balance, budget, created_at FROM users WHERE id = ?',
            args: [req.userId]
        });
        const user = result.rows[0];
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
    } catch (err) {
        console.error('Get user error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/settings', authenticate, async (req, res) => {
    try {
        const { balance, budget } = req.body;
        const db = getDatabase();

        if (balance !== undefined) {
            await db.execute({
                sql: 'UPDATE users SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                args: [balance, req.userId]
            });
        }
        if (budget !== undefined) {
            await db.execute({
                sql: 'UPDATE users SET budget = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                args: [budget, req.userId]
            });
        }

        const result = await db.execute({
            sql: 'SELECT id, name, email, balance, budget FROM users WHERE id = ?',
            args: [req.userId]
        });
        res.json({ message: 'Settings updated', user: result.rows[0] });
    } catch (err) {
        console.error('Update settings error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
