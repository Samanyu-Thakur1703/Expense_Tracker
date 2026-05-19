/**
 * Seeds Turso remote database with demo user and sample expenses.
 * Run once after creating your Turso DB: node scripts/seed-turso.js
 *
 * Prerequisites:
 *   1. Create a Turso DB: turso db create fintrack
 *   2. Set env vars:
 *      $env:TURSO_DATABASE_URL = "libsql://your-db.turso.io"
 *      $env:TURSO_AUTH_TOKEN = "your-token"
 *   3. Run this script
 */

require('dotenv').config();
const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

async function seed() {
    const url = process.env.TURSO_DATABASE_URL;
    const token = process.env.TURSO_AUTH_TOKEN;

    if (!url || !token) {
        console.error('ERROR: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set');
        console.error('');
        console.error('  $env:TURSO_DATABASE_URL = "libsql://your-db.turso.io"');
        console.error('  $env:TURSO_AUTH_TOKEN = "your-token"');
        process.exit(1);
    }

    console.log('Connecting to Turso:', url);
    const db = createClient({ url, authToken: token });

    // Create tables
    console.log('Creating tables...');
    await db.execute(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        balance REAL DEFAULT 0,
        budget REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await db.execute(`CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        date DATE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    await db.execute(`CREATE TABLE IF NOT EXISTS investments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        quantity REAL NOT NULL,
        buy_price REAL NOT NULL,
        current_price REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    await db.execute(`CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        provider TEXT NOT NULL,
        key TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    await db.execute('CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_expenses_user_category ON expenses(user_id, category)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_investments_user_symbol ON investments(user_id, symbol)');

    // Seed demo user
    const existing = await db.execute({
        sql: 'SELECT id FROM users WHERE email = ?',
        args: ['demo@fintrack.com']
    });

    if (existing.rows.length > 0) {
        console.log('Demo user already exists, skipping seed.');
        return;
    }

    console.log('Seeding demo user...');
    const hash = bcrypt.hashSync('demo1234', 8);
    const insertResult = await db.execute({
        sql: 'INSERT INTO users (name, email, password_hash, balance, budget) VALUES (?, ?, ?, ?, ?)',
        args: ['Demo User', 'demo@fintrack.com', hash, 50000, 20000]
    });

    const userId = Number(insertResult.lastInsertRowid);

    const sampleExpenses = [
        { amount: 450, category: 'Food', description: 'Grocery shopping', date: '2026-05-12' },
        { amount: 1200, category: 'Bills', description: 'Electricity bill', date: '2026-05-13' },
        { amount: 800, category: 'Travel', description: 'Metro pass', date: '2026-05-14' },
        { amount: 2500, category: 'Shopping', description: 'New headphones', date: '2026-05-15' },
        { amount: 350, category: 'Food', description: 'Restaurant dinner', date: '2026-05-16' },
        { amount: 500, category: 'Health', description: 'Pharmacy', date: '2026-05-17' },
        { amount: 1500, category: 'Entertainment', description: 'Movie tickets + snacks', date: '2026-05-17' },
    ];

    for (const exp of sampleExpenses) {
        await db.execute({
            sql: 'INSERT INTO expenses (user_id, amount, category, description, date) VALUES (?, ?, ?, ?, ?)',
            args: [userId, exp.amount, exp.category, exp.description, exp.date]
        });
    }

    console.log(`Done! Demo user seeded with ${sampleExpenses.length} sample expenses.`);
    console.log('Login: demo@fintrack.com / demo1234');
}

seed().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
});
