
import { supabase } from './supabase.js';

const form = document.getElementById('changePasswordForm');
const messageBox = document.getElementById('passwordMessage');
const button = document.getElementById('changePasswordBtn');

function showMessage(message, type = 'danger') {
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  messageBox.replaceChildren(alert);
}

async function checkStudentSession() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    window.location.replace('student-login.html');
    return false;
  }

  // Confirm this account is linked to a student record
  const { data: student, error: studentError } = await supabase
    .from('students')
    .select('student_id')
    .eq('auth_user_id', data.user.id)
    .maybeSingle();

  if (studentError) throw studentError;

  if (!student) {
    showMessage('Student account is not linked. Please contact the department administrator.', 'warning');
    form.querySelectorAll('input, button').forEach(el => el.disabled = true);
    return false;
  }

  return true;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  messageBox.replaceChildren();

  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (newPassword.length < 8) {
    showMessage('Password kam az kam 8 characters ka hona chahiye.', 'warning');
    return;
  }

  if (newPassword !== confirmPassword) {
    showMessage('New password aur confirm password match nahi karte.', 'warning');
    return;
  }

  button.disabled = true;
  button.textContent = 'Updating...';

  try {
    const validSession = await checkStudentSession();
    if (!validSession) return;

    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;

    form.reset();
    showMessage('Password successfully updated. Use your new password next time you log in.', 'success');

  } catch (error) {
    console.error('Password update error:', error);
    showMessage(error.message || 'Unable to update password.');
  } finally {
    button.disabled = false;
    button.textContent = 'Update Password';
  }
});

checkStudentSession().catch(error => {
  console.error(error);
  showMessage(error.message || 'Unable to verify your student account.');
});
