const db = require('../config/db');
const TimetableEngine = require('../engine/ttvEngine');

async function testSchedulePrint() {
  const engine = new TimetableEngine(db);
  const res = await engine.generateTimetable();
  console.log('Generation success:', res.success);

  const timetable = await engine.getTimetable();
  console.log('\n📅 GENERATED TIMETABLE SCHEDULE:');
  console.log('─'.repeat(75));
  timetable.forEach(t => {
    const time = `${t.start_time.substring(0,5)}–${t.end_time.substring(0,5)}`;
    console.log(`[${t.day.padEnd(9)}] ${time.padEnd(11)} | ${t.code.padEnd(7)} (Level ${t.level}) | ${t.venue_name.padEnd(18)} | ${t.lecturer_name || 'TBA'}`);
  });
  console.log('─'.repeat(75));

  // Time Slot usage summary
  const times = {};
  const days = {};
  timetable.forEach(t => {
    const time = `${t.start_time.substring(0,5)}–${t.end_time.substring(0,5)}`;
    times[time] = (times[time] || 0) + 1;
    days[t.day] = (days[t.day] || 0) + 1;
  });

  console.log('\n⏰ Time Slot Usage:');
  for (const time of Object.keys(times).sort()) {
    console.log(`   • ${time}: ${times[time]} course(s)`);
  }

  console.log('\n📆 Day of Week Usage:');
  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
    console.log(`   • ${day.padEnd(10)}: ${days[day] || 0} course(s)`);
  }

  process.exit(0);
}

testSchedulePrint().catch(err => {
  console.error(err);
  process.exit(1);
});
