const db = require('./src/config/db');

async function upgrade() {
    try {
        console.log('--- Starting System Upgrades Database Migration ---');

        // 1. Emergency Health Monitoring (Members Table)
        console.log('Adding Emergency Health fields to members table...');
        const [memberCols] = await db.execute("SHOW COLUMNS FROM members LIKE 'emergency_contact'");
        if (memberCols.length === 0) {
            await db.execute(`ALTER TABLE members 
                ADD COLUMN emergency_contact VARCHAR(100),
                ADD COLUMN medical_conditions TEXT,
                ADD COLUMN allergies TEXT`);
            console.log('✅ Emergency Health fields added.');
        }

        // 2. Trainer Performance (Trainer Ratings & Reviews)
        console.log('Creating trainer_reviews table...');
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
        console.log('✅ trainer_reviews table verified.');

        // 3. Workout Progress Tracking (Body Metrics)
        console.log('Creating member_progress table...');
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
        console.log('✅ member_progress table verified.');

        // 4. Diet & Nutrition Module
        console.log('Creating nutrition_plans table...');
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
        console.log('✅ nutrition_plans table verified.');

        // 5. Gym Inventory Management
        console.log('Creating gym_inventory table...');
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
        console.log('✅ gym_inventory table verified.');

        console.log('--- Database Upgrade Migration Completed Successfully ---');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}

upgrade();
