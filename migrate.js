const db = require('./src/config/db');

async function migrate() {
    try {
        console.log('Starting migration: Adding check_out_time to attendances table...');
        
        // 1. Check if column exists
        const [columns] = await db.execute("SHOW COLUMNS FROM attendances LIKE 'check_out_time'");
        
        if (columns.length === 0) {
            console.log('Column check_out_time not found. Adding it now...');
            await db.execute('ALTER TABLE attendances ADD COLUMN check_out_time DATETIME AFTER check_in_time');
            console.log('✅ Column check_out_time added successfully.');
        } else {
            console.log('ℹ️ Column check_out_time already exists.');
        }

        // 2. Update status column to be more flexible if needed (optional)
        // By default it's VARCHAR(50), which is fine for "Active" and "Completed"

        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:');
        console.error(err.message);
        process.exit(1);
    }
}

migrate();
