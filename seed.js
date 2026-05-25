const db = require('./src/config/db');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

async function seed() {
    try {
        console.log('--- Database Setup & Seeding Tool ---');
        
        const caPath = path.join(__dirname, process.env.DB_SSL_CA || 'ca.pem');
        if (!fs.existsSync(caPath)) {
            console.warn('⚠️ Warning: ca.pem not found. If your database requires SSL (like Aiven), seeding might fail.');
        }

        console.log('Connecting to database...');
        const [test] = await db.execute('SELECT 1');
        console.log('✅ Connection established.');

        // 1. Create Tables from database.sql
        console.log('Creating tables if they do not exist...');
        const sqlFile = fs.readFileSync(path.join(__dirname, 'database.sql'), 'utf8');
        
        // Remove comments and split by semicolon
        const cleanSql = sqlFile.replace(/--.*$/gm, '');
        const statements = cleanSql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            try {
                await db.query(statement);
                console.log(`Executed: ${statement.substring(0, 30)}...`);
            } catch (err) {
                // If it's just an error that it already exists, ignore it
                if (!err.message.includes('already exists')) {
                    console.error(`Error executing statement: ${statement.substring(0, 50)}...`);
                    console.error('Error:', err.message);
                }
            }
        }
        console.log('✅ Database schema verified.');

        // 2. Seed Roles
        console.log('Seeding roles...');
        await db.execute("INSERT IGNORE INTO roles (name) VALUES ('Admin'), ('Trainer'), ('Member')");
        console.log('✅ Roles seeded.');

        // 3. Create Default Admin User
        const adminUsername = 'admin';
        const adminEmail = 'admin@gym.com';
        const adminPassword = 'admin123';
        const hashedPassword = await bcrypt.hash(adminPassword, 10);

        const [existingAdmin] = await db.execute('SELECT id FROM users WHERE username = ?', [adminUsername]);
        
        if (existingAdmin.length === 0) {
            await db.execute(
                "INSERT INTO users (username, email, password, role_id) VALUES (?, ?, ?, (SELECT id FROM roles WHERE name = 'Admin'))",
                [adminUsername, adminEmail, hashedPassword]
            );
            console.log('✅ Default admin created:');
            console.log('   Username: admin');
            console.log('   Password: admin123');
        } else {
            console.log('ℹ️ Admin user already exists.');
        }

        // 4. Create Default Membership Plans
        const plans = [
            ['Monthly Plan', 1, 1500, 'Standard monthly access'],
            ['Yearly Plan', 12, 12000, 'Save more with annual membership'],
            ['Student Plan', 1, 1000, 'Discounted rate for students'],
            ['Premium Plan', 1, 2500, 'Access to all classes and personal training']
        ];

        for (const plan of plans) {
            const [existingPlan] = await db.execute('SELECT id FROM membership_plans WHERE name = ?', [plan[0]]);
            if (existingPlan.length === 0) {
                await db.execute(
                    'INSERT INTO membership_plans (name, duration_months, price, description) VALUES (?, ?, ?, ?)',
                    plan
                );
            }
        }
        console.log('✅ Default plans seeded.');

        console.log('\n--- Database setup completed successfully! ---');
        process.exit(0);
    } catch (err) {
        console.error('\n❌ Error during database setup:');
        console.error(err);
        process.exit(1);
    }
}

seed();
