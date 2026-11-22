
import { supabase } from './supabase.js';

const form = document.getElementById('loginForm');
const button = document.getElementById('loginBtn');
const message = document.getElementById('loginMessage');

const passwordInput = document.getElementById('password');
const togglePassword = document.getElementById('togglePassword');
const forgotPassword = document.getElementById('forgotPassword');

function showMessage(text, type = 'danger') {
  message.replaceChildren();

  const div = document.createElement('div');
  div.className = `alert alert-${type}`;
  div.textContent = text;

  message.appendChild(div);
}

function clearMessage() {
  message.replaceChildren();
}

// Show / Hide Password
togglePassword.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';

  passwordInput.type = isPassword ? 'text' : 'password';
  togglePassword.textContent = isPassword ? 'HIDE' : 'SHOW';
});

// Login
form.addEventListener('submit', async (event) => {
  event.preventDefault();

  button.disabled = true;
  button.textContent = 'Signing in...';
  clearMessage();

  try {
    const email = document.getElementById('email').value.trim();
    const password = passwordInput.value;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_id, role')
      .eq('user_id', data.user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      await supabase.auth.signOut();

      throw new Error(
        'Access denied. This account does not have the admin role.'
      );
    }

    window.location.replace('dashboard.html');

  } catch (error) {
    showMessage(error.message || 'Login failed.');

    button.disabled = false;
    button.textContent = 'Sign In to Dashboard';
  }
});

// Forgot Password
forgotPassword.addEventListener('click', async (event) => {
  event.preventDefault();
  clearMessage();

  const email = document.getElementById('email').value.trim();

  if (!email) {
    showMessage('Please enter your email address first.');
    document.getElementById('email').focus();
    return;
  }

  forgotPassword.style.pointerEvents = 'none';
  forgotPassword.textContent = 'Sending...';

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) throw error;

    showMessage(
      'If this email is registered, a password reset link will be sent. Please check your inbox.',
      'success'
    );

  } catch (error) {
    showMessage(error.message || 'Unable to send reset email.');

  } finally {
    forgotPassword.style.pointerEvents = '';
    forgotPassword.textContent = 'Forgot Password?';
  }
});
