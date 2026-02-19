/**
 * VoiceCraft - Main App Script
 * Handles direct Cognito authentication via SDK (no Hosted UI redirect).
 * Depends on: auth-config.js and amazon-cognito-identity-js (both loaded before this)
 */

// ─── DOM Elements ────────────────────────────────────────────────────────────
const loginScreen      = document.getElementById('login-screen');
const mainScreen       = document.getElementById('main-screen');
const loginForm        = document.getElementById('login-form');
const videoForm        = document.getElementById('video-form');
const logoutBtn        = document.getElementById('logout-btn');
const userNameDisplay  = document.getElementById('user-name');
const textFileInput    = document.getElementById('text-file');
const fileButton       = document.getElementById('file-button');
const fileNameDisplay  = document.getElementById('file-name');
const loginErrorDiv    = document.getElementById('login-error');
const formSuccessAlert = document.getElementById('form-success');
const formErrorAlert   = document.getElementById('form-error');

const MAX_FILE_SIZE = 5 * 1024 * 1024;

// ─── Cognito Setup ───────────────────────────────────────────────────────────
const userPool = new AmazonCognitoIdentity.CognitoUserPool({
    UserPoolId: AUTH_CONFIG.userPoolId,
    ClientId:   AUTH_CONFIG.clientId,
});

// ─── App Initialisation ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupFormValidation();
    initializeApp();
});

function initializeApp() {
    checkAuthState();
    setupEventListeners();
}

function checkAuthState() {
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) { showLoginScreen(); return; }

    cognitoUser.getSession((err, session) => {
        if (err || !session.isValid()) { showLoginScreen(); return; }
        const payload = session.getIdToken().decodePayload();
        const email   = payload.email || '';
        const name    = payload.name  || payload['cognito:username'] || email.split('@')[0];
        sessionStorage.setItem('userEmail', email);
        sessionStorage.setItem('userName',  name);
        showMainScreen(email);
    });
}

// ─── Event Listeners ─────────────────────────────────────────────────────────
function setupEventListeners() {
    if (loginForm)     loginForm.addEventListener('submit', handleLogin);
    if (logoutBtn)     logoutBtn.addEventListener('click', handleLogout);
    if (videoForm)     videoForm.addEventListener('submit', handleVideoFormSubmit);
    if (fileButton)    fileButton.addEventListener('click', () => textFileInput.click());
    if (textFileInput) textFileInput.addEventListener('change', handleFileSelection);
    if (loginForm)     loginForm.addEventListener('change', clearLoginError);
    if (videoForm)     videoForm.addEventListener('input', clearFormErrors);
}

// ─── Login ───────────────────────────────────────────────────────────────────
function handleLogin(e) {
    e.preventDefault();
    clearLoginError();

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) { showLoginError('Please enter your email and password.'); return; }

    const submitBtn = loginForm.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, 'Signing in…');

    const cognitoUser = new AmazonCognitoIdentity.CognitoUser({ Username: email, Pool: userPool });
    const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({ Username: email, Password: password });

    cognitoUser.authenticateUser(authDetails, {
        onSuccess(session) {
            resetButton(submitBtn, 'SIGN IN');
            const payload = session.getIdToken().decodePayload();
            const name    = payload.name || payload['cognito:username'] || email.split('@')[0];
            sessionStorage.setItem('userEmail', email);
            sessionStorage.setItem('userName',  name);
            showMainScreen(email);
        },
        onFailure(err) {
            resetButton(submitBtn, 'SIGN IN');
            showLoginError(friendlyAuthError(err));
        },
        newPasswordRequired() {
            resetButton(submitBtn, 'SIGN IN');
            showLoginError('You must reset your password. Please use "Forgot password".');
        },
    });
}

// ─── Logout ──────────────────────────────────────────────────────────────────
function handleLogout() {
    if (!confirm('Are you sure you want to sign out?')) return;
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) cognitoUser.signOut();
    sessionStorage.clear();
    showLoginScreen();
}

// ─── Screen Management ───────────────────────────────────────────────────────
function showMainScreen(userEmail) {
    const userName = sessionStorage.getItem('userName') || userEmail.split('@')[0];
    if (userNameDisplay) userNameDisplay.textContent = `Welcome, ${capitalizeString(userName)}`;
    loginScreen.classList.add('d-none');
    mainScreen.classList.remove('d-none');
    const mainContent = document.getElementById('main-content');
    if (mainContent) { mainContent.focus(); mainContent.scrollIntoView(); }
}

function showLoginScreen() {
    mainScreen.classList.add('d-none');
    loginScreen.classList.remove('d-none');
    if (loginForm)       { loginForm.reset(); clearFieldErrors(); clearLoginError(); }
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

function friendlyAuthError(err) {
    switch (err.code) {
        case 'NotAuthorizedException':     return 'Incorrect email or password. Please try again.';
        case 'UserNotFoundException':      return 'No account found with this email. Please sign up first.';
        case 'UserNotConfirmedException':  return 'Please verify your email before signing in. Check your inbox.';
        case 'PasswordResetRequiredException': return 'Your password needs to be reset. Please use "Forgot password".';
        case 'TooManyRequestsException':   return 'Too many attempts. Please wait a moment and try again.';
        default: return err.message || 'Sign in failed. Please try again.';
    }
}

// ─── Button Helpers ──────────────────────────────────────────────────────────
function setButtonLoading(btn, label) {
    if (!btn) return;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${label}`;
}

function resetButton(btn, label) {
    if (!btn) return;
    btn.disabled = false;
    btn.textContent = label;
}

// ─── File Handling ───────────────────────────────────────────────────────────
function handleFileSelection(e) {
    const file = e.target.files[0];
    if (!file) { fileNameDisplay.textContent = ''; return; }
    if (!file.name.endsWith('.txt')) {
        updateFieldError(textFileInput, 'Please select a .txt file.');
        textFileInput.value = ''; fileNameDisplay.textContent = ''; return;
    }
    if (file.size > MAX_FILE_SIZE) {
        updateFieldError(textFileInput, `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit.`);
        textFileInput.value = ''; fileNameDisplay.textContent = ''; return;
    }
    fileNameDisplay.textContent = `✓ ${file.name} (${formatFileSize(file.size)})`;
    updateFieldError(textFileInput, '');
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024, sizes = ['Bytes', 'KB', 'MB'];
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
    const errors   = [];

    if (!category) errors.push('Please select a content category.');
    if (!audio)    errors.push('Please select background audio.');
    if (!file)     errors.push('Please upload a text file.');
    if (errors.length) { showFormError(errors.join(' ')); return; }

    const formData = new FormData();
    formData.append('category', category.value);
    formData.append('audio', audio.value);
    formData.append('textFile', file);
    submitVideoCreationRequest(formData);
}

function submitVideoCreationRequest(formData) {
    const submitBtn = document.getElementById('submit-btn');
    const origText  = submitBtn.textContent;
    setButtonLoading(submitBtn, 'Creating...');
    setTimeout(() => {
        resetButton(submitBtn, origText);
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
function capitalizeString(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

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
            if (!form.checkValidity()) { e.preventDefault(); e.stopPropagation(); }
            form.classList.add('was-validated');
        }, false);
    });
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkAuthState();
});