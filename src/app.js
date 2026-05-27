const express = require('express');
const session = require('express-session');
const path = require('path');
const morgan = require('morgan');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const db = require('./config/db');

// Test database connection
async function testConnection() {
    try {
        const connection = await db.getConnection();
        console.log('✅ Database connected successfully!');
        connection.release();
    } catch (err) {
        console.error('❌ Database connection failed!');
        console.error('Error Details:', err.message);
        if (err.message.includes('ssl')) {
            console.error('Tip: Aiven MySQL requires SSL. Make sure you have downloaded ca.pem and placed it in the project root.');
        }
    }
}
testConnection();

// Middleware
app.use(morgan('dev'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// EJS Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Session Configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'fitness_gym_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Global variables for templates
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.error = req.session.error || null;
    res.locals.success = req.session.success || null;
    delete req.session.error;
    delete req.session.success;
    next();
});

// Routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const memberRoutes = require('./routes/members');
const trainerRoutes = require('./routes/trainers');
const planRoutes = require('./routes/plans');
const paymentRoutes = require('./routes/payments');
const attendanceRoutes = require('./routes/attendance');
const workoutRoutes = require('./routes/workouts');
const reportRoutes = require('./routes/reports');
const inventoryRoutes = require('./routes/inventory');
const nutritionRoutes = require('./routes/nutrition');
const progressRoutes = require('./routes/progress');

app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/members', memberRoutes);
app.use('/trainers', trainerRoutes);
app.use('/plans', planRoutes);
app.use('/payments', paymentRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/workouts', workoutRoutes);
app.use('/reports', reportRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/nutrition', nutritionRoutes);
app.use('/progress', progressRoutes);

// Home route
app.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('index');
});

// Error Handling
app.use((req, res) => {
    console.log(`404 - Not Found: ${req.method} ${req.url}`);
    res.status(404).render('error', { message: 'Page Not Found', status: 404 });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
