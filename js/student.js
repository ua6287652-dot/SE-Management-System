import { supabase } from './supabase.js';

const $ = (id) => document.getElementById(id);
const message = $('pageMessage');
let students = [];
let semesterRows = [];

function showMessage(text, type = 'success') {
  message.innerHTML = '';
  const alertBox = document.createElement('div');
  alertBox.className = `alert alert-${type}`;
  alertBox.textContent = text;
  message.appendChild(alertBox);
}

async function requireAdmin() {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    window.location.replace('login.html');
    return false;
  }

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (error || !profile || profile.role !== 'admin') {
    await supabase.auth.signOut();
    window.location.replace('login.html');
    return false;
  }
  return true;
}

async function loadDropdowns() {
  const [departmentsRes, semestersRes, termsRes] = await Promise.all([
    supabase.from('departments').select('department_id, department_name, department_code').order('department_name'),
    supabase.from('semesters').select('semester_id, department_id, semester_number, semester_name').order('semester_number'),
    supabase.from('academic_terms').select('academic_term_id, academic_year, term_name, status').order('start_date', { ascending: false })
  ]);

  if (departmentsRes.error) throw departmentsRes.error;
  if (semestersRes.error) throw semestersRes.error;
  if (termsRes.error) throw termsRes.error;

  semesterRows = semestersRes.data || [];

  const departmentSelect = $('department_id');
  departmentSelect.innerHTML = '<option value="">Select Department</option>';
  (departmentsRes.data || []).forEach(row => {
    const option = document.createElement('option');
    option.value = row.department_id;
    option.textContent = `${row.department_name} (${row.department_code})`;
    departmentSelect.appendChild(option);
  });

  fillSemesters('');

  const termSelect = $('academic_term_id');
  termSelect.innerHTML = '<option value="">Select Academic Term</option>';
  (termsRes.data || []).forEach(row => {
    const option = document.createElement('option');
    option.value = row.academic_term_id;
    option.textContent = `${row.academic_year} - ${row.term_name}${row.status ? ' (' + row.status + ')' : ''}`;
    termSelect.appendChild(option);
  });
}

function fillSemesters(departmentId) {
  const select = $('semester_id');
  select.innerHTML = '<option value="">Select Semester</option>';
  semesterRows
    .filter(row => !departmentId || row.department_id === departmentId)
    .forEach(row => {
      const option = document.createElement('option');
      option.value = row.semester_id;
      option.textContent = row.semester_name || `Semester ${row.semester_number}`;
      select.appendChild(option);
    });
}

$('department_id').addEventListener('change', () => fillSemesters($('department_id').value));

async function loadStudents() {
  const { data, error } = await supabase
    .from('students')
    .select('student_id, department_id, current_semester_id, roll_no, full_name, email, phone, gender, date_of_birth, address, admission_date, status, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  students = data || [];
  renderStudents(students);
}

function renderStudents(rows) {
  const tbody = $('studentsTable');
  tbody.innerHTML = '';
  $('studentTotal').textContent = `Showing ${rows.length} of ${students.length} students`;

  if (!rows.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.className = 'text-center text-muted';
    td.textContent = 'No students found.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  rows.forEach(student => {
    const tr = document.createElement('tr');
    [student.roll_no, student.full_name, student.email || '-', student.phone || '-', student.status || '-']
      .forEach(value => {
        const td = document.createElement('td');
        td.textContent = value;
        tr.appendChild(td);
      });

    const actions = document.createElement('td');
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'btn btn-sm btn-warning me-2';
    edit.innerHTML = '<i class="bi bi-pencil"></i>';
    edit.title = 'Edit';
    edit.addEventListener('click', () => startEdit(student.student_id));

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn btn-sm btn-outline-danger';
    remove.innerHTML = '<i class="bi bi-trash"></i>';
    remove.title = 'Delete';
    remove.addEventListener('click', () => deleteStudent(student.student_id));

    actions.append(edit, remove);
    tr.appendChild(actions);
    tbody.appendChild(tr);
  });
}

