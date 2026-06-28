const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { getDatabase } = require('../db/schema');
const { generateToken, authenticate } = require('../middleware/auth');

const router = express.Router();

// ─── Email Transporter ───────────────────────────────────────
function getTransporter() {
    // Use SMTP_URL for flexible configuration
    // Format: smtp://user:pass@smtp.example.com:587
    if (process.env.SMTP_URL) {
        return nodemailer.createTransport(process.env.SMTP_URL);
    }
    // Fallback: Gmail app password
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });
    }
    return null;
}

// ─── OTP Generation & Email ──────────────────────────────────
async function sendOtpEmail(email, otp) {
    const transporter = getTransporter();
    if (!transporter) {
        console.warn('No email configured — OTP would not be sent in production.');
        return; // silently allow for dev/testing
    }
    const appName = process.env.APP_NAME || 'FinTrack AI';
    await transporter.sendMail({
        from: process.env.SMTP_FROM || `"${appName}" <noreply@${process.env.SMTP_DOMAIN || 'fintrack.app'}>`,
        to: email,
        subject: `Your ${appName} Login Code`,
        text: `Your verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, you can safely ignore this email.`,
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0a0a0f;color:#f8fafc;border-radius:16px">
            <div style="text-align:center;margin-bottom:24px">
                <span style="font-size:24px;font-weight:800;color:#d4a853">${appName}</span>
            </div>
            <h2 style="text-align:center;font-size:20px;margin-bottom:8px">Your Login Code</h2>
            <p style="text-align:center;color:#94a3b8;margin-bottom:24px">Use this code to sign in to your account</p>
            <div style="background:#1a1a24;border-radius:12px;padding:20px;text-align:center;font-size:36px;font-weight:800;letter-spacing:8px;color:#d4a853;margin-bottom:24px">${otp}</div>
            <p style="text-align:center;color:#64748b;font-size:13px">This code expires in <strong>10 minutes</strong>. If you didn't request this, please ignore this email.</p>
        </div>`
    });
}

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
            user: { id: Number(insertRes.lastInsertRowid), name, email, currency: 'INR' },
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
            sql: 'SELECT id, name, email, password_hash, balance, budget, currency FROM users WHERE email = ?',
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
                budget: user.budget,
                currency: user.currency || 'INR'
            },
            token
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── Send OTP (email-based login) ────────────────────────────
router.post('/send-otp', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Valid email is required' });
        }

        const db = getDatabase();

        // Delete any existing unused OTPs for this email
        await db.execute({
            sql: "DELETE FROM otp_codes WHERE email = ? AND used = 0 AND expires_at < datetime('now')",
            args: [email]
        });

        // Check recent OTPs — rate limit: max 3 in last 10 minutes
        const recent = await db.execute({
            sql: "SELECT COUNT(*) as cnt FROM otp_codes WHERE email = ? AND created_at > datetime('now', '-10 minutes')",
            args: [email]
        });
        if (Number(recent.rows[0].cnt) >= 3) {
            return res.status(429).json({ error: 'Too many OTP requests. Please try again later.' });
        }

        // Generate 6-digit OTP
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        await db.execute({
            sql: 'INSERT INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)',
            args: [email, otp, expiresAt]
        });

        // Send email
        await sendOtpEmail(email, otp);

        res.json({ message: 'OTP sent to your email', expires_in: 600 });
    } catch (err) {
        console.error('Send OTP error:', err);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

// ─── Verify OTP & Login ─────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ error: 'Email and verification code are required' });
        }

        const db = getDatabase();

        // Find valid OTP
        const result = await db.execute({
            sql: "SELECT id FROM otp_codes WHERE email = ? AND code = ? AND used = 0 AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1",
            args: [email, code]
        });

        if (result.rows.length === 0) {
            // Check if any expired OTPs match — give better error
            const expired = await db.execute({
                sql: "SELECT id FROM otp_codes WHERE email = ? AND code = ? AND used = 0 AND expires_at <= datetime('now') LIMIT 1",
                args: [email, code]
            });
            if (expired.rows.length > 0) {
                return res.status(401).json({ error: 'Verification code has expired. Request a new one.' });
            }
            return res.status(401).json({ error: 'Invalid verification code' });
        }

        // Mark OTP as used
        await db.execute({
            sql: 'UPDATE otp_codes SET used = 1 WHERE id = ?',
            args: [result.rows[0].id]
        });

        // Find or create user
        let userResult = await db.execute({
            sql: 'SELECT id, name, email, balance, budget, currency FROM users WHERE email = ?',
            args: [email]
        });

        let user;
        if (userResult.rows.length === 0) {
            // Auto-create account on first OTP login
            const name = email.split('@')[0];
            const insertRes = await db.execute({
                sql: 'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
                args: [name, email, '']
            });
            user = {
                id: Number(insertRes.lastInsertRowid),
                name: name,
                email: email,
                balance: 0,
                budget: 0,
                currency: 'INR'
            };
        } else {
            user = userResult.rows[0];
        }

        const token = generateToken(user.id, user.email);

        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                balance: user.balance,
                budget: user.budget,
                currency: user.currency || 'INR'
            },
            token,
            is_new: userResult.rows.length === 0
        });
    } catch (err) {
        console.error('Verify OTP error:', err);
        res.status(500).json({ error: 'Failed to verify code' });
    }
});

router.get('/me', authenticate, async (req, res) => {
    try {
        const db = getDatabase();
        const result = await db.execute({
            sql: 'SELECT id, name, email, balance, budget, currency, created_at FROM users WHERE id = ?',
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
        const { balance, budget, currency } = req.body;
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
        if (currency !== undefined) {
            await db.execute({
                sql: 'UPDATE users SET currency = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                args: [currency, req.userId]
            });
        }

        const result = await db.execute({
            sql: 'SELECT id, name, email, balance, budget, currency FROM users WHERE id = ?',
            args: [req.userId]
        });
        res.json({ message: 'Settings updated', user: result.rows[0] });
    } catch (err) {
        console.error('Update settings error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
