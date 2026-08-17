const db = require('../config/db');
const TimetableEngine = require('../engine/ttvEngine');
const bcrypt = require('bcryptjs');

async function runVerification() {
  console.log('🧪 Starting Verification Suite...\n');
  const engine = new TimetableEngine(db);

  /* ──────────────────────────────────────────────────
     1. Test Student Stats & Initial Count
     ────────────────────────────────────────────────── */
  console.log('1️⃣  Checking System Stats...');
  const stats = await engine.getStats();
  console.log('   Stats:', stats);
  if (typeof stats.totalStudents !== 'number' || stats.totalStudents < 0) {
    throw new Error('totalStudents is missing or invalid in getStats()');
  }
  console.log(`   ✅ Total students in DB: ${stats.totalStudents}`);

  /* ──────────────────────────────────────────────────
     2. Test Student CRUD Simulation
     ────────────────────────────────────────────────── */
  console.log('\n2️⃣  Testing Student Creation, Fetch, Update, and Deletion...');
  const testEmail = 'automated_test_student@unicross.edu.ng';
  const testName = 'Automated Test Student';
  const testLevel = 300;
  const hash = await bcrypt.hash('password123', 10);

  // Clean up if previous test run left data
  await db.query('DELETE FROM users WHERE email = ?', [testEmail]);

  // Insert Student
  const [insertResult] = await db.query(
    'INSERT INTO users (name, email, password_hash, role, level) VALUES (?, ?, ?, ?, ?)',
    [testName, testEmail, hash, 'student', testLevel]
  );
  const newStudentId = insertResult.insertId;
  console.log(`   ✅ Created student with ID: ${newStudentId}`);

  // Fetch Student
  const [fetchedStudents] = await db.query('SELECT * FROM users WHERE id = ?', [newStudentId]);
  if (!fetchedStudents.length || fetchedStudents[0].role !== 'student' || fetchedStudents[0].level !== 300) {
    throw new Error('Failed to fetch created student or fields do not match');
  }
  console.log(`   ✅ Verified student fetch: ${fetchedStudents[0].name} (Level ${fetchedStudents[0].level})`);

  // Update Student
  await db.query('UPDATE users SET name = ?, level = ? WHERE id = ?', ['Updated Test Student', 400, newStudentId]);
  const [updatedStudents] = await db.query('SELECT * FROM users WHERE id = ?', [newStudentId]);
  if (updatedStudents[0].name !== 'Updated Test Student' || updatedStudents[0].level !== 400) {
    throw new Error('Student update failed');
  }
  console.log(`   ✅ Verified student update: ${updatedStudents[0].name} (Level ${updatedStudents[0].level})`);

  // Verify bcrypt password authentication
  const isMatch = await bcrypt.compare('password123', updatedStudents[0].password_hash);
  if (!isMatch) {
    throw new Error('Password hash does not match password123');
  }
  console.log('   ✅ Password hash verified for student login');

  // Delete Student
  await db.query('DELETE FROM users WHERE id = ?', [newStudentId]);
  const [afterDelete] = await db.query('SELECT * FROM users WHERE id = ?', [newStudentId]);
  if (afterDelete.length > 0) {
    throw new Error('Student delete failed');
  }
  console.log('   ✅ Student deletion verified');

  /* ──────────────────────────────────────────────────
     3. Test Week-Spanning Timetable Generation
     ────────────────────────────────────────────────── */
  console.log('\n3️⃣  Testing Week-Spanning Timetable Generation...');
  const genResult = await engine.generateTimetable();
  console.log('   Generation result:', genResult.success ? 'SUCCESS' : 'FAILED', genResult.message || '');
  if (!genResult.success) {
    throw new Error('generateTimetable failed: ' + genResult.message);
  }

  const entries = await engine.getTimetable();
  console.log(`   Generated ${entries.length} timetable entries total.`);

  // Group entries by day
  const dayDistribution = {};
  const levelDayDistribution = {};

  for (const e of entries) {
    dayDistribution[e.day] = (dayDistribution[e.day] || 0) + 1;
    if (!levelDayDistribution[e.level]) levelDayDistribution[e.level] = {};
    levelDayDistribution[e.level][e.day] = (levelDayDistribution[e.level][e.day] || 0) + 1;
  }

  console.log('\n   📊 Day Distribution (All Courses):');
  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
    console.log(`      - ${day.padEnd(10)}: ${dayDistribution[day] || 0} class(es)`);
  }

  console.log('\n   📚 Level Distribution Across Week:');
  for (const lvl of Object.keys(levelDayDistribution).sort()) {
    console.log(`      Level ${lvl}:`);
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
      const cnt = levelDayDistribution[lvl][day] || 0;
      console.log(`        • ${day.padEnd(10)}: ${cnt} class(es)`);
    }
  }

  // Verify that schedule spans across multiple days (not only Monday!)
  const daysWithClasses = Object.keys(dayDistribution).filter(d => dayDistribution[d] > 0);
  console.log(`\n   ✅ Active days in generated timetable: ${daysWithClasses.join(', ')} (${daysWithClasses.length} days)`);

  if (daysWithClasses.length < 3) {
    throw new Error('Timetable is not properly distributed across the week! Active days: ' + daysWithClasses.length);
  }

  // Verify Monday is not overloaded compared to other days
  if (dayDistribution['Monday'] === entries.length) {
    throw new Error('All courses are still on Monday! Week distribution failed.');
  }

  /* ──────────────────────────────────────────────────
     4. Conflict Verification
     ────────────────────────────────────────────────── */
  console.log('\n4️⃣  Checking for Any Four-Category Conflicts in Generated Schedule...');
  const [courses] = await db.query('SELECT * FROM courses');
  const [venues] = await db.query('SELECT * FROM venues');
  const violations = engine.detectConflicts(entries, courses, venues);

  if (violations.length > 0) {
    console.error('   ❌ Violations found:', violations);
    throw new Error(`Found ${violations.length} constraint violations!`);
  }
  console.log('   ✅ 0 conflicts detected! The timetable strictly satisfies all 4 constraint categories:');
  console.log('      1. No lecturer double-booking');
  console.log('      2. No same-level concurrency clashes');
  console.log('      3. All venue capacities respected');
  console.log('      4. No venue double-booking');

  console.log('\n🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
  process.exit(0);
}

runVerification().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
