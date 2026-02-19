/**
 * VoiceCraft — Main Application Script
 *
 * Responsibilities:
 *   1. Check Cognito session on page load (show login or main screen)
 *   2. Authenticate users via Cognito SDK (no Hosted UI redirect)
 *   3. Get temporary AWS credentials from the Cognito Identity Pool
 *   4. Upload text files directly to S3 (triggers the Polly Lambda pipeline)
 *   5. Manage all UI state transitions and error messaging
 *
 * Dependencies (loaded before this file in index.html):
 *   - amazon-cognito-identity-js  → AmazonCognitoIdentity global
 *   - aws-sdk                     → AWS global
 *   - auth-config.js              → AUTH_CONFIG global
 */

// ─── DOM References ───────────────────────────────────────────────────────────
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

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// ─── Cognito User Pool ────────────────────────────────────────────────────────
// The SDK automatically persists tokens in localStorage so sessions
// survive page refreshes without requiring the user to log in again.
const userPool = new AmazonCognitoIdentity.CognitoUserPool({
    UserPoolId: AUTH_CONFIG.userPoolId,
    ClientId:   AUTH_CONFIG.clientId,
});

// ─── Initialisation ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupFormValidation();
    checkAuthState();
    setupEventListeners();
});

/**
 * Check whether the user already has a valid Cognito session in localStorage.
 * Shows the main screen if valid, otherwise shows the login screen.
 */
function checkAuthState() {
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) { showLoginScreen(); return; }

    cognitoUser.getSession((err, session) => {
        if (err || !session.isValid()) { showLoginScreen(); return; }

        const payload = session.getIdToken().decodePayload();
        storeUserInfo(payload);
        showMainScreen(payload.email);
    });
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
function setupEventListeners() {
    if (loginForm)     loginForm.addEventListener('submit', handleLogin);
    if (logoutBtn)     logoutBtn.addEventListener('click', handleLogout);
    if (videoForm)     videoForm.addEventListener('submit', handleVideoFormSubmit);
    if (fileButton)    fileButton.addEventListener('click', () => textFileInput.click());
    if (textFileInput) textFileInput.addEventListener('change', handleFileSelection);
    if (loginForm)     loginForm.addEventListener('change', clearLoginError);
    if (videoForm)     videoForm.addEventListener('input', clearFormAlerts);

    // Re-check auth when the user switches back to this tab
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkAuthState();
    });
}

// ─── Login ────────────────────────────────────────────────────────────────────

/**
 * Authenticate with Cognito directly using email + password.
 * Requires ALLOW_USER_PASSWORD_AUTH to be enabled on the Cognito app client.
 */
function handleLogin(e) {
    e.preventDefault();
    clearLoginError();

    const email    = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        showLoginError('Please enter your email and password.');
        return;
    }

    const submitBtn = loginForm.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, 'Signing in...');

    const cognitoUser = new AmazonCognitoIdentity.CognitoUser({ Username: email, Pool: userPool });
    const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({ Username: email, Password: password });

    cognitoUser.authenticateUser(authDetails, {
        onSuccess(session) {
            resetButton(submitBtn, 'SIGN IN');
            const payload = session.getIdToken().decodePayload();
            storeUserInfo(payload);
            showMainScreen(payload.email);
        },
        onFailure(err) {
            resetButton(submitBtn, 'SIGN IN');
            showLoginError(friendlyAuthError(err));
        },
        // Triggered when an admin-created account requires a password change
        newPasswordRequired() {
            resetButton(submitBtn, 'SIGN IN');
            showLoginError('A password reset is required. Please contact support.');
        },
    });
}

// ─── Logout ───────────────────────────────────────────────────────────────────

function handleLogout() {
    if (!confirm('Are you sure you want to sign out?')) return;
    const cognitoUser = userPool.getCurrentUser();
    if (cognitoUser) cognitoUser.signOut(); // Clears tokens from localStorage
    sessionStorage.clear();
    showLoginScreen();
}

// ─── User Info ────────────────────────────────────────────────────────────────

/**
 * Store key user details in sessionStorage for easy access during the session.
 * (sessionStorage is cleared automatically when the tab is closed)
 */
