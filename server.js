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
    secret: process.env.SESSION_SECRET, //Create id for the session cookie.
    resave: false, //Do not save to session store an unmodified session.
    saveUnitialized: false, //Same to setting above.
    cookies: {
        secure: false, //Can be accessed by both HTTP and HTTPS
        httpOnly: true, //Cookie is inaccessible to js in browser.
        maxAge: 24*60*60*1000 //Session only lasts for a day.
    }
}));

app.use('/', express.static(path.join(__dirname, 'Frontend', 'Index')));

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
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
                last_login TIMESTAMP NULL
            )
        `);
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
    catch(error){
        res.status(500).json({error: 'Auth check failed.'});
    }
});

app.post('/api/admin/register', isAuthenticated, isAdmin, async(req, res) =>{
    try{
        //Validate all fields are filled.
        const {username, email, password, role} = req.body;
        if(!username || !email || !password || !role){
            return res.status(500).json({error: 'All fields are required.'});
        }
        if(password.length < 6){
            return res.status(400).json({error: 'Password must have atleast 6 characters.'});
        }
        
        //Validate that the username/email are not already in use.
        const [existing] = await pool.query('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
        if(existing.length > 0){
            return res.status(409).json({error: 'Username or email already exists.'});
        }
        
        //Saving details of new user to database.
        const hash = await bcrypt.hash(password, 10); //result is hash will contain a long random-looking string which is safe to store in the database.
        const userRole = role == 'admin'? 'admin':'user'; //ternary operation used ?: First checks if role equals admin; if it doesn't assigns role to user.
        const [result] = await pool.query('INSERT INTO users (username, email, password-hash, role) VALUES (?,?,?,?' [username, email, hash, role]);
        return res.status(201).json({
            message: 'User created successfully.',
            userId: result.insertId,
            username: username,
            role: userRole,
        });
    }
    catch(error){
        console.error('Register error: ', error);
        return res.status(500).json({error: 'Registration failed.'});
    }
});

//Check users and their role
app.get('/api/admin/users', isAuthenticated, isAdmin, async(req, res) =>{
    try{
        const [users] = await pool.query('SELECT username, email, role, created_At, last_login FROM users ORDER BY created_at DESC');
        res.json({users});
    }
    catch(error){
        res.status(500).json({error: 'Failed to fetch users.'});
    }
});

//Delete users
app.delete('/api/admin/users/:id', isAuthenticated, isAdmin, async(req, res) =>{
    try{
        const userId = req.params.id; //code grabs the id from the request URL
        if(parseInt(userId) == req.session.userId){ //Checks if that id equals the logged-in user's own id
            res.status(400).json({error: 'Cannot delete yourself'});
        }

        //Deleting user from database
        const result = await pool.query('DELETE FROM users WHERE id = ?', [userId]);
        if(result.AffectedRows === 0){
            return res.status(404).json({error: 'User not found.'});
        }
        res.json({message: 'User deleted'});
    }
    catch(error){
        res.status(500).json({error: 'Delete failed.'});
    }
})

app.listen(PORT, () =>{
    console.log(`
        Server Running Successfully!
        
        Frontend URL: http://localhost: ${PORT}
        API URL:      http://localhost:${PORT}/api
        
        Open your broweser and go to:
        http://localhost:${PORT}
        `);
});