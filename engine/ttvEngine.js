/**
 * TimetablePro Scheduling Engine (ttvEngine.js)
 * ──────────────────────────────────────────────
 * Houses ALL business logic:
 *  • CSP-based scheduling algorithm (greedy + backtracking)
 *  • Four-category conflict detection
 *  • Post-publication single-entry re-assignment
 *  • Conflict logging / audit trail
 *
 * Kept fully separate from Express route handlers.
 */

class TimetableEngine {
  /**
   * @param {import('mysql2/promise').Pool} db  mysql2 connection pool
   */
  constructor(db) {
    this.db = db;
  }

  /* ═══════════════════════════════════════════════════
     P3 — SCHEDULING ALGORITHM (greedy + backtracking)
     ═══════════════════════════════════════════════════ */

  /**
   * Main entry-point.  Generates a conflict-free draft timetable.
   * 1. Fetches courses (sorted by expected_students DESC — hardest first)
   * 2. Fetches time-slots & venues
   * 3. Builds per-course domains (valid time-slot × venue pairs)
   * 4. Greedy initial pass with backtracking on failure
   * 5. Runs four-category validation on the result
   * 6. Persists as draft timetable_entries + logs resolved conflicts
   *
   * @returns {{ success:boolean, entries:object[], conflictsResolved:object[], message?:string }}
   */
  async generateTimetable() {
    /* ── Fetch input data ─────────────────────────── */
    const [courses] = await this.db.query(
      `SELECT c.*, l.user_id AS lecturer_user_id, l.availability_notes
       FROM courses c
       LEFT JOIN lecturers l ON c.lecturer_id = l.id
       ORDER BY c.level ASC, c.expected_students DESC`
    );

    const [timeSlots] = await this.db.query(
      `SELECT * FROM time_slots
       ORDER BY FIELD(day, 'Monday','Tuesday','Wednesday','Thursday','Friday'), start_time`
    );

    const [venues] = await this.db.query(
      `SELECT * FROM venues ORDER BY capacity DESC`
    );

    if (!courses.length) {
      return { success: false, message: 'No courses found. Add courses before generating.', entries: [], conflictsResolved: [] };
    }
    if (!timeSlots.length || !venues.length) {
      return { success: false, message: 'Time slots or venues are missing.', entries: [], conflictsResolved: [] };
    }

    /* ── Clear previous draft entries ─────────────── */
    await this.db.query(`DELETE FROM timetable_entries WHERE status = 'draft'`);

    /* ── Build domains (pre-filter by capacity with slot details) ───── */
    const domains = {};
    for (const course of courses) {
      domains[course.id] = [];
      for (const ts of timeSlots) {
        for (const venue of venues) {
          if (venue.capacity >= course.expected_students) {
            domains[course.id].push({
              timeSlotId: ts.id,
              venueId: venue.id,
              day: ts.day,
              startTime: ts.start_time,
              endTime: ts.end_time,
              venueCapacity: venue.capacity
            });
          }
        }
      }
      if (domains[course.id].length === 0) {
        return {
          success: false,
          message: `No venue large enough for ${course.code} (${course.expected_students} students).`,
          entries: [],
          conflictsResolved: []
        };
      }
    }

    /* ── Solve CSP (heuristic day-spreading + backtracking) ─────────── */
    const assignments = {};
    const conflictsResolved = [];
    const solved = this._solve(courses, domains, assignments, 0, conflictsResolved);

    if (!solved) {
      return {
        success: false,
        message: 'Could not produce a conflict-free timetable with the current data. Consider adding more time slots or venues.',
        entries: [],
        conflictsResolved
      };
    }

    /* ── Post-solve validation (four categories) ───── */
    const entryList = courses.map(c => ({
      course_id: c.id,
      venue_id: assignments[c.id].venueId,
      time_slot_id: assignments[c.id].timeSlotId
    }));

    const postConflicts = this.detectConflicts(entryList, courses, venues);
    if (postConflicts.length > 0) {
      return {
        success: false,
        message: 'Generated timetable still has unresolved conflicts.',
        conflicts: postConflicts,
        entries: [],
        conflictsResolved
      };
    }

    /* ── Persist as draft timetable_entries ─────────── */
    const entries = [];
    for (const course of courses) {
      const { timeSlotId, venueId } = assignments[course.id];
      const [result] = await this.db.query(
        'INSERT INTO timetable_entries (course_id, venue_id, time_slot_id, status) VALUES (?, ?, ?, ?)',
        [course.id, venueId, timeSlotId, 'draft']
      );
      entries.push({
        id: result.insertId,
        course_id: course.id,
        venue_id: venueId,
        time_slot_id: timeSlotId,
        status: 'draft'
      });
    }

    /* ── Log resolved conflicts from backtracking ──── */
    for (const conflict of conflictsResolved) {
      await this.logConflict({
        entryId: null,
        type: conflict.type,
        original: conflict.original,
        updated: conflict.message,
        reason: conflict.message
      });
    }

    return { success: true, entries, conflictsResolved };
  }

