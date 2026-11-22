
import { supabase } from './supabase.js';

const form = document.getElementById('forgotPasswordForm');
const messageBox = document.getElementById('resetMessage');
const button = document.getElementById('resetButton');

function showMessage(message, type = 'danger') {
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  messageBox.replaceChildren(alert);
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  messageBox.replaceChildren();

  const email = document.getElementById('resetEmail').value.trim();

  if (!email) {
    showMessage('Please enter your registered email.', 'warning');
    return;
  }

  button.disabled = true;
  button.textContent = 'Sending...';

  try {
    const redirectTo = new URL(
      'student-reset-password.html',
      window.location.href
    ).href;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    if (error) throw error;

    showMessage(
      'If an account exists for this email, a password reset link has been sent. Please check your inbox and spam folder.',
      'success'
    );

    form.reset();

  } catch (error) {
    console.error('Password reset request error:', error);
    showMessage(error.message || 'Unable to send reset email.');
  } finally {
    button.disabled = false;
    button.textContent = 'Send Reset Link';
  }
});
