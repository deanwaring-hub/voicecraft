/**
 * VoiceCraft - Main App Script
 * Handles auth state, login/logout, and video form submission.
 * Depends on: auth-config.js (loaded before this script)
 */

// ─── DOM Elements ────────────────────────────────────────────────────────────
const loginScreen     = document.getElementById('login-screen');
const mainScreen      = document.getElementById('main-screen');
const loginForm       = document.getElementById('login-form');
const videoForm       = document.getElementById('video-form');
const logoutBtn       = document.getElementById('logout-btn');
const userNameDisplay = document.getElementById('user-name');
const textFileInput   = document.getElementById('text-file');
const fileButton      = document.getElementById('file-button');
const fileNameDisplay = document.getElementById('file-name');
const loginErrorDiv   = document.getElementById('login-error');
const formSuccessAlert = document.getElementById('form-success');
const formErrorAlert  = document.getElementById('form-error');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// ─── App Initialisation ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupFormValidation();
    initializeApp();
});

function initializeApp() {
    checkAuthState();
    setupEventListeners();
}

/**
 * Check whether the user is logged in.
 * We store the id_token and user info in sessionStorage after the
 * callback page exchanges the auth code.
 */
function checkAuthState() {
    const idToken   = sessionStorage.getItem('id_token');
    const userEmail = sessionStorage.getItem('userEmail');

    if (idToken && userEmail) {
        // Basic expiry check — the token payload is base64 encoded JSON
        try {
            const payload = JSON.parse(atob(idToken.split('.')[1]));
            const nowSecs = Math.floor(Date.now() / 1000);
            if (payload.exp && payload.exp < nowSecs) {
                // Token has expired — clear session and show login
                clearSession();
                showLoginScreen();
                return;
            }
        } catch (e) {
            // Malformed token — clear and show login
            clearSession();
            showLoginScreen();
            return;
        }
        showMainScreen(userEmail);
    } else {
        showLoginScreen();
    }
}

// ─── Event Listeners ─────────────────────────────────────────────────────────
function setupEventListeners() {
    if (loginForm)  loginForm.addEventListener('submit', handleLogin);
    if (logoutBtn)  logoutBtn.addEventListener('click', handleLogout);
    if (videoForm)  videoForm.addEventListener('submit', handleVideoFormSubmit);
    if (fileButton) fileButton.addEventListener('click', () => textFileInput.click());
    if (textFileInput) textFileInput.addEventListener('change', handleFileSelection);
    if (loginForm)  loginForm.addEventListener('change', clearLoginError);
    if (videoForm)  videoForm.addEventListener('input', clearFormErrors);
}

// ─── Login ───────────────────────────────────────────────────────────────────
/**
 * Redirect to Cognito Hosted UI login page.
 * Cognito will authenticate the user and redirect back to callback.html
 * with a ?code= parameter.
 */
function handleLogin(e) {
    e.preventDefault();

    const loginUrl =
        `${AUTH_CONFIG.hostedUiDomain}/login` +
        `?client_id=${AUTH_CONFIG.clientId}` +
        `&response_type=code` +
        `&scope=${AUTH_CONFIG.scopes}` +
        `&redirect_uri=${encodeURIComponent(AUTH_CONFIG.callbackUrl)}`;

    window.location.href = loginUrl;
}

// ─── Logout ──────────────────────────────────────────────────────────────────
function handleLogout() {
    if (!confirm('Are you sure you want to sign out?')) return;

    clearSession();

    // Redirect to Cognito logout endpoint so the Cognito session cookie
    // is also cleared — prevents auto-login on next visit
    const logoutUrl =
        `${AUTH_CONFIG.hostedUiDomain}/logout` +
        `?client_id=${AUTH_CONFIG.clientId}` +
        `&logout_uri=${encodeURIComponent(AUTH_CONFIG.logoutUrl)}`;

    window.location.href = logoutUrl;
}

function clearSession() {
    sessionStorage.removeItem('id_token');
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('userEmail');
    sessionStorage.removeItem('userName');
}

// ─── Screen Management ───────────────────────────────────────────────────────
function showMainScreen(userEmail) {
    const userName = sessionStorage.getItem('userName') || userEmail.split('@')[0];
    if (userNameDisplay) {
        userNameDisplay.textContent = `Welcome, ${capitalizeString(userName)}`;
    }
    loginScreen.classList.add('d-none');
    mainScreen.classList.remove('d-none');

    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.focus();
        mainContent.scrollIntoView();
    }
}