function storeUserInfo(jwtPayload) {
    const email = jwtPayload.email || '';
    sessionStorage.setItem('userEmail', email);
    sessionStorage.setItem('userName',  jwtPayload.name || jwtPayload['cognito:username'] || email.split('@')[0]);
    sessionStorage.setItem('userId',    jwtPayload.sub  || '');
}

// ─── AWS Credentials ──────────────────────────────────────────────────────────

/**
 * Exchange the Cognito ID token for temporary AWS credentials via the
 * Cognito Identity Pool. These scoped credentials allow the browser to
 * PUT objects into S3 without exposing any permanent AWS keys.
 *
 * @returns {Promise<AWS.CognitoIdentityCredentials>}
 */
function getAWSCredentials() {
    return new Promise((resolve, reject) => {
        const cognitoUser = userPool.getCurrentUser();
        if (!cognitoUser) { reject(new Error('Not authenticated')); return; }

        cognitoUser.getSession((err, session) => {
            if (err) { reject(err); return; }

            // The Logins map tells the Identity Pool which User Pool issued this token
            const loginKey = `cognito-idp.${AUTH_CONFIG.region}.amazonaws.com/${AUTH_CONFIG.userPoolId}`;

            AWS.config.region = AUTH_CONFIG.region;
            AWS.config.credentials = new AWS.CognitoIdentityCredentials({
                IdentityPoolId: AUTH_CONFIG.identityPoolId,
                Logins: { [loginKey]: session.getIdToken().getJwtToken() },
            });

            AWS.config.credentials.refresh(credErr => {
                if (credErr) { reject(credErr); return; }
                resolve(AWS.config.credentials);
            });
        });
    });
}

// ─── Video Form Submission ────────────────────────────────────────────────────

/**
 * Validate selections, get AWS credentials, then upload the text file to S3.
 *
 * S3 key format: {userId}/{jobId}/{voice}/{category}/{audio}/{filename}
 *
 * Lambda reads each path segment to extract job metadata — this format
 * is intentional and must match what lambda_function.py expects.
 */
async function handleVideoFormSubmit(e) {
    e.preventDefault();
    clearFormAlerts();

    // Collect form values
    const category = document.querySelector('input[name="category"]:checked');
    const audio    = document.querySelector('input[name="audio"]:checked');
    const voice    = document.querySelector('input[name="voice"]:checked');
    const file     = textFileInput.files[0];

    // Validate all required fields before attempting upload
    const errors = [];
    if (!category) errors.push('Please select a content category.');
    if (!audio)    errors.push('Please select background audio.');
    if (!voice)    errors.push('Please select a voice.');
    if (!file)     errors.push('Please upload a text file.');
    if (errors.length) { showFormError(errors.join(' ')); return; }

    const submitBtn = document.getElementById('submit-btn');
    setButtonLoading(submitBtn, 'Uploading...');

    try {
        const jobId  = crypto.randomUUID(); // Unique ID for this job
        const userId = sessionStorage.getItem('userId') || 'unknown';

        // Get temporary S3 upload credentials from the Identity Pool
        await getAWSCredentials();

        // S3 key encodes all job metadata — Lambda parses each segment
        const s3Key = `${userId}/${jobId}/${voice.value}/${category.value}/${audio.value}/${file.name}`;

        const s3 = new AWS.S3();
        await s3.putObject({
            Bucket:      AUTH_CONFIG.inputBucket,
            Key:         s3Key,
            Body:        file,
            ContentType: 'text/plain',
        }).promise();

        console.log(`Job submitted — ID: ${jobId} | Key: ${s3Key}`);

        // Store job info so jobs.html can show the current job progress
        sessionStorage.setItem('currentJobId',  jobId);
        sessionStorage.setItem('currentJobMeta', JSON.stringify({
            voice:    voice.value,
            category: category.value,
            audio:    audio.value,
        }));

        // Redirect to the jobs page to show progress
        window.location.href = 'jobs.html';

    } catch (err) {
        console.error('Upload error:', err);
        resetButton(submitBtn, 'CREATE VIDEO');
        showFormError(`Upload failed: ${err.message || 'Please try again.'}`);
    }
}

// ─── File Handling ────────────────────────────────────────────────────────────

/**
 * Validate the selected file's type and size, then update the filename display.
 */
