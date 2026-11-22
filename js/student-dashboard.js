
import { supabase } from './supabase.js';

const messageBox = document.getElementById('dashboardMessage');

function showMessage(message, type = 'danger') {
  const div = document.createElement('div');
  div.className = `alert alert-${type}`;
  div.textContent = message;
  messageBox.replaceChildren(div);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value ?? '—';
}

function money(value) {
  return 'PKR ' + Number(value || 0).toLocaleString('en-PK', {
    maximumFractionDigits: 2
  });
}

function safeCell(value) {
  return value === null || value === undefined || value === ''
    ? '—'
    : String(value);
}

function addTableMessage(id, columns, message) {
  const body = document.getElementById(id);
  const row = document.createElement('tr');
  const cell = document.createElement('td');

  cell.colSpan = columns;
  cell.className = 'text-center text-muted py-3';
  cell.textContent = message;

  row.appendChild(cell);
  body.replaceChildren(row);
}

function addRow(body, values) {
  const row = document.createElement('tr');

  values.forEach(value => {
    const cell = document.createElement('td');

    if (value instanceof HTMLElement) {
      cell.appendChild(value);
    } else {
      cell.textContent = safeCell(value);
    }

    row.appendChild(cell);
  });

  body.appendChild(row);
}

function makeStatus(text) {
  const badge = document.createElement('span');
  badge.className = 'badge rounded-pill text-bg-light';
  badge.textContent = safeCell(text);
  return badge;
}

// Display student's profile photo or initials
async function loadDashboardPhoto(student) {
  const avatar = document.getElementById('studentInitials');

  if (!avatar) return;

  const initials = (student.full_name || 'Student')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word.charAt(0).toUpperCase())
    .join('');

  // Show initials first as fallback
  avatar.textContent = initials || 'S';

  // No uploaded photo
  if (!student.photo_path) return;

  try {
    const { data, error } = await supabase.storage
      .from('student-photos')
      .createSignedUrl(student.photo_path, 3600);

    if (error) throw error;

    if (!data?.signedUrl) return;

    const image = document.createElement('img');

    image.src = data.signedUrl;
    image.alt = 'Student Profile Photo';
    image.className = 'dashboard-profile-photo';

    image.onerror = () => {
      image.remove();
      avatar.textContent = initials || 'S';
    };

    avatar.replaceChildren(image);

  } catch (error) {
    console.error('Dashboard photo loading error:', error);
    avatar.textContent = initials || 'S';
  }
}