function resetForm() {
  $('studentForm').reset();
  $('editingStudentId').value = '';
  $('formTitle').textContent = 'Register New Student';
  $('saveStudentBtn').innerHTML = '<i class="bi bi-person-plus"></i> Register Student';
  $('cancelEditBtn').classList.add('d-none');
  $('department_id').dispatchEvent(new Event('change'));
}

function startEdit(id) {
  const student = students.find(row => row.student_id === id);
  if (!student) return;

  $('editingStudentId').value = student.student_id;
  $('roll_no').value = student.roll_no || '';
  $('full_name').value = student.full_name || '';
  $('email').value = student.email || '';
  $('phone').value = student.phone || '';
  $('gender').value = student.gender || '';
  $('date_of_birth').value = student.date_of_birth || '';
  $('address').value = student.address || '';
  $('admission_date').value = student.admission_date || '';

  $('department_id').value = student.department_id || '';
  fillSemesters(student.department_id || '');
  $('semester_id').value = student.current_semester_id || '';

  $('formTitle').textContent = 'Edit Student';
  $('saveStudentBtn').innerHTML = '<i class="bi bi-check-circle"></i> Update Student';
  $('cancelEditBtn').classList.remove('d-none');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$('cancelEditBtn').addEventListener('click', resetForm);

$('studentForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('saveStudentBtn');
  button.disabled = true;

  try {
    const id = $('editingStudentId').value;
    const baseData = {
      roll_no: $('roll_no').value.trim(),
      full_name: $('full_name').value.trim(),
      email: $('email').value.trim() || null,
      phone: $('phone').value.trim() || null,
      gender: $('gender').value || null,
      date_of_birth: $('date_of_birth').value || null,
      address: $('address').value.trim() || null,
      admission_date: $('admission_date').value || null
    };

    if (id) {
      // Edit personal details only. Semester changes should use a promotion/transfer workflow.
      const { error } = await supabase.from('students').update(baseData).eq('student_id', id);
      if (error) throw error;
      showMessage('Student details updated successfully.');
    } else {
      const departmentId = $('department_id').value;
      const semesterId = $('semester_id').value;
      const termId = $('academic_term_id').value;
      if (!departmentId || !semesterId || !termId) {
        throw new Error('Please select department, semester and academic term.');
      }

      const { error } = await supabase.rpc('register_student', {
        department_id: departmentId,
        semester_id: semesterId,
        academic_term_id: termId,
        roll_no: baseData.roll_no,
        full_name: baseData.full_name,
        email: baseData.email,
        phone: baseData.phone,
        gender: baseData.gender,
        date_of_birth: baseData.date_of_birth,
        address: baseData.address,
        admission_date: baseData.admission_date
      });
      if (error) throw error;
      showMessage('Student registered successfully.');
    }

    resetForm();
    await loadStudents();
  } catch (error) {
    showMessage(error.message || 'Unable to save student.', 'danger');
  } finally {
    button.disabled = false;
  }
});

async function deleteStudent(id) {
  const student = students.find(row => row.student_id === id);
  if (!student) return;

  const confirmed = confirm(
    `Delete student ${student.full_name} (${student.roll_no})? This may be blocked if related academic/fee records exist.`
  );
  if (!confirmed) return;

  try {
    const { error } = await supabase.from('students').delete().eq('student_id', id);
    if (error) throw error;
    showMessage('Student deleted.');
    await loadStudents();
  } catch (error) {
    showMessage('Delete failed. Related history, attendance, marks or fee records may prevent deletion. ' + error.message, 'danger');
  }
}

$('studentSearch').addEventListener('input', () => {
  const query = $('studentSearch').value.trim().toLowerCase();
  const filtered = students.filter(row =>
    [row.full_name, row.roll_no, row.email, row.phone]
      .some(value => (value || '').toLowerCase().includes(query))
  );
  renderStudents(filtered);
});

$('logoutBtn').addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();
  if (error) alert(error.message);
  else window.location.replace('login.html');
});

async function init() {
  try {
    const allowed = await requireAdmin();
    if (!allowed) return;
    await loadDropdowns();
    await loadStudents();
  } catch (error) {
    showMessage('Page load error: ' + error.message, 'danger');
  }
}

init();
