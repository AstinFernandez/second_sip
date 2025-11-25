const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function createAdmin() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'auth_system'
    });

    const username = 'admin';
    const email = 'admin@example.com';
    const password = 'admin123';
    
    const hash = await bcrypt.hash(password, 10);
    
    await connection.query(
        'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [username, email, hash, 'admin']
    );
    
    console.log('✓ Admin user created!');
    console.log('  Username: admin');
    console.log('  Password: admin123');
    
    await connection.end();
}

createAdmin().catch(console.error);