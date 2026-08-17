const http = require('http');
const app = require('../app');

async function testHttpEndpoints() {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`🌐 Server running on port ${port} for integration tests\n`);

  let cookie = '';

  // Helper request function
  async function request(path, options = {}) {
    const url = baseUrl + path;
    const headers = options.headers || {};
    if (cookie) headers['Cookie'] = cookie;
    if (options.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    const res = await fetch(url, {
      ...options,
      headers
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      cookie = setCookie.split(';')[0];
    }
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data, headers: res.headers };
  }

  try {
    // 1. Admin Login
    console.log('1. Logging in as Admin...');
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@unicross.edu.ng', password: 'password123' }
    });
    console.log(`   Status: ${loginRes.status}, User: ${loginRes.data?.user?.name} (${loginRes.data?.user?.role})`);
    if (loginRes.status !== 200 || !loginRes.data.success) throw new Error('Admin login failed');

    // 2. Fetch Admin Students Page
    console.log('\n2. Fetching GET /admin/students (Admin HTML Page)...');
    const studentsPageRes = await request('/admin/students');
    console.log(`   Status: ${studentsPageRes.status}, Content Length: ${studentsPageRes.data.length}`);
    if (studentsPageRes.status !== 200 || !studentsPageRes.data.includes('Students')) {
      throw new Error('Failed to load /admin/students page');
    }

    // 3. Fetch Admin Dashboard
    console.log('\n3. Fetching GET /admin/dashboard...');
    const dashboardRes = await request('/admin/dashboard');
    console.log(`   Status: ${dashboardRes.status}, Includes Students card: ${dashboardRes.data.includes('stat-students')}`);
    if (dashboardRes.status !== 200 || !dashboardRes.data.includes('stat-students')) {
      throw new Error('Failed to load /admin/dashboard or missing stat-students');
    }

    // 4. Create Student via API
    console.log('\n4. Creating Student via POST /api/students...');
    const createRes = await request('/api/students', {
      method: 'POST',
      body: {
        name: 'Chioma Okeke',
        email: 'chioma.okeke@unicross.edu.ng',
        level: 200,
        password: 'password123'
      }
    });
    console.log(`   Status: ${createRes.status}, Created Student ID: ${createRes.data.id}`);
    if (createRes.status !== 201 || !createRes.data.id) throw new Error('Failed to create student via API');
    const createdStudentId = createRes.data.id;

    // 5. List Students via API
    console.log('\n5. Listing Students via GET /api/students...');
    const listRes = await request('/api/students');
    console.log(`   Status: ${listRes.status}, Total Students: ${listRes.data.length}`);
    const found = listRes.data.find(s => s.id === createdStudentId);
    if (!found || found.name !== 'Chioma Okeke') throw new Error('Created student not found in list API');
    console.log(`   ✅ Found newly created student: ${found.name} (Level ${found.level})`);

    // 6. Update Student via API
    console.log('\n6. Updating Student via PUT /api/students/' + createdStudentId + '...');
    const updateRes = await request('/api/students/' + createdStudentId, {
      method: 'PUT',
      body: {
        name: 'Chioma Okeke-Etim',
        email: 'chioma.okeke@unicross.edu.ng',
        level: 300
      }
    });
    console.log(`   Status: ${updateRes.status}, Response:`, updateRes.data);
    if (updateRes.status !== 200 || !updateRes.data.success) throw new Error('Failed to update student');

    // 7. Test Student Login with Created Credentials
    console.log('\n7. Testing Student Login for created account...');
    // Create new session for student
    cookie = '';
    const studentLoginRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'chioma.okeke@unicross.edu.ng', password: 'password123' }
    });
    console.log(`   Status: ${studentLoginRes.status}, Role: ${studentLoginRes.data?.user?.role}, Level: ${studentLoginRes.data?.user?.level}`);
    if (studentLoginRes.status !== 200 || studentLoginRes.data?.user?.role !== 'student') {
      throw new Error('Student login failed');
    }

    // 8. Fetch Student Dashboard
    console.log('\n8. Fetching GET /student/dashboard as Student...');
    const studentDashRes = await request('/student/dashboard');
    console.log(`   Status: ${studentDashRes.status}`);
    if (studentDashRes.status !== 200) throw new Error('Student dashboard fetch failed');

    // 9. Re-login as Admin and Delete Student
    console.log('\n9. Re-logging as Admin and Deleting created student...');
    cookie = '';
    await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@unicross.edu.ng', password: 'password123' }
    });
    const deleteRes = await request('/api/students/' + createdStudentId, {
      method: 'DELETE'
    });
    console.log(`   Status: ${deleteRes.status}, Response:`, deleteRes.data);
    if (deleteRes.status !== 200 || !deleteRes.data.success) throw new Error('Student deletion failed');

    // 10. Generate Timetable via API
    console.log('\n10. Generating Timetable via POST /api/timetable/generate...');
    const genRes = await request('/api/timetable/generate', { method: 'POST' });
    console.log(`   Status: ${genRes.status}, Response:`, genRes.data);
    if (genRes.status !== 200 || !genRes.data.success) throw new Error('Timetable generation API failed');

    // 11. Fetch Timetable via API
    console.log('\n11. Fetching Timetable via GET /api/timetable...');
    const ttRes = await request('/api/timetable');
    console.log(`   Status: ${ttRes.status}, Total Entries: ${ttRes.data.length}`);
    const days = [...new Set(ttRes.data.map(e => e.day))];
    console.log(`   Entries scheduled across days: ${days.join(', ')}`);
    if (days.length < 3) throw new Error('Timetable is not distributed across the week');

    console.log('\n✨ ALL EXPRESS INTEGRATION TESTS PASSED PERFECTLY! ✨\n');
  } finally {
    server.close();
    process.exit(0);
  }
}

testHttpEndpoints().catch(err => {
  console.error('\n❌ Express Integration Test Failed:', err);
  process.exit(1);
});