async function loadDashboard() {
  // Check signed-in user
  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData.user) {
    window.location.replace('student-login.html');
    return;
  }

  const user = authData.user;

  // Load the linked student record
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select(`
      student_id,
      full_name,
      roll_no,
      email,
      phone,
      department_id,
      current_semester_id,
      status,
      photo_path
    `)
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (studentError) throw studentError;

  if (!student) {
    showMessage(
      'Your account is not linked to a student record yet. Please login again or contact the department administrator.',
      'warning'
    );
    return;
  }

  // Student profile summary
  setText('studentName', student.full_name);
  setText('profileName', student.full_name);
  setText('profileRoll', student.roll_no);
  setText('profileEmail', student.email);
  setText('profilePhone', student.phone);
  setText('profileStatus', student.status);

  // Load profile photo into dashboard avatar
  await loadDashboardPhoto(student);

  // Department
  if (student.department_id) {
    const { data: department, error } = await supabase
      .from('departments')
      .select('department_name')
      .eq('department_id', student.department_id)
      .maybeSingle();

    if (error) throw error;

    setText('profileDepartment', department?.department_name || '—');
  }

  // Current semester
  if (student.current_semester_id) {
    const { data: semester, error } = await supabase
      .from('semesters')
      .select('semester_name, semester_number')
      .eq('semester_id', student.current_semester_id)
      .maybeSingle();

    if (error) throw error;

    setText(
      'profileSemester',
      semester
        ? (semester.semester_name || `Semester ${semester.semester_number}`)
        : '—'
    );
  }

  // Student semester history
  const { data: histories, error: historyError } = await supabase
    .from('student_semester_history')
    .select('history_id, semester_id, academic_term_id, status, start_date')
    .eq('student_id', student.student_id)
    .order('start_date', { ascending: false });

  if (historyError) throw historyError;

  const historyIds = (histories || []).map(item => item.history_id);

  // Load enrollments for this student
  let enrollments = [];

  if (historyIds.length) {
    const { data, error } = await supabase
      .from('enrollments')
      .select('enrollment_id, course_id, status')
      .in('history_id', historyIds);

    if (error) throw error;
    enrollments = data || [];
  }

  const enrollmentIds = enrollments.map(item => item.enrollment_id);
  const courseIds = [...new Set(enrollments.map(item => item.course_id))];

  // Courses
  let courses = [];

  if (courseIds.length) {
    const { data, error } = await supabase
      .from('courses')
      .select('course_id, course_code, course_name, credit_hours')
      .in('course_id', courseIds);

    if (error) throw error;
    courses = data || [];
  }

  const courseMap = new Map(
    courses.map(course => [course.course_id, course])
  );

  const coursesBody = document.getElementById('coursesTable');
  coursesBody.replaceChildren();

  if (!enrollments.length) {
    addTableMessage('coursesTable', 4, 'No enrolled courses found.');
  } else {
    enrollments.forEach(enrollment => {
      const course = courseMap.get(enrollment.course_id);

      if (course) {
        addRow(coursesBody, [
          course.course_code,
          course.course_name,
          course.credit_hours,
          makeStatus(enrollment.status)
        ]);
      }
    });
  }

  setText('courseCount', enrollments.length);

  // Attendance summary
  let attendanceRecords = [];

  if (enrollmentIds.length) {
    const { data, error } = await supabase
      .from('attendance')
      .select('enrollment_id, attendance_date, status')
      .in('enrollment_id', enrollmentIds);

    if (error) throw error;
    attendanceRecords = data || [];
  }

  if (attendanceRecords.length) {
    const attended = attendanceRecords.filter(record =>
      ['present', 'late'].includes(
        String(record.status || '').toLowerCase()
      )
    ).length;

    const percentage = (attended / attendanceRecords.length) * 100;
    setText('attendancePercentage', `${percentage.toFixed(1)}%`);
  } else {
    setText('attendancePercentage', '—');
  }

  // Results
  let results = [];

  if (enrollmentIds.length) {
    const { data, error } = await supabase
      .from('student_course_results')
      .select('enrollment_id, total_marks, obtained_marks, percentage, grade, status')
      .in('enrollment_id', enrollmentIds);

    if (error) throw error;
    results = data || [];
  }

  const resultsBody = document.getElementById('resultsTable');
  resultsBody.replaceChildren();

  if (!results.length) {
    addTableMessage('resultsTable', 6, 'No published results available yet.');
  } else {
    results.forEach(result => {
      const enrollment = enrollments.find(
        item => item.enrollment_id === result.enrollment_id
      );

      const course = enrollment
        ? courseMap.get(enrollment.course_id)
        : null;

      addRow(resultsBody, [
        course?.course_name || 'Course',
        result.obtained_marks,
        result.total_marks,
        `${Number(result.percentage).toFixed(2)}%`,
        result.grade,
        makeStatus(result.status)
      ]);
    });
  }

  setText('resultCount', results.length);

  // Fee records
  const { data: fees, error: feeError } = await supabase
    .from('fees')
    .select('fee_id, fee_type, total_amount, due_date, status')
    .eq('student_id', student.student_id);

  if (feeError) throw feeError;

  const feeIds = (fees || []).map(fee => fee.fee_id);
  let payments = [];

  if (feeIds.length) {
    const { data, error } = await supabase
      .from('fee_payments')
      .select('fee_id, amount_paid')
      .in('fee_id', feeIds);

    if (error) throw error;
    payments = data || [];
  }

  const feesBody = document.getElementById('feesTable');
  feesBody.replaceChildren();

  let outstanding = 0;

  if (!fees || !fees.length) {
    addTableMessage('feesTable', 4, 'No fee records available.');
  } else {
    fees.forEach(fee => {
      const paid = payments
        .filter(payment => payment.fee_id === fee.fee_id)
        .reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0);

      const balance = Math.max(0, Number(fee.total_amount || 0) - paid);
      outstanding += balance;

      const status = balance <= 0
        ? 'Paid'
        : paid > 0
          ? 'Partially Paid'
          : (fee.status || 'Unpaid');

      addRow(feesBody, [
        fee.fee_type,
        money(fee.total_amount),
        fee.due_date,
        makeStatus(status)
      ]);
    });
  }

  setText('feeBalance', money(outstanding));
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
  const button = document.getElementById('logoutBtn');
  button.disabled = true;
  button.textContent = 'Logging out...';

  const { error } = await supabase.auth.signOut();

  if (error) {
    showMessage(error.message);
    button.disabled = false;
    button.textContent = 'Logout';
    return;
  }

  window.location.replace('student-login.html');
});

// Start dashboard
loadDashboard().catch(error => {
  console.error('Student dashboard error:', error);
  showMessage(error.message || 'Unable to load student dashboard.');
});
