/**
 * VoiceCraft - Text to Video Application
 * JavaScript Module for Login and Video Creation
 */

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const mainScreen = document.getElementById('main-screen');
const loginForm = document.getElementById('login-form');
const videoForm = document.getElementById('video-form');
const logoutBtn = document.getElementById('logout-btn');
const userNameDisplay = document.getElementById('user-name');
const textFileInput = document.getElementById('text-file');
const fileButton = document.getElementById('file-button');
const fileNameDisplay = document.getElementById('file-name');
const loginErrorDiv = document.getElementById('login-error');
const formSuccessAlert = document.getElementById('form-success');
const formErrorAlert = document.getElementById('form-error');

// Demo credentials for testing
const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'password123';

// Maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Initialize the application
 */
function initializeApp() {
    checkUserSession();
    setupEventListeners();
    setupKeyboardNavigation();
}

/**
 * Check if user has an active session
 */
function checkUserSession() {
    const userEmail = sessionStorage.getItem('userEmail');
    if (userEmail) {
        showMainScreen(userEmail);
    } else {
        showLoginScreen();
    }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Login form submission
    loginForm.addEventListener('submit', handleLogin);

    // Logout button
    logoutBtn.addEventListener('click', handleLogout);

    // Video form submission
    videoForm.addEventListener('submit', handleVideoFormSubmit);

    // File input
    fileButton.addEventListener('click', () => textFileInput.click());
    textFileInput.addEventListener('change', handleFileSelection);

    // Form validation
    loginForm.addEventListener('change', clearLoginError);
    videoForm.addEventListener('input', clearFormErrors);
}

/**
 * Setup keyboard navigation and accessibility
 */
function setupKeyboardNavigation() {
    // Handle form submission with Enter key in specific fields
    const formInputs = document.querySelectorAll('.form-control, .form-check-input');
    formInputs.forEach(input => {
        input.addEventListener('keydown', (e) => {
            // Allow Tab for natural navigation
            // Allow Enter only for explicit submit buttons
        });
    });
}

/**
 * Handle login form submission
 */
function handleLogin(e) {
    e.preventDefault();

    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Clear previous errors
    clearLoginError();

    // Validate form
    if (!loginForm.checkValidity()) {
        e.stopPropagation();
        loginForm.classList.add('was-validated');
        updateFieldError(emailInput, 'Please enter a valid email address.');
        updateFieldError(passwordInput, 'Please enter your password.');
        return;
    }

    // Validate credentials (demo only - in production, use backend authentication)
    if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
        // Store session
        sessionStorage.setItem('userEmail', email);
        sessionStorage.setItem('userName', email.split('@')[0]);
        
        // Show main screen
        showMainScreen(email);
    } else {
        // Show error message
        showLoginError('Invalid email or password. Please try again.');
        passwordInput.value = '';
        passwordInput.focus();
    }
}

/**
 * Display login error message
 */
