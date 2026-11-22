
import { supabase } from './supabase.js';

const form = document.getElementById('resetPasswordForm');
const messageBox = document.getElementById('newPasswordMessage');
const button = document.getElementById('saveNewPasswordBtn');

function showMessage(message, type = 'danger') {
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  messageBox.replaceChildren(alert);
}

let recoverySessionReady = false;

async function checkRecoverySession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) throw error;

  if (!data.session) {
    showMessage('Reset link invalid or expired. Please request a new reset link.', 'warning');
    button.disabled = true;
    return;
  }

  recoverySessionReady = true;
}

supabase.auth.onAuthStateChange(event => {
  if (event === 'PASSWORD_RECOVERY') {
    recoverySessionReady = true;
    button.disabled = false;
    messageBox.replaceChildren();
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  messageBox.replaceChildren();

  const password = document.getElementById('newPassword').value;
  const confirm = document.getElementById('confirmPassword').value;

  if (password.length < 8) {
    showMessage('Password must contain at least 8 characters.', 'warning');
    return;
  }

  if (password !== confirm) {
    showMessage('Passwords do not match.', 'warning');
    return;
  }

  button.disabled = true;
  button.textContent = 'Saving...';

  try {
    if (!recoverySessionReady) {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (!data.session) {
        throw new Error('Reset session not found. Please request a new reset link.');
      }
    }

    const { error } = await supabase.auth.updateUser({
      password
    });

    if (error) throw error;

    form.reset();
    showMessage('Your password has been reset successfully. You can now log in with your new password.', 'success');

    setTimeout(async () => {
      await supabase.auth.signOut();
      window.location.replace('student-login.html');
    }, 1800);

  } catch (error) {
    console.error('Password reset error:', error);
    showMessage(error.message || 'Unable to reset password.');
  } finally {
    button.disabled = false;
    button.textContent = 'Save New Password';
  }
});

checkRecoverySession().catch(error => {
  console.error(error);
  showMessage(error.message || 'Unable to verify reset link.');
  button.disabled = true;
});
