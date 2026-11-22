import { supabase } from './supabase.js';

const message = document.getElementById('dashboardMessage');

async function requireAdmin() {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    window.location.replace('login.html');
    return null;
  }

  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('user_id, role')
    .eq('user_id', user.id)
    .single();

  if (error || !profile || profile.role !== 'admin') {
    await supabase.auth.signOut();
    window.location.replace('login.html');
    return null;
  }
  return user;
}

async function countRows(table) {
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

async function init() {
  try {
    const user = await requireAdmin();
    if (!user) return;

    document.getElementById('adminName').textContent = 'Administrator';
    document.getElementById('adminEmail').textContent = user.email || '';

    const [students, teachers, courses, semesters] = await Promise.all([
      countRows('students'), countRows('teachers'), countRows('courses'), countRows('semesters')
    ]);

    document.getElementById('studentCount').textContent = students;
    document.getElementById('teacherCount').textContent = teachers;
    document.getElementById('courseCount').textContent = courses;
    document.getElementById('semesterCount').textContent = semesters;
  } catch (error) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-warning';
    alert.textContent = 'Dashboard data could not load: ' + error.message;
    message.appendChild(alert);
  }
}

document.getElementById('logoutBtn').addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();
  if (error) alert(error.message);
  else window.location.replace('login.html');
});

document.querySelectorAll('.coming-soon').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    alert('This section will be developed in the next project step.');
  });
});

init();
