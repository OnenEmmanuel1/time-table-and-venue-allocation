/**
 * TimetablePro Database Initializer
 * Creates the database, tables, and seeds with proper bcrypt-hashed passwords.
 * Usage: node db/init.js
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initDatabase() {
  const dbName = process.env.DB_NAME || 'timetablepro';

  /* Connect without selecting a database first */
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
  });

  try {
    console.log('🔧  Creating database...');
    await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    await connection.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${dbName}\``);

    console.log('📋  Running schema...');
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await connection.query(schema);

    console.log('🌱  Seeding data...');
    const hash = await bcrypt.hash('password123', 10);

    /* ── Users ── */
    await connection.query(
      `INSERT INTO users (name, email, password_hash, role, level) VALUES
        (?, ?, ?, 'admin', NULL),
        (?, ?, ?, 'hod', NULL),
        (?, ?, ?, 'lecturer', NULL),
        (?, ?, ?, 'lecturer', NULL),
        (?, ?, ?, 'lecturer', NULL),
        (?, ?, ?, 'student', 100),
        (?, ?, ?, 'student', 100),
        (?, ?, ?, 'student', 100),
        (?, ?, ?, 'student', 200),
        (?, ?, ?, 'student', 200)`,
      [
        'Admin User', 'admin@unicross.edu.ng', hash,
        'Dr. James Okon', 'hod@unicross.edu.ng', hash,
        'Dr. Mary Bassey', 'lecturer1@unicross.edu.ng', hash,
        'Mr. John Edet', 'lecturer2@unicross.edu.ng', hash,
        'Dr. Grace Akpan', 'lecturer3@unicross.edu.ng', hash,
        'Blessing Udo', 'student1@unicross.edu.ng', hash,
        'Emmanuel Obi', 'student2@unicross.edu.ng', hash,
        'Favour Inyang', 'student3@unicross.edu.ng', hash,
        'Daniel Etim', 'student4@unicross.edu.ng', hash,
        'Sarah Ndem', 'student5@unicross.edu.ng', hash
      ]
    );

    /* ── Lecturers ── */
    await connection.query(
      `INSERT INTO lecturers (user_id, availability_notes) VALUES
        (3, 'Available Monday to Friday, 8AM-4PM'),
        (4, 'Not available on Wednesdays'),
        (5, 'Available all weekdays')`
    );

    /* ── Venues ── */
    await connection.query(
      `INSERT INTO venues (name, capacity) VALUES
        ('Lecture Theatre 1', 200),
        ('Lecture Theatre 2', 150),
        ('Computer Room 1', 100),
        ('Computer Room 2', 40)`
    );

    /* ── Time Slots (Mon-Fri, 4 per day = 20 total) ── */
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const slots = [
      ['08:00:00', '10:00:00'],
      ['10:00:00', '12:00:00'],
      ['12:00:00', '14:00:00'],
      ['14:00:00', '16:00:00']
    ];
    for (const day of days) {
      for (const [start, end] of slots) {
        await connection.query(
          'INSERT INTO time_slots (day, start_time, end_time) VALUES (?, ?, ?)',
          [day, start, end]
        );
      }
    }

    /* ── Courses ── */
    await connection.query(
      `INSERT INTO courses (code, title, unit, level, lecturer_id, expected_students) VALUES
        ('CMP101', 'Introduction to Computer Science', 3, 100, 1, 150),
        ('CMP102', 'Programming Fundamentals', 3, 100, 2, 120),
        ('CMP103', 'Computer Hardware', 2, 100, 3, 130),
        ('CMP104', 'Mathematics for Computing', 3, 100, 1, 140),
        ('CMP201', 'Data Structures and Algorithms', 3, 200, 2, 80),
        ('CMP202', 'Database Management Systems', 3, 200, 3, 90),
        ('CMP203', 'Web Development', 2, 200, 1, 85),
        ('CMP204', 'Operating Systems', 3, 200, 2, 75)`
    );

    /* ── Update seed.sql with real hashes ── */
    try {
      let seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
      seedSql = seedSql.replace(/\$2b\$10\$PLACEHOLDER_HASH_USE_INIT_JS/g, hash);
      fs.writeFileSync(path.join(__dirname, 'seed.sql'), seedSql, 'utf8');
      console.log('📝  Updated seed.sql with real bcrypt hashes');
    } catch (e) {
      /* seed.sql update is optional */
    }

    console.log('');
    console.log('✅  Database initialized successfully!');
    console.log('');
    console.log('   Default credentials (all roles):');
    console.log('   Password: password123');
    console.log('');
    console.log('   Admin:     admin@unicross.edu.ng');
    console.log('   HOD:       hod@unicross.edu.ng');
    console.log('   Lecturer:  lecturer1@unicross.edu.ng');
    console.log('   Student:   student1@unicross.edu.ng');
    console.log('');
  } catch (error) {
    console.error('❌  Error initializing database:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

initDatabase().catch((err) => {
  console.error(err);
  process.exit(1);
});
