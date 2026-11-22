
import { supabase } from './supabase.js';

const form = document.getElementById('profileForm');
const messageBox = document.getElementById('profileMessage');
const saveButton = document.getElementById('saveProfileBtn');

const photoInput = document.getElementById('photoInput');
const photoPreview = document.getElementById('photoPreview');
const photoInitials = document.getElementById('photoInitials');
const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');

const MAX_FILE_SIZE = 2 * 1024 * 1024;

let originalPhone = '';
let originalAddress = '';
let currentPhotoPath = null;
let selectedPhoto = null;
let previewObjectUrl = null;
let currentUser = null;

function showMessage(message, type = 'danger') {
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  messageBox.replaceChildren(alert);
}

function setValue(id, value) {
  document.getElementById(id).value = value ?? '';
}

function initialsFromName(name) {
  return (name || 'Student')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word.charAt(0).toUpperCase())
    .join('') || 'S';
}

function showInitials(name) {
  const initials = initialsFromName(name);
  document.getElementById('profileInitials').textContent = initials;
  photoInitials.textContent = initials;
}

async function displayStoredPhoto(path) {
  if (!path) {
    photoPreview.hidden = true;
    photoInitials.hidden = false;
    photoPreview.removeAttribute('src');
    return;
  }

  const { data, error } = await supabase.storage
    .from('student-photos')
    .createSignedUrl(path, 3600);

  if (error) throw error;

  photoPreview.src = data.signedUrl;
  photoPreview.hidden = false;
  photoInitials.hidden = true;
}

async function loadProfile() {
  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData.user) {
    window.location.replace('student-login.html');
    return;
  }

  currentUser = authData.user;

  const { data: student, error } = await supabase
    .from('students')
    .select(`
      student_id,
      full_name,
      roll_no,
      email,
      phone,
      address,
      department_id,
      current_semester_id,
      status,
      photo_path
    `)
    .eq('auth_user_id', currentUser.id)
    .maybeSingle();

  if (error) throw error;

  if (!student) {
    showMessage(
      'Your student account is not linked. Please contact the department administrator.',
      'warning'
    );

    form.querySelectorAll('input, textarea, button').forEach(element => {
      element.disabled = true;
    });

    photoInput.disabled = true;
    uploadPhotoBtn.disabled = true;
    return;
  }

  setValue('fullName', student.full_name);
  setValue('rollNo', student.roll_no);
  setValue('email', student.email || currentUser.email);
  setValue('phone', student.phone);
  setValue('address', student.address);
  setValue('studentStatus', student.status);

  originalPhone = student.phone || '';
  originalAddress = student.address || '';
  currentPhotoPath = student.photo_path || null;

  showInitials(student.full_name);

  if (currentPhotoPath) {
    await displayStoredPhoto(currentPhotoPath);
  }

  // Load department
  if (student.department_id) {
    const { data: department, error: departmentError } =
      await supabase
        .from('departments')
        .select('department_name')
        .eq('department_id', student.department_id)
        .maybeSingle();

    if (departmentError) throw departmentError;

    setValue('department', department?.department_name || '');
  }

  // Load current semester
  if (student.current_semester_id) {
    const { data: semester, error: semesterError } =
      await supabase
        .from('semesters')
        .select('semester_name, semester_number')
        .eq('semester_id', student.current_semester_id)
        .maybeSingle();

    if (semesterError) throw semesterError;

    const semesterName = semester
      ? semester.semester_name || `Semester ${semester.semester_number}`
      : '';

    setValue('semester', semesterName);
  }
}

// Select and preview a photo
photoInput.addEventListener('change', () => {
  messageBox.replaceChildren();

  const file = photoInput.files?.[0];

  selectedPhoto = null;
  uploadPhotoBtn.disabled = true;

  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null;
  }

  if (!file) return;

  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  if (!allowedTypes.includes(file.type)) {
    photoInput.value = '';
    showMessage('Only JPG, PNG aur WebP images allowed hain.', 'warning');
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    photoInput.value = '';
    showMessage('Photo size 2 MB se zyada nahi honi chahiye.', 'warning');
    return;
  }

  selectedPhoto = file;
  previewObjectUrl = URL.createObjectURL(file);

  photoPreview.src = previewObjectUrl;
  photoPreview.hidden = false;
  photoInitials.hidden = true;

  uploadPhotoBtn.disabled = false;
});

