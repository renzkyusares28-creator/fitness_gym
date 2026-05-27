-- Database Schema for Fitness Gym Management System

-- Roles Table
CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- Insert Default Roles
INSERT IGNORE INTO roles (name) VALUES ('Admin'), ('Trainer'), ('Member');

-- Users Table (for Authentication)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role_id INT,
    is_approved TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Membership Plans Table
CREATE TABLE IF NOT EXISTS membership_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    duration_months INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Members Table
CREATE TABLE IF NOT EXISTS members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    age INT,
    gender ENUM('Male', 'Female', 'Other'),
    address TEXT,
    contact_number VARCHAR(20),
    profile_picture VARCHAR(255),
    membership_plan_id INT,
    status ENUM('Active', 'Inactive') DEFAULT 'Active',
    qr_code_data TEXT,
    registration_date DATE,
    membership_expiry_date DATE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (membership_plan_id) REFERENCES membership_plans(id)
);

-- Trainers Table
CREATE TABLE IF NOT EXISTS trainers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    specialization VARCHAR(100),
    contact_number VARCHAR(20),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Attendances Table
CREATE TABLE IF NOT EXISTS attendances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT,
    check_in_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    check_out_time DATETIME,
    status VARCHAR(50) DEFAULT 'Present',
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT,
    plan_id INT,
    amount DECIMAL(10, 2) NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_method ENUM('Cash', 'GCash', 'Maya') NOT NULL,
    status ENUM('Paid', 'Pending', 'Failed') DEFAULT 'Paid',
    receipt_number VARCHAR(50) UNIQUE,
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (plan_id) REFERENCES membership_plans(id)
);

-- Trainer Schedules Table
CREATE TABLE IF NOT EXISTS trainer_schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    trainer_id INT,
    member_id INT,
    schedule_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    session_type VARCHAR(100),
    FOREIGN KEY (trainer_id) REFERENCES trainers(id),
    FOREIGN KEY (member_id) REFERENCES members(id)
);

-- Workout Programs Table
CREATE TABLE IF NOT EXISTS workout_programs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT,
    program_name VARCHAR(100) NOT NULL,
    category ENUM('Weight Loss', 'Muscle Gain', 'Cardio', 'Strength Training') NOT NULL,
    description TEXT,
    assigned_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id),
    FOREIGN KEY (assigned_by) REFERENCES trainers(id)
);

-- QR Codes Table (Optional, if we want to store more details than just the data in members table)
CREATE TABLE IF NOT EXISTS qr_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT UNIQUE,
    qr_image_path VARCHAR(255),
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
);