function showLoginError(message) {
    loginErrorDiv.textContent = message;
    loginErrorDiv.classList.remove('d-none');
    loginErrorDiv.setAttribute('role', 'alert');
    loginErrorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Clear login error message
 */
function clearLoginError() {
    loginErrorDiv.classList.add('d-none');
    loginErrorDiv.removeAttribute('role');
}

/**
 * Update field error message
 */
function updateFieldError(field, message) {
    const errorId = `${field.id}-error`;
    const errorElement = document.getElementById(errorId);
    if (errorElement) {
        errorElement.textContent = message;
    }
}

/**
 * Clear field error messages
 */
function clearFieldErrors() {
    const errorElements = document.querySelectorAll('.invalid-feedback');
    errorElements.forEach(el => {
        el.textContent = '';
    });
    loginForm.classList.remove('was-validated');
}

/**
 * Show main application screen
 */
function showMainScreen(userEmail) {
    const userName = sessionStorage.getItem('userName') || userEmail.split('@')[0];
    userNameDisplay.textContent = `Welcome, ${capitalizeString(userName)}`;
    
    loginScreen.classList.add('d-none');
    mainScreen.classList.remove('d-none');
    
    // Focus management for accessibility
    const mainContent = document.getElementById('main-content');
    mainContent.focus();
    mainContent.scrollIntoView();
}

/**
 * Show login screen
 */
function showLoginScreen() {
    mainScreen.classList.add('d-none');
    loginScreen.classList.remove('d-none');
    
    // Clear form and reset validation
    loginForm.reset();
    clearFieldErrors();
    clearLoginError();
    videoForm.reset();
    fileNameDisplay.textContent = '';
    
    // Focus on email input
    document.getElementById('email').focus();
}

/**
 * Handle logout
 */
function handleLogout() {
    // Confirm logout
    if (confirm('Are you sure you want to sign out?')) {
        // Clear session
        sessionStorage.clear();
        
        // Return to login
        showLoginScreen();
        
        // Announce logout to screen readers
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.className = 'visually-hidden';
        announcement.textContent = 'You have been signed out successfully.';
        document.body.appendChild(announcement);
        
        setTimeout(() => announcement.remove(), 1000);
    }
}

/**
 * Handle file selection
 */
function handleFileSelection(e) {
    const file = e.target.files[0];

    if (!file) {
        fileNameDisplay.textContent = '';
        return;
    }

    // Validate file type
    if (!file.name.endsWith('.txt')) {
        updateFieldError(textFileInput, 'Please select a .txt file.');
        textFileInput.value = '';
        fileNameDisplay.textContent = '';
        return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
        const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024);
        updateFieldError(textFileInput, `File size exceeds ${maxSizeMB}MB limit.`);
        textFileInput.value = '';
        fileNameDisplay.textContent = '';
        return;
    }

    // Display file name and clear errors
    fileNameDisplay.textContent = `✓ ${file.name} (${formatFileSize(file.size)})`;
    updateFieldError(textFileInput, '');
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Handle video form submission
 */
function handleVideoFormSubmit(e) {
    e.preventDefault();

    // Clear previous alerts
    formSuccessAlert.classList.add('d-none');
    formErrorAlert.classList.add('d-none');

    // Get form data
    const category = document.querySelector('input[name="category"]:checked');
    const audio = document.querySelector('input[name="audio"]:checked');
    const file = textFileInput.files[0];

    // Validate all fields
    let isValid = true;
    const errors = [];

    if (!category) {
        isValid = false;
        errors.push('Please select a content category.');
        updateFieldError(document.getElementById('category-error'), 'Category is required.');
    }

    if (!audio) {
        isValid = false;
        errors.push('Please select background audio.');
        updateFieldError(document.getElementById('audio-error'), 'Audio selection is required.');
    }

    if (!file) {
        isValid = false;
        errors.push('Please upload a text file.');
        updateFieldError(textFileInput, 'File is required.');
    }

    if (!isValid) {
        showFormError(errors.join(' '));
        return;
    }

    // Create FormData object for file upload
    const formData = new FormData();
    formData.append('category', category.value);
    formData.append('audio', audio.value);
    formData.append('textFile', file);

    // Submit to backend (currently logs to console for demo)
    submitVideoCreationRequest(formData);
}

/**
 * Submit video creation request to backend
 */
function submitVideoCreationRequest(formData) {
    // Show loading state
    const submitBtn = document.getElementById('submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Creating...';

    // Get form data for logging
    const category = formData.get('category');
    const audio = formData.get('audio');
    const file = formData.get('textFile');

    // Simulate API call (in production, send to your AWS backend)
    console.log('Submitting video creation request:', {
        category,
        audio,
        fileName: file.name,
        fileSize: file.size,
        timestamp: new Date().toISOString()
    });

    // Simulate network delay
    setTimeout(() => {
        // Reset button state
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;

        // Show success message
        showFormSuccess();

        // Reset form
        videoForm.reset();
        fileNameDisplay.textContent = '';

        // In production, you would:
        // 1. Send FormData to your AWS backend
        // 2. Receive a job ID
        // 3. Store job ID for tracking
        // 4. Redirect to job tracking page

        // Announce success to screen readers
        announceToScreenReaders('Video creation request submitted successfully. You will be notified when your video is ready.');

    }, 1500);
}

/**
 * Show form success message
 */
function showFormSuccess() {
    formSuccessAlert.classList.remove('d-none');
    formErrorAlert.classList.add('d-none');
    formSuccessAlert.setAttribute('role', 'status');
    formSuccessAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Auto-hide success message after 5 seconds
    setTimeout(() => {
        formSuccessAlert.classList.add('d-none');
    }, 5000);
}

/**
 * Show form error message
 */
function showFormError(message) {
    formErrorAlert.textContent = message;
    formErrorAlert.classList.remove('d-none');
    formSuccessAlert.classList.add('d-none');
    formErrorAlert.setAttribute('role', 'alert');
    formErrorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Clear form error messages
 */
function clearFormErrors() {
    formErrorAlert.classList.add('d-none');
    formErrorAlert.removeAttribute('role');
    
    const errorElements = document.querySelectorAll('#video-form .invalid-feedback');
    errorElements.forEach(el => {
        el.textContent = '';
    });
}

/**
 * Announce message to screen readers
 */
function announceToScreenReaders(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'visually-hidden';
    announcement.textContent = message;
    document.body.appendChild(announcement);

    // Remove after announcement
    setTimeout(() => announcement.remove(), 2000);
}

/**
 * Capitalize first letter of string
 */
function capitalizeString(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Setup form validation
 */
function setupFormValidation() {
    // Bootstrap form validation
    const forms = document.querySelectorAll('.needs-validation');
    Array.from(forms).forEach(form => {
        form.addEventListener('submit', event => {
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();
            }
            form.classList.add('was-validated');
        }, false);
    });
}

/**
 * Initialize on page load
 */
document.addEventListener('DOMContentLoaded', () => {
    setupFormValidation();
    initializeApp();
});

/**
 * Handle page refresh - maintain session
 */
window.addEventListener('beforeunload', () => {
    // Session is maintained in sessionStorage
});

/**
 * Handle visibility change
 */
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // Re-check session when tab becomes visible
        checkUserSession();
    }
});