// Upload or replace profile photo
uploadPhotoBtn.addEventListener('click', async () => {
  if (!selectedPhoto || !currentUser) {
    showMessage('Please select a photo first.', 'warning');
    return;
  }

  const file = selectedPhoto;
  const oldPhotoPath = currentPhotoPath;

  const extensionMap = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  };

  const extension = extensionMap[file.type];

  const newPhotoPath =
    `${currentUser.id}/profile-${Date.now()}.${extension}`;

  uploadPhotoBtn.disabled = true;
  uploadPhotoBtn.textContent = 'Uploading...';
  photoInput.disabled = true;

  try {
    // Upload new photo
    const { error: uploadError } = await supabase.storage
      .from('student-photos')
      .upload(newPhotoPath, file, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Save photo path through secure database function
    const { data, error: rpcError } = await supabase.rpc(
      'update_my_student_photo',
      {
        p_photo_path: newPhotoPath
      }
    );

    if (rpcError) {
      // Remove uploaded file if database update fails
      await supabase.storage
        .from('student-photos')
        .remove([newPhotoPath]);

      throw rpcError;
    }

    if (data !== true) {
      await supabase.storage
        .from('student-photos')
        .remove([newPhotoPath]);

      throw new Error('Profile photo update was not confirmed.');
    }

    currentPhotoPath = newPhotoPath;
    selectedPhoto = null;
    photoInput.value = '';

    // Display the newly saved photo using a signed URL
    if (previewObjectUrl) {
      URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null;
    }

    await displayStoredPhoto(currentPhotoPath);

    // Delete previous photo after the new photo is saved
    if (oldPhotoPath) {
      const { error: deleteError } = await supabase.storage
        .from('student-photos')
        .remove([oldPhotoPath]);

      if (deleteError) {
        console.warn('Old photo could not be deleted:', deleteError);
      }
    }

    showMessage('Your profile photo has been uploaded successfully!', 'success');

  } catch (error) {
    console.error('Photo upload error:', error);
    showMessage(error.message || 'Unable to upload profile photo.');
  } finally {
    uploadPhotoBtn.disabled = !selectedPhoto;
    uploadPhotoBtn.textContent = 'Upload Photo';
    photoInput.disabled = false;
  }
});

// Save phone and address using secure RPC
form.addEventListener('submit', async event => {
  event.preventDefault();
  messageBox.replaceChildren();

  const phone = document.getElementById('phone').value.trim();
  const address = document.getElementById('address').value.trim();

  if (!phone || !address) {
    showMessage('Phone number aur address dono required hain.', 'warning');
    return;
  }

  if (phone.length > 25 || address.length > 500) {
    showMessage('Phone ya address ki length allowed limit se zyada hai.');
    return;
  }

  saveButton.disabled = true;
  saveButton.textContent = 'Saving...';

  try {
    const { data: authData, error: authError } =
      await supabase.auth.getUser();

    if (authError || !authData.user) {
      window.location.replace('student-login.html');
      return;
    }

    const { data, error } = await supabase.rpc(
      'update_my_student_profile',
      {
        p_phone: phone,
        p_address: address
      }
    );

    if (error) throw error;

    if (data !== true) {
      throw new Error('Profile update was not confirmed.');
    }

    originalPhone = phone;
    originalAddress = address;

    showMessage('Your profile has been updated successfully!', 'success');

  } catch (error) {
    console.error('Profile update error:', error);
    showMessage(error.message || 'Unable to update your profile.');
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Save Changes';
  }
});

// Reset phone and address to last saved values
form.addEventListener('reset', () => {
  setTimeout(() => {
    setValue('phone', originalPhone);
    setValue('address', originalAddress);
    messageBox.replaceChildren();
  }, 0);
});

// Load profile when page opens
loadProfile().catch(error => {
  console.error('Profile loading error:', error);
  showMessage(error.message || 'Unable to load your profile.');
});