  /**
   * Score a candidate slot-venue assignment to spread classes across both:
   *  1. All days of the week (Monday through Friday)
   *  2. All time periods of the day (e.g. 08:00–10:00, 10:00–12:00, 12:00–14:00, 14:00–16:00)
   * Lower score = higher preference.
   * @private
   */
  _scoreCandidate(cand, course, assignments, courses) {
    let score = 0;
    let levelDayCount = 0;
    let lecturerDayCount = 0;
    let totalDayCount = 0;
    let levelTimeCount = 0;
    let totalTimeCount = 0;
    let exactSlotCount = 0;

    for (const assignedCourseId in assignments) {
      const asgn = assignments[assignedCourseId];
      const ac = courses.find(c => c.id == assignedCourseId);

      // Day-level metrics
      if (asgn.day === cand.day) {
        totalDayCount++;
        if (ac && ac.level === course.level) {
          levelDayCount++;
        }
        if (ac && course.lecturer_id && ac.lecturer_id === course.lecturer_id) {
          lecturerDayCount++;
        }
      }

      // Time-period metrics (e.g. 08:00, 10:00, 12:00, 14:00)
      if (asgn.startTime === cand.startTime) {
        totalTimeCount++;
        if (ac && ac.level === course.level) {
          levelTimeCount++;
        }
      }

      // Exact day + time slot metric
      if (asgn.timeSlotId === cand.timeSlotId) {
        exactSlotCount++;
      }
    }

    // 1. Level-day spread: Distribute each level across different days of the week (Mon–Fri)
    score += levelDayCount * 1200;

    // 2. Level-time spread: Distribute each level across different time periods of the day
    score += levelTimeCount * 400;

    // 3. Lecturer-day spread: Distribute lecturer teaching load across different days
    score += lecturerDayCount * 500;

    // 4. Faculty-wide day load: Spread overall room utilization across Monday–Friday
    score += totalDayCount * 30;

    // 5. Faculty-wide time period spread: Utilize 08:00, 10:00, 12:00, 14:00 evenly
    score += totalTimeCount * 25;

    // 6. Exact slot load (number of simultaneous classes across all venues in this slot)
    score += exactSlotCount * 15;

    // 7. Lecturer availability notes check (e.g. "Not available on Wednesdays")
    if (course.availability_notes && typeof course.availability_notes === 'string') {
      const notes = course.availability_notes.toLowerCase();
      const dayLower = cand.day.toLowerCase();
      if (notes.includes('not available on ' + dayLower) ||
          notes.includes('no ' + dayLower) ||
          notes.includes('unavailable on ' + dayLower) ||
          notes.includes('unavailable ' + dayLower) ||
          (notes.includes('not available') && notes.includes(dayLower))) {
        score += 20000; // Heavily penalize unavailable day
      }
    }

    // 8. Optimal venue capacity fit (avoid wasting huge halls on tiny classes)
    if (cand.venueCapacity) {
      const waste = cand.venueCapacity - (course.expected_students || 0);
      score += Math.max(0, waste) * 0.01;
    }

    return score;
  }

  /**
   * Recursive CSP solver with day-balancing candidate ordering and backtracking.
   * @private
   */
  _solve(courses, domains, assignments, index, conflictsResolved) {
    if (index >= courses.length) return true;

    const course = courses[index];
    const domain = domains[course.id];

    // Sort candidate assignments dynamically to favor week-spanning balance
    const sortedCandidates = [...domain].sort((a, b) => {
      const scoreA = this._scoreCandidate(a, course, assignments, courses);
      const scoreB = this._scoreCandidate(b, course, assignments, courses);
      return scoreA - scoreB;
    });

    for (const candidate of sortedCandidates) {
      if (this._isConsistent(course, candidate, assignments, courses)) {
        assignments[course.id] = candidate;

        if (this._solve(courses, domains, assignments, index + 1, conflictsResolved)) {
          return true;
        }

        /* Backtrack — log the fact that we tried & undid this assignment */
        conflictsResolved.push({
          courseId: course.id,
          courseCode: course.code,
          type: 'backtrack',
          original: JSON.stringify(candidate),
          message: `Backtracked ${course.code} from day=${candidate.day} timeSlot=${candidate.timeSlotId}, venue=${candidate.venueId}`
        });
        delete assignments[course.id];
      }
    }

    return false;
  }

  /**
   * Check all four constraint categories for a proposed assignment.
   * @private
   */
  _isConsistent(course, candidate, assignments, courses) {
    const { timeSlotId, venueId } = candidate;

    for (const assignedCourseId in assignments) {
      const assigned = assignments[assignedCourseId];
      const assignedCourse = courses.find(c => c.id == assignedCourseId);

      /* Only courses sharing the same time-slot can clash */
      if (assigned.timeSlotId === timeSlotId) {
        /* Category 1 — Lecturer double-booking */
        if (course.lecturer_id && assignedCourse && assignedCourse.lecturer_id === course.lecturer_id) {
          return false;
        }

        /* Category 2 — Same-level concurrency */
        if (assignedCourse && assignedCourse.level === course.level) {
          return false;
        }

        /* Category 4 — Venue double-booking */
        if (assigned.venueId === venueId) {
          return false;
        }
      }
    }

    /* Category 3 — Venue capacity
       (already filtered when building domains, but kept here for completeness) */
    return true;
  }

  /* ═══════════════════════════════════════════════════
     P4 — FOUR-CATEGORY CONFLICT DETECTION
     ═══════════════════════════════════════════════════ */

  /**
   * Validates a full set of entries against all four conflict categories.
   *
   * @param {Array}  entries  [{course_id, venue_id, time_slot_id}, …]
   * @param {Array}  courses  course rows (from DB)
   * @param {Array}  venues   venue rows (from DB)
   * @returns {Array}  violation objects
   */
  detectConflicts(entries, courses, venues) {
    const conflicts = [];

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];

        if (a.time_slot_id === b.time_slot_id) {
          const cA = courses.find(c => c.id === a.course_id);
          const cB = courses.find(c => c.id === b.course_id);

          /* Category 1 — Lecturer double-booking */
          if (cA && cB && cA.lecturer_id && cA.lecturer_id === cB.lecturer_id) {
            conflicts.push({
              type: 'lecturer_clash',
              category: 1,
              entries: [a, b],
              message: `Lecturer assigned to ${cA.code} and ${cB.code} in the same time slot`
            });
          }

          /* Category 2 — Same-level clash */
          if (cA && cB && cA.level === cB.level) {
            conflicts.push({
              type: 'level_clash',
              category: 2,
              entries: [a, b],
              message: `${cA.code} and ${cB.code} (Level ${cA.level}) are scheduled concurrently`
            });
          }

          /* Category 4 — Venue double-booking */
          if (a.venue_id === b.venue_id) {
            conflicts.push({
              type: 'venue_clash',
              category: 4,
              entries: [a, b],
              message: `Two courses assigned to the same venue in the same time slot`
            });
          }
        }
      }
    }

    /* Category 3 — Venue capacity */
    for (const entry of entries) {
      const course = courses.find(c => c.id === entry.course_id);
      const venue  = venues.find(v => v.id === entry.venue_id);
      if (course && venue && course.expected_students > venue.capacity) {
        conflicts.push({
          type: 'capacity_exceeded',
          category: 3,
          entries: [entry],
          message: `${course.code} (${course.expected_students} students) exceeds ${venue.name} capacity (${venue.capacity})`
        });
      }
    }

    return conflicts;
  }

  /* ═══════════════════════════════════════════════════
     P5 — POST-PUBLICATION RE-ASSIGNMENT
     ═══════════════════════════════════════════════════ */

  /**
   * Admin modifies a single timetable entry.  All four constraint
   * categories are re-checked against every other existing entry.
   *
   * @param {number} entryId
   * @param {number} newTimeSlotId
   * @param {number} newVenueId
   * @returns {{ success:boolean, message:string }}
   */
  async reassignEntry(entryId, newTimeSlotId, newVenueId) {
    /* ── Fetch the entry + its course data ─────────── */
    const [entryRows] = await this.db.query(
      `SELECT te.*, c.lecturer_id, c.level, c.expected_students, c.code
       FROM timetable_entries te
       JOIN courses c ON te.course_id = c.id
       WHERE te.id = ?`,
      [entryId]
    );
    if (!entryRows.length) {
      return { success: false, message: 'Timetable entry not found.' };
    }
    const entry = entryRows[0];

    /* ── Fetch the proposed venue ──────────────────── */
    const [venueRows] = await this.db.query('SELECT * FROM venues WHERE id = ?', [newVenueId]);
    if (!venueRows.length) {
      return { success: false, message: 'Venue not found.' };
    }
    const venue = venueRows[0];

    /* Category 3 — Capacity check */
    if (entry.expected_students > venue.capacity) {
      return {
        success: false,
        message: `${venue.name} (capacity ${venue.capacity}) cannot hold ${entry.expected_students} students for ${entry.code}.`
      };
    }

    /* ── Check against all OTHER entries in the proposed time slot ── */
    const [others] = await this.db.query(
      `SELECT te.*, c.lecturer_id, c.level, c.code
       FROM timetable_entries te
       JOIN courses c ON te.course_id = c.id
       WHERE te.time_slot_id = ? AND te.id != ?`,
      [newTimeSlotId, entryId]
    );

    for (const other of others) {
      /* Category 1 — Lecturer clash */
      if (entry.lecturer_id && entry.lecturer_id === other.lecturer_id) {
        return { success: false, message: `Lecturer conflict: already teaching ${other.code} in this time slot.` };
      }
      /* Category 2 — Level clash */
      if (entry.level === other.level) {
        return { success: false, message: `Level conflict: ${other.code} (Level ${other.level}) already occupies this slot.` };
      }
      /* Category 4 — Venue clash */
      if (newVenueId === other.venue_id) {
        return { success: false, message: `Venue conflict: ${venue.name} already hosts ${other.code} in this slot.` };
      }
    }

    /* ── All clear — apply update & log ────────────── */
    const originalAssignment = JSON.stringify({
      time_slot_id: entry.time_slot_id,
      venue_id: entry.venue_id
    });
    const newAssignment = JSON.stringify({
      time_slot_id: newTimeSlotId,
      venue_id: newVenueId
    });

    await this.db.query(
      'UPDATE timetable_entries SET time_slot_id = ?, venue_id = ? WHERE id = ?',
      [newTimeSlotId, newVenueId, entryId]
    );

    await this.logConflict({
      entryId,
      type: 'manual_reassignment',
      original: originalAssignment,
      updated: newAssignment,
      reason: `Admin reassigned ${entry.code}`
    });

    return { success: true, message: `${entry.code} reassigned successfully.` };
  }

  /* ═══════════════════════════════════════════════════
     CONFLICT LOG / AUDIT TRAIL
     ═══════════════════════════════════════════════════ */

  /**
   * Writes a row into conflict_logs.
   */
  async logConflict({ entryId, type, original, updated, reason }) {
    await this.db.query(
      `INSERT INTO conflict_logs (timetable_entry_id, conflict_type, original_assignment, new_assignment)
       VALUES (?, ?, ?, ?)`,
      [entryId || null, type || 'unknown', original || '', updated || reason || '']
    );
  }

  /* ═══════════════════════════════════════════════════
     QUERY HELPERS  (used by route handlers)
     ═══════════════════════════════════════════════════ */

  /** Fetch full timetable with JOINed course/venue/slot/lecturer data. */
  async getTimetable(filters = {}) {
    let sql = `
      SELECT
        te.id, te.status, te.created_at,
        c.id   AS course_id,   c.code,  c.title, c.unit, c.level, c.expected_students,
        v.id   AS venue_id,    v.name   AS venue_name, v.capacity,
        ts.id  AS time_slot_id, ts.day,  ts.start_time, ts.end_time,
        l.id   AS lecturer_id,
        u.name AS lecturer_name
      FROM timetable_entries te
      JOIN courses    c  ON te.course_id   = c.id
      JOIN venues     v  ON te.venue_id    = v.id
      JOIN time_slots ts ON te.time_slot_id = ts.id
      LEFT JOIN lecturers l ON c.lecturer_id = l.id
      LEFT JOIN users     u ON l.user_id     = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      sql += ' AND te.status = ?';
      params.push(filters.status);
    }
    if (filters.level) {
      sql += ' AND c.level = ?';
      params.push(filters.level);
    }
    if (filters.lecturerId) {
      sql += ' AND c.lecturer_id = ?';
      params.push(filters.lecturerId);
    }

    sql += ` ORDER BY FIELD(ts.day, 'Monday','Tuesday','Wednesday','Thursday','Friday'), ts.start_time, c.code`;

    const [rows] = await this.db.query(sql, params);
    return rows;
  }

  /** Fetch conflict log entries, newest first. */
  async getConflictLogs() {
    const [rows] = await this.db.query(
      `SELECT cl.*, te.course_id, c.code AS course_code
       FROM conflict_logs cl
       LEFT JOIN timetable_entries te ON cl.timetable_entry_id = te.id
       LEFT JOIN courses c ON te.course_id = c.id
       ORDER BY cl.resolved_at DESC`
    );
    return rows;
  }

  /** Approve (publish) the current draft timetable. */
  async publishTimetable() {
    const [result] = await this.db.query(
      `UPDATE timetable_entries SET status = 'published' WHERE status = 'draft'`
    );
    return { success: true, count: result.affectedRows };
  }

  /** Dashboard statistics. */
  async getStats() {
    const [[{ totalCourses }]]    = await this.db.query('SELECT COUNT(*) AS totalCourses FROM courses');
    const [[{ totalLecturers }]]  = await this.db.query('SELECT COUNT(*) AS totalLecturers FROM lecturers');
    const [[{ totalStudents }]]   = await this.db.query("SELECT COUNT(*) AS totalStudents FROM users WHERE role = 'student'");
    const [[{ totalVenues }]]     = await this.db.query('SELECT COUNT(*) AS totalVenues FROM venues');
    const [[{ totalSlots }]]      = await this.db.query('SELECT COUNT(*) AS totalSlots FROM time_slots');
    const [[{ draftEntries }]]    = await this.db.query(`SELECT COUNT(*) AS draftEntries FROM timetable_entries WHERE status='draft'`);
    const [[{ publishedEntries }]]= await this.db.query(`SELECT COUNT(*) AS publishedEntries FROM timetable_entries WHERE status='published'`);
    const [[{ totalConflicts }]]  = await this.db.query('SELECT COUNT(*) AS totalConflicts FROM conflict_logs');

    return { totalCourses, totalLecturers, totalStudents, totalVenues, totalSlots, draftEntries, publishedEntries, totalConflicts };
  }
}

module.exports = TimetableEngine;
