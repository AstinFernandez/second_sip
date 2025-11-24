const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt =  require('bcrypt');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.use(session({
    secret: process.eventNames.SESSION_SECRET, //Create id for the session cookie.
    resave: false, //Do not save to session store an unmodified session.
    saveUnitialized: false, //Same to setting above.
    cookies: {
        secure: false, //Can be accessed by both HTTP and HTTPS
        httpOnly: true, //Cookie is inaccessible to js in browser.
        maxAge: 24*60*60*1000 //Session only lasts for a day.
    }
}));

app.use(express.static(path.join(__dirname, 'Frontend')));

const pool = mysql.createPool({
    host: process.env.DB.HOST,
    user: process.env.DB.USER,
    password: process.env.DB.PASSWORD,
    database: process.env.DB.NAME,
    waitForConnections: true,
    connectionLimit: 10
});

async function initDatabase(){
    try{
        const connection = await pool.getConnection();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) UNIQUE NOT NULL,
            role ENUM('admin', 'user') DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP NULL`
        );
        console.log('✔️ Database initialized');
        connection.release();
    }
    catch(error){
        console.error('Database error: ', error);
    }
}

initDatabase();

function isAuthenticated(req, res, next){
    if(req.session.id){
        next();
    }
    else{
        res.status(401).json({error: 'Unauthorized'});
    }
}

function isAdmin(req, res, next){
    if(req.session.id && req.session.role === 'admin'){
        next();
    }
    else{
        res.status(403).json({error: 'Admin access required.'});
    }
}

app.post('/api/login', async(req, res) =>{
    try{
        const {username, password} = req.body;

        //If username or password fields are empty?
        if(!username || !password){
            return res.status(400).json({error: 'Username and password required.'});
        }
        const [users] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);

        //Validate the user is in the database
        if(users.length == 0){
            return res.status(401).json({error: 'Invalid username.'});
        }
        const user = users[0];
        const isValid = await bcrypt.compare(password, user.password_hash);
        if(!isValid){
            return res.status(401).json({error: 'Invalid password.'});
        }
        await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

        //Provide session id, name and role to requests
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.role = user.role;
        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    }
    
    catch(error){
        console.error('Login error:', error);
        res.status(500).json({error: 'Login failed.'});
    }
});

app.post('/api/logout', (req, res) =>{
    req.session.destroy((err) =>{
        if(err){
            return res.status(500).json({error: 'Logout failed'});
        }
        res.clearCookie('connection.sid');
        res.json({message: 'Logout successful'});
    });
});

app.get('/api/check-auth', isAuthenticated, async(req, res) =>{
    try{
        const [users] = await pool.query('SELECT id, username, email, role, created_at, last_login FROM users WHERE id = ?', [req.session.userId]);
        if(users.length == 0){
            return res.status(404).json({error: 'User not found.'});
        }
        res.json({
            authenticated: true,
            user: users[0]
        });
    }
})