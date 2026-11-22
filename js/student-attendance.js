
import { supabase } from './supabase.js';

const $ = id => document.getElementById(id);

let allRecords = [];

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[char]);
}

function showMessage(message, type = 'danger') {
  $('message').innerHTML = `
    <div class="alert alert-${type}">
      ${escapeHTML(message)}
    </div>`;
}

function getCounts(records) {
  return {
    total: records.length,
    present: records.filter(r => r.status === 'Present').length,
    absent: records.filter(r => r.status === 'Absent').length,
    late: records.filter(r => r.status === 'Late').length,
    leave: records.filter(r => r.status === 'Leave').length
  };
}

function getPercentage(records) {
  if (!records.length) return 0;

  const counts = getCounts(records);

  // Late ko attended class mein count kiya gaya hai.
  return Math.round(((counts.present + counts.late) / counts.total) * 100);
}

function statusBadge(status) {
  const colors = {
    Present: 'success',
    Absent: 'danger',
    Late: 'warning',
    Leave: 'info'
  };

  const color = colors[status] || 'secondary';

  return `<span class="badge bg-${color} badge-status">
    ${escapeHTML(status)}
  </span>`;
}

function renderStats(records) {
  const counts = getCounts(records);

  $('totalClasses').textContent = counts.total;
  $('presentCount').textContent = counts.present;
  $('absentCount').textContent = counts.absent;
  $('lateCount').textContent = counts.late;
  $('leaveCount').textContent = counts.leave;
  $('attendancePercent').textContent = getPercentage(records) + '%';
  $('recordCount').textContent = records.length;
}

function renderCourseSummary(records) {
  const groups = {};

  records.forEach(record => {
    const id = record.course_id;

    if (!groups[id]) {
      groups[id] = {
        course_code: record.course_code,
        course_name: record.course_name,
        records: []
      };
    }

    groups[id].records.push(record);
  });

  const summaries = Object.values(groups);

  if (!summaries.length) {
    $('courseSummary').innerHTML =
      '<tr><td colspan="8" class="text-center">No attendance records found.</td></tr>';
    return;
  }

  $('courseSummary').innerHTML = summaries.map(group => {
    const counts = getCounts(group.records);

    return `
      <tr>
        <td>${escapeHTML(group.course_code)}</td>
        <td>${escapeHTML(group.course_name)}</td>
        <td>${counts.total}</td>
        <td>${counts.present}</td>
        <td>${counts.absent}</td>
        <td>${counts.late}</td>
        <td>${counts.leave}</td>
        <td><strong>${getPercentage(group.records)}%</strong></td>
      </tr>`;
  }).join('');
}

function renderHistory(records) {
  if (!records.length) {
    $('attendanceHistory').innerHTML =
      '<tr><td colspan="5" class="text-center">No attendance records found.</td></tr>';
    return;
  }

  $('attendanceHistory').innerHTML = records.map(record => `
    <tr>
      <td>${escapeHTML(record.attendance_date)}</td>
      <td>${escapeHTML(record.course_code)}</td>
      <td>${escapeHTML(record.course_name)}</td>
      <td>${statusBadge(record.status)}</td>
      <td>${escapeHTML(record.remarks || '-')}</td>
    </tr>
  `).join('');
}

function renderPage(records) {
  renderStats(records);
  renderCourseSummary(records);
  renderHistory(records);
}

function applyFilters() {
  const courseId = $('courseFilter').value;
  const fromDate = $('fromDate').value;
  const toDate = $('toDate').value;

  if (fromDate && toDate && fromDate > toDate) {
    showMessage('From Date cannot be later than To Date.', 'warning');
    return;
  }

  const filtered = allRecords.filter(record => {
    if (courseId && record.course_id !== courseId) return false;
    if (fromDate && record.attendance_date < fromDate) return false;
    if (toDate && record.attendance_date > toDate) return false;
    return true;
  });

  $('message').innerHTML = '';
  renderPage(filtered);
}

function resetFilters() {
  $('courseFilter').value = '';
  $('fromDate').value = '';
  $('toDate').value = '';
  $('message').innerHTML = '';
  renderPage(allRecords);
}

async function loadAttendance() {
  const { data: { user }, error: authError } =
    await supabase.auth.getUser();

  if (authError || !user) {
    window.location.href = 'student-login.html';
    return;
  }

  // Load only the logged-in student's linked record.
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('student_id, full_name, roll_no')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (studentError) throw studentError;

  if (!student) {
    showMessage('Student account is not linked. Please contact the administrator.');
    return;
  }

  $('studentName').textContent = student.full_name;
  $('studentRoll').textContent = 'Roll No: ' + student.roll_no;

  // Load this student's semester history.
  const { data: histories, error: historyError } = await supabase
    .from('student_semester_history')
    .select('history_id')
    .eq('student_id', student.student_id);

  if (historyError) throw historyError;

  const historyIds = (histories || []).map(h => h.history_id);

  if (!historyIds.length) {
    allRecords = [];
    renderPage([]);
    $('courseSummary').innerHTML =
      '<tr><td colspan="8" class="text-center">No semester history found.</td></tr>';
    return;
  }

  // Load only this student's course enrollments.
  const { data: enrollments, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('enrollment_id, course_id')
    .in('history_id', historyIds);

  if (enrollmentError) throw enrollmentError;

  if (!enrollments?.length) {
    allRecords = [];
    renderPage([]);
    return;
  }

  const enrollmentIds = enrollments.map(e => e.enrollment_id);
  const courseIds = [...new Set(enrollments.map(e => e.course_id))];

  // Load course details.
  const { data: courses, error: courseError } = await supabase
    .from('courses')
    .select('course_id, course_code, course_name')
    .in('course_id', courseIds);

  if (courseError) throw courseError;

  // Load attendance for this student's enrollments only.
  const { data: attendance, error: attendanceError } = await supabase
    .from('attendance')
    .select('enrollment_id, attendance_date, status, remarks')
    .in('enrollment_id', enrollmentIds)
    .order('attendance_date', { ascending: false });

  if (attendanceError) throw attendanceError;

  const courseMap = new Map(
    (courses || []).map(course => [course.course_id, course])
  );

  const enrollmentMap = new Map(
    enrollments.map(enrollment => [
      enrollment.enrollment_id,
      enrollment.course_id
    ])
  );

  allRecords = (attendance || []).map(record => {
    const courseId = enrollmentMap.get(record.enrollment_id);
    const course = courseMap.get(courseId);

    return {
      ...record,
      course_id: courseId,
      course_code: course?.course_code || 'N/A',
      course_name: course?.course_name || 'Unknown Course'
    };
  }).filter(record => record.course_id);

  // Build course filter options.
  const uniqueCourses = [...new Map(
    allRecords.map(record => [
      record.course_id,
      {
        course_id: record.course_id,
        course_code: record.course_code,
        course_name: record.course_name
      }
    ])
  ).values()];

  $('courseFilter').innerHTML =
    '<option value="">All Courses</option>' +
    uniqueCourses.map(course => `
      <option value="${escapeHTML(course.course_id)}">
        ${escapeHTML(course.course_code)} - ${escapeHTML(course.course_name)}
      </option>
    `).join('');

  renderPage(allRecords);
}

$('filterBtn').addEventListener('click', applyFilters);
$('resetBtn').addEventListener('click', resetFilters);

try {
  await loadAttendance();
} catch (error) {
  console.error('Student attendance error:', error);
  showMessage('Unable to load attendance: ' + error.message);
}