function handleFileSelection(e) {
    const file = e.target.files[0];
    if (!file) { fileNameDisplay.textContent = ''; return; }

    if (!file.name.endsWith('.txt')) {
        setFieldError('file-error', 'Please select a .txt file.');
        textFileInput.value = '';
        fileNameDisplay.textContent = '';
        return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
        setFieldError('file-error', `File exceeds the ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB limit.`);
        textFileInput.value = '';
        fileNameDisplay.textContent = '';
        return;
    }

    // Valid file
    setFieldError('file-error', '');
    fileNameDisplay.textContent = `OK: ${file.name} (${formatFileSize(file.size)})`;
}

// ─── Screen Management ────────────────────────────────────────────────────────

function showMainScreen(userEmail) {
    const userName = sessionStorage.getItem('userName') || userEmail.split('@')[0];
    if (userNameDisplay) userNameDisplay.textContent = `Welcome, ${capitalise(userName)}`;

    loginScreen.classList.add('d-none');
    mainScreen.classList.remove('d-none');

    // Move keyboard focus to main content for screen reader users
    const mainContent = document.getElementById('main-content');
    if (mainContent) { mainContent.focus(); mainContent.scrollIntoView(); }
}

function showLoginScreen() {
    mainScreen.classList.add('d-none');
    loginScreen.classList.remove('d-none');

    if (loginForm)       { loginForm.reset(); clearFieldErrors(); clearLoginError(); }
    if (videoForm)       videoForm.reset();
    if (fileNameDisplay) fileNameDisplay.textContent = '';

    // Return focus to the email field
    const emailInput = document.getElementById('email');
    if (emailInput) emailInput.focus();
}

// ─── UI Feedback ──────────────────────────────────────────────────────────────

function showLoginError(message) {
    if (!loginErrorDiv) return;
    loginErrorDiv.textContent = message;
    loginErrorDiv.classList.remove('d-none');
    loginErrorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearLoginError() {
    if (!loginErrorDiv) return;
    loginErrorDiv.classList.add('d-none');
    loginErrorDiv.textContent = '';
}

/**
 * Show the success state with the job ID so users can reference it.
 */
function showFormSuccess(jobId) {
    formSuccessAlert.innerHTML = `
        <strong>Job submitted!</strong> Your narration is being generated — this usually takes 1-2 minutes.<br>
        <small class="text-muted">Job ID: ${jobId}</small>
    `;
    formSuccessAlert.classList.remove('d-none');
    formErrorAlert.classList.add('d-none');
    formSuccessAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showFormError(message) {
    formErrorAlert.textContent = message;
    formErrorAlert.classList.remove('d-none');
    formSuccessAlert.classList.add('d-none');
    formErrorAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearFormAlerts() {
    formErrorAlert.classList.add('d-none');
    formSuccessAlert.classList.add('d-none');
}

function clearFieldErrors() {
    document.querySelectorAll('.invalid-feedback').forEach(el => el.textContent = '');
    if (loginForm) loginForm.classList.remove('was-validated');
}

function setFieldError(id, message) {
    const el = document.getElementById(id);
    if (el) el.textContent = message;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function setButtonLoading(btn, label) {
    if (!btn) return;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${label}`;
}

function resetButton(btn, label) {
    if (!btn) return;
    btn.disabled    = false;
    btn.textContent = label;
}

function capitalise(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const units = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + units[i];
}

/**
 * Map Cognito SDK error codes to user-friendly messages.
 */
function friendlyAuthError(err) {
    switch (err.code) {
        case 'NotAuthorizedException':         return 'Incorrect email or password. Please try again.';
        case 'UserNotFoundException':          return 'No account found with this email. Please sign up first.';
        case 'UserNotConfirmedException':      return 'Please verify your email before signing in. Check your inbox.';
        case 'PasswordResetRequiredException': return 'Your password needs to be reset. Please contact support.';
        case 'TooManyRequestsException':       return 'Too many attempts. Please wait a moment and try again.';
        default:                               return err.message || 'Sign in failed. Please try again.';
    }
}

/**
 * Wire up Bootstrap's native form validation so invalid fields
 * get highlighted when the user tries to submit an incomplete form.
 */
function setupFormValidation() {
    document.querySelectorAll('.needs-validation').forEach(form => {
        form.addEventListener('submit', e => {
            if (!form.checkValidity()) { e.preventDefault(); e.stopPropagation(); }
            form.classList.add('was-validated');
        }, false);
    });
}