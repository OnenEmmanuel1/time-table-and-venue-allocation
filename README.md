# TimetablePro

**Timetable and Lecture Venue Allocation System**  
*Faculty of Computing, Cross River University of Technology (UNICROSS)*

---

## 📌 Project Overview & Description

**TimetablePro** is an automated web-based **Timetable and Lecture Venue Allocation System** engineered specifically for academic environments like the Faculty of Computing at UNICROSS.

Manual timetable construction in universities frequently leads to scheduling conflicts—such as lecturer double-booking, room capacity violations, level-wide course overlaps, and inefficient venue utilization. **TimetablePro** addresses these challenges by employing an intelligent **Constraint Satisfaction Problem (CSP)** engine (greedy selection combined with recursive backtracking) to generate conflict-free, highly optimized academic schedules automatically.

### 🌟 Key Features & Capabilities

- **Automatic Conflict-Free Timetable Generation:** Employs a CSP scheduling engine (`engine/ttvEngine.js`) to allocate time slots and venues to course sessions while enforcing strict constraint checks.
- **Comprehensive Conflict Auditing:** Logs all constraint violations and algorithm backtracking attempts to provide full visibility into schedule generation.
- **Role-Based Access Control (RBAC):** Features dedicated portals and controls for **Admins**, **HODs**, **Lecturers**, and **Students**.
- **Venue & Resource Management:** Manages lecture halls, laboratories, seating capacities, and availability time slots.
- **Course & Level Coordination:** Maps courses to academic levels and expected student capacity to guarantee proper venue allocation without over-capacity issues.
- **Interactive Timetable Grid:** Responsive, filterable schedule grid views by Level, Lecturer, Venue, and Department.

---


## Stack

- **Backend:** Node.js + Express.js
- **Templating:** EJS with partials
- **Database:** MySQL 8 (mysql2, parameterized queries only)
- **Auth:** express-session + bcryptjs
- **Scheduling:** CSP solver (greedy + backtracking) in `engine/ttvEngine.js`
- **Styling:** Flat CSS design system (`ttv-*` prefix), Bootstrap 5 CDN, Inter font

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- MySQL 8 running locally

### Steps

1. **Clone and install**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your MySQL credentials
   ```

3. **Initialize database**
   ```bash
   npm run init-db
   ```

4. **Start the application**
   ```bash
   npm run dev
   ```

5. **Open browser**
   Navigate to `http://localhost:3000`

---

## Quick Start (Docker)

```bash
docker-compose up --build
```

The app will be available at `http://localhost:3000`.

---

## Default Test Credentials

| Role       | Email                          | Password      |
|------------|--------------------------------|---------------|
| Admin      | admin@unicross.edu.ng          | password123   |
| HOD        | hod@unicross.edu.ng            | password123   |
| Lecturer 1 | lecturer1@unicross.edu.ng      | password123   |
| Lecturer 2 | lecturer2@unicross.edu.ng      | password123   |
| Lecturer 3 | lecturer3@unicross.edu.ng      | password123   |
| Student 1  | student1@unicross.edu.ng       | password123   |
| Student 2  | student2@unicross.edu.ng       | password123   |
| Student 3  | student3@unicross.edu.ng       | password123   |
| Student 4  | student4@unicross.edu.ng       | password123   |
| Student 5  | student5@unicross.edu.ng       | password123   |

---

## Seed Data Overview

- **10 Users:** 1 Admin, 1 HOD, 3 Lecturers, 5 Students (3 × Level 100, 2 × Level 200)
- **8 Courses:** 4 × Level 100, 4 × Level 200
- **4 Venues:** Lecture Theatre 1 (200), Lecture Theatre 2 (150), Computer Room 1 (100), Computer Room 2 (40)
- **20 Time Slots:** Monday–Friday, 4 per day (8–10, 10–12, 12–2, 2–4)

---

## Project Structure

```
├── app.js                    # Entry point
├── config/
│   ├── db.js                 # MySQL connection pool
│   └── session.js            # Session configuration
├── middleware/
│   └── auth.js               # Authentication & role guards
├── engine/
│   └── ttvEngine.js          # Scheduling algorithm + conflict detection
├── routes/
│   ├── api/                  # JSON API endpoints
│   │   ├── auth.js
│   │   ├── courses.js
│   │   ├── lecturers.js
│   │   ├── venues.js
│   │   ├── timeslots.js
│   │   └── timetable.js
│   └── pages/                # Page-rendering routes
│       ├── auth.js
│       ├── admin.js
│       ├── hod.js
│       ├── lecturer.js
│       └── student.js
├── views/
│   ├── partials/             # Reusable EJS partials
│   │   ├── header.ejs
│   │   ├── footer.ejs
│   │   ├── navbar-*.ejs      # Role-specific navbars
│   │   ├── sidebar-*.ejs     # Role-specific sidebars
│   │   └── timetable-grid.ejs
│   ├── login.ejs
│   ├── error.ejs
│   ├── admin/                # Admin views
│   ├── hod/                  # HOD views
│   ├── lecturer/             # Lecturer views
│   └── student/              # Student views
├── public/
│   ├── css/style.css         # Flat design system (ttv-* prefix)
│   └── js/                   # Client-side JavaScript
├── db/
│   ├── schema.sql            # Table definitions
│   ├── seed.sql              # Seed data (reference)
│   └── init.js               # Database initializer
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## Scheduling Algorithm

The engine (`engine/ttvEngine.js`) models timetable generation as a **Constraint Satisfaction Problem (CSP)**:

1. **Variables:** Course sessions
2. **Domains:** All valid (time slot × venue) combinations where venue capacity ≥ expected students
3. **Constraints:** Four categories validated sequentially:
   - **Cat 1:** No lecturer double-booking
   - **Cat 2:** No same-level concurrency
   - **Cat 3:** No venue over-capacity
   - **Cat 4:** No venue double-booking

**Solving strategy:** Greedy initial assignment (courses ordered by student count DESC) with recursive backtracking on constraint violations. Every backtrack is logged to the conflict audit trail.

---

## License

MIT