function showLoginScreen() {
    mainScreen.classList.add('d-none');
    loginScreen.classList.remove('d-none');

    if (loginForm) {
        loginForm.reset();
        clearFieldErrors();
        clearLoginError();
    }
    if (videoForm)       videoForm.reset();
    if (fileNameDisplay) fileNameDisplay.textContent = '';

    const emailInput = document.getElementById('email');
    if (emailInput) emailInput.focus();
}

// ─── Error Helpers ───────────────────────────────────────────────────────────
function showLoginError(message) {
    if (!loginErrorDiv) return;
    loginErrorDiv.textContent = message;
    loginErrorDiv.classList.remove('d-none');
    loginErrorDiv.setAttribute('role', 'alert');
    loginErrorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearLoginError() {
    if (!loginErrorDiv) return;
    loginErrorDiv.classList.add('d-none');
    loginErrorDiv.removeAttribute('role');
}

function clearFieldErrors() {
    document.querySelectorAll('.invalid-feedback').forEach(el => el.textContent = '');
    if (loginForm) loginForm.classList.remove('was-validated');
}

function updateFieldError(field, message) {
    if (!field) return;
    const errorEl = document.getElementById(`${field.id}-error`);
    if (errorEl) errorEl.textContent = message;
}

// ─── File Handling ───────────────────────────────────────────────────────────
function handleFileSelection(e) {
    const file = e.target.files[0];
    if (!file) { fileNameDisplay.textContent = ''; return; }

    if (!file.name.endsWith('.txt')) {
        updateFieldError(textFileInput, 'Please select a .txt file.');
        textFileInput.value = '';
        fileNameDisplay.textContent = '';
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        updateFieldError(textFileInput, `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit.`);
        textFileInput.value = '';
        fileNameDisplay.textContent = '';
        return;
    }

    fileNameDisplay.textContent = `✓ ${file.name} (${formatFileSize(file.size)})`;
    updateFieldError(textFileInput, '');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ─── Video Form ──────────────────────────────────────────────────────────────
function handleVideoFormSubmit(e) {
    e.preventDefault();
    formSuccessAlert.classList.add('d-none');
    formErrorAlert.classList.add('d-none');

    const category = document.querySelector('input[name="category"]:checked');
    const audio    = document.querySelector('input[name="audio"]:checked');
    const file     = textFileInput.files[0];
    let   isValid  = true;
    const errors   = [];

    if (!category) { isValid = false; errors.push('Please select a content category.'); }
    if (!audio)    { isValid = false; errors.push('Please select background audio.'); }
    if (!file)     { isValid = false; errors.push('Please upload a text file.'); }

    if (!isValid) { showFormError(errors.join(' ')); return; }

    const formData = new FormData();
    formData.append('category', category.value);
    formData.append('audio', audio.value);
    formData.append('textFile', file);

    submitVideoCreationRequest(formData);
}

function submitVideoCreationRequest(formData) {
    const submitBtn  = document.getElementById('submit-btn');
    const origText   = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Creating...';

    // TODO: Replace setTimeout with a real fetch() to your AWS API Gateway endpoint
    // The access_token is in sessionStorage.getItem('access_token') — include it
    // as an Authorization: Bearer header on that request.
    setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = origText;
        showFormSuccess();
        videoForm.reset();
        fileNameDisplay.textContent = '';
        announceToScreenReaders('Video creation request submitted successfully.');
    }, 1500);
}

function showFormSuccess() {
    formSuccessAlert.classList.remove('d-none');
    formErrorAlert.classList.add('d-none');
    formSuccessAlert.setAttribute('role', 'status');
    formSuccessAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => formSuccessAlert.classList.add('d-none'), 5000);
}

function showFormError(message) {
    formErrorAlert.textContent = message;
    formErrorAlert.classList.remove('d-none');
    formSuccessAlert.classList.add('d-none');
    formErrorAlert.setAttribute('role', 'alert');
    formErrorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearFormErrors() {
    formErrorAlert.classList.add('d-none');
    formErrorAlert.removeAttribute('role');
    document.querySelectorAll('#video-form .invalid-feedback').forEach(el => el.textContent = '');
}

// ─── Utilities ───────────────────────────────────────────────────────────────
function capitalizeString(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function announceToScreenReaders(message) {
    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    el.className = 'visually-hidden';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
}

function setupFormValidation() {
    document.querySelectorAll('.needs-validation').forEach(form => {
        form.addEventListener('submit', e => {
            if (!form.checkValidity()) {
                e.preventDefault();
                e.stopPropagation();
            }
            form.classList.add('was-validated');
        }, false);
    });
}

// Re-check auth if user switches back to this tab
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkAuthState();
});
