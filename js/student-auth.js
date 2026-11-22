
import { supabase } from './supabase.js';

const registerForm = document.getElementById('studentRegisterForm');
const loginForm = document.getElementById('studentLoginForm');

const messageBox = document.getElementById('authMessage');

function showMessage(message, type = 'danger') {
  messageBox.replaceChildren();

  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = message;

  messageBox.appendChild(alert);
}

function setLoading(button, loading, normalText) {
  button.disabled = loading;
  button.textContent = loading ? 'Please wait...' : normalText;
}

// STUDENT REGISTRATION
if (registerForm) {
  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    messageBox.replaceChildren();

    const button = document.getElementById('registerBtn');

    const rollNo = document.getElementById('rollNo').value.trim();
    const email = document.getElementById('email').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password.length < 8) {
      showMessage('Password must contain at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      showMessage('Passwords do not match.');
      return;
    }

    setLoading(button, true, 'Create Student Account');

    try {
      // Create Supabase Auth account
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/student-login.html`
        }
      });

      if (error) throw error;

      // If email confirmation is disabled, link immediately.
      if (data.session && data.user) {
        const { error: linkError } = await supabase.rpc(
          'link_student_account',
          { p_roll_no: rollNo }
        );

        if (linkError) {
          await supabase.auth.signOut();
          throw linkError;
        }

        showMessage(
          'Your student account has been created and linked successfully. You can now login.',
          'success'
        );

        registerForm.reset();

        setTimeout(() => {
          window.location.href = 'student-login.html';
        }, 1800);

      } else {
        // Email confirmation is enabled in Supabase.
        showMessage(
          'Registration submitted. Please verify your email using the link sent to your inbox. After verification, return here and login using your email, password and roll number.',
          'success'
        );

        registerForm.reset();
      }

    } catch (error) {
      showMessage(error.message || 'Registration failed.');
    } finally {
      setLoading(button, false, 'Create Student Account');
    }
  });
}


// STUDENT LOGIN
if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    messageBox.replaceChildren();

    const button = document.getElementById('loginBtn');

    const email = document.getElementById('email').value.trim().toLowerCase();
    const rollNo = document.getElementById('rollNo').value.trim();
    const password = document.getElementById('password').value;

    setLoading(button, true, 'Login to Student Portal');

    try {
      // Authenticate student
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      // Link or verify existing student record
      const { error: linkError } = await supabase.rpc(
        'link_student_account',
        { p_roll_no: rollNo }
      );

      if (linkError) {
        await supabase.auth.signOut();
        throw linkError;
      }

      showMessage('Login successful! Opening your dashboard...', 'success');

      setTimeout(() => {
        window.location.replace('student-dashboard.html');
      }, 700);

    } catch (error) {
      showMessage(
        error.message || 'Login failed. Please check your details.'
      );

      button.disabled = false;
      button.textContent = 'Login to Student Portal';
    }
  });
}
