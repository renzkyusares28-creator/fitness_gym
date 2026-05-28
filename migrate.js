const db = require('./src/config/db');

async function migrate() {
    try {
        console.log('🚀 Starting Database Migration...');

        // Helper function to check if a column exists
        async function columnExists(table, column) {
            const [rows] = await db.execute(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
            return rows.length > 0;
        }

        // 1. Members Table Updates
        console.log('Checking Members table...');
        if (!(await columnExists('members', 'emergency_contact'))) {
            await db.execute('ALTER TABLE members ADD COLUMN emergency_contact VARCHAR(100)');
            console.log('✅ Added members.emergency_contact');
        }
        if (!(await columnExists('members', 'medical_conditions'))) {
            await db.execute('ALTER TABLE members ADD COLUMN medical_conditions TEXT');
            console.log('✅ Added members.medical_conditions');
        }
        if (!(await columnExists('members', 'allergies'))) {
            await db.execute('ALTER TABLE members ADD COLUMN allergies TEXT');
            console.log('✅ Added members.allergies');
        }

        // 2. Attendances Table Updates
        console.log('Checking Attendances table...');
        if (!(await columnExists('attendances', 'check_out_time'))) {
            await db.execute('ALTER TABLE attendances ADD COLUMN check_out_time DATETIME AFTER check_in_time');
            console.log('✅ Added attendances.check_out_time');
        }

        // 3. Trainer Schedules Table Updates
        console.log('Checking Trainer Schedules table...');
        if (!(await columnExists('trainer_schedules', 'status'))) {
            await db.execute("ALTER TABLE trainer_schedules ADD COLUMN status ENUM('Pending', 'Confirmed', 'Cancelled') DEFAULT 'Confirmed'");
            console.log('✅ Added trainer_schedules.status');
        }

        // 4. Create New Tables
        console.log('Creating new tables if missing...');
        
        await db.execute(`CREATE TABLE IF NOT EXISTS trainer_reviews (
            id INT AUTO_INCREMENT PRIMARY KEY,
            trainer_id INT,
            member_id INT,
            rating INT CHECK (rating >= 1 AND rating <= 5),
            review TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE,
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
        )`);
        console.log('✅ Verified trainer_reviews table');

        await db.execute(`CREATE TABLE IF NOT EXISTS member_progress (
            id INT AUTO_INCREMENT PRIMARY KEY,
            member_id INT,
            weight DECIMAL(5,2),
            bmi DECIMAL(5,2),
            body_fat_percentage DECIMAL(5,2),
            chest_size DECIMAL(5,2),
            arm_size DECIMAL(5,2),
            calories_burned INT,
            recorded_at DATE,
            recorded_by INT,
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
            FOREIGN KEY (recorded_by) REFERENCES trainers(id)
        )`);
        console.log('✅ Verified member_progress table');

        await db.execute(`CREATE TABLE IF NOT EXISTS nutrition_plans (
            id INT AUTO_INCREMENT PRIMARY KEY,
            member_id INT,
            trainer_id INT,
            breakfast_plan TEXT,
            lunch_plan TEXT,
            dinner_plan TEXT,
            daily_calories_target INT,
            protein_target_grams INT,
            water_target_liters DECIMAL(3,1),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
            FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE
        )`);
        console.log('✅ Verified nutrition_plans table');

        await db.execute(`CREATE TABLE IF NOT EXISTS gym_inventory (
            id INT AUTO_INCREMENT PRIMARY KEY,
            item_name VARCHAR(100) NOT NULL,
            category VARCHAR(50),
            quantity INT DEFAULT 1,
            status ENUM('Good', 'Fair', 'Needs Maintenance', 'Damaged') DEFAULT 'Good',
            last_maintenance_date DATE,
            next_maintenance_date DATE,
            notes TEXT
        )`);
        console.log('✅ Verified gym_inventory table');

        console.log('🎉 Migration Completed Successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration Failed:', err.message);
        process.exit(1);
    }
}

migrate();
