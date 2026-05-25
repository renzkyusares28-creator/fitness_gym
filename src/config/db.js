const mysql = require('mysql2/promise');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// SSL Configuration
const caPath = path.join(__dirname, '../../', process.env.DB_SSL_CA || 'ca.pem');
if (fs.existsSync(caPath)) {
    dbConfig.ssl = {
        ca: fs.readFileSync(caPath),
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true'
    };
} else {
    // If no CA file, still try to use SSL but don't reject unauthorized
    // This is often enough for Aiven if you don't have the CA file
    dbConfig.ssl = {
        rejectUnauthorized: false
    };
    console.warn('⚠️ Warning: ca.pem not found. Connecting with SSL (rejectUnauthorized: false).');
}

const pool = mysql.createPool(dbConfig);

module.exports = pool;
