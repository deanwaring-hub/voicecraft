/**
 * VoiceCraft - Signup Page
 *
 * Uses Amazon Cognito Identity SDK (loaded via CDN in signup.html)
 * to register new users directly — no Hosted UI, stays on your site.
 *
 * Flow:
 *  1. User fills in the form → we call cognitoUser.signUp()
 *  2. Cognito sends a verification code to their email
 *  3. We show a "enter your code" step inline on the same page
 *  4. User enters code → we call cognitoUser.confirmRegistration()
 *  5. On success → redirect to index.html with a success flash message
 */

document.addEventListener('DOMContentLoaded', () => {

    // ── Cognito Setup ───────────────────────────────────────────────────────
    const poolData = {
        UserPoolId: AUTH_CONFIG.userPoolId,
        ClientId:   AUTH_CONFIG.clientId,
    };
    const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

    // ── DOM ─────────────────────────────────────────────────────────────────
    const signupStep     = document.getElementById('signup-step');
    const verifyStep     = document.getElementById('verify-step');
    const signupForm     = document.getElementById('signup-form');
    const verifyForm     = document.getElementById('verify-form');
    const signupError    = document.getElementById('signup-error');
    const verifyError    = document.getElementById('verify-error');
    const resendBtn      = document.getElementById('resend-code-btn');
    const verifyEmailMsg = document.getElementById('verify-email-display');

    let pendingEmail = '';
    let pendingCognitoUser = null;

    // ── Step 1: Registration ────────────────────────────────────────────────
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors();

        const name     = document.getElementById('name').value.trim();
        const email    = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const confirm  = document.getElementById('signup-password-confirm').value;
        const terms    = document.getElementById('terms').checked;

        // Client-side validation
        let valid = true;
        if (!name)                         { setFieldError('name-error', 'Please enter your full name.'); valid = false; }
        if (!email || !isValidEmail(email)) { setFieldError('signup-email-error', 'Please enter a valid email address.'); valid = false; }
        if (!password || password.length < 8) { setFieldError('signup-password-error', 'Password must be at least 8 characters.'); valid = false; }
        if (password !== confirm)           { setFieldError('signup-password-confirm-error', 'Passwords do not match.'); valid = false; }
        if (!terms)                         { setFieldError('terms-error', 'You must agree to the terms.'); valid = false; }
        if (!valid) return;

        // Show loading state
        const submitBtn = signupForm.querySelector('button[type="submit"]');
        setButtonLoading(submitBtn, 'Creating account…');

        // Cognito attributes
        const attributeList = [
            new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'email', Value: email }),
            new AmazonCognitoIdentity.CognitoUserAttribute({ Name: 'name',  Value: name  }),
        ];

        userPool.signUp(email, password, attributeList, null, (err, result) => {
            resetButton(submitBtn, 'Create Account');

            if (err) {
                showSignupError(friendlyError(err));
                return;
            }

            // Registration succeeded — show the verification step
            pendingEmail       = email;
            pendingCognitoUser = result.user;
            if (verifyEmailMsg) verifyEmailMsg.textContent = email;
            signupStep.classList.add('d-none');
            verifyStep.classList.remove('d-none');
        });
    });

    // ── Step 2: Email Verification ──────────────────────────────────────────
    verifyForm.addEventListener('submit', (e) => {
        e.preventDefault();
        clearErrors();

        const code = document.getElementById('verify-code').value.trim();
        if (!code) { setFieldError('verify-code-error', 'Please enter the verification code.'); return; }

        const submitBtn = verifyForm.querySelector('button[type="submit"]');
        setButtonLoading(submitBtn, 'Verifying…');

        pendingCognitoUser.confirmRegistration(code, true, (err) => {
            resetButton(submitBtn, 'Verify Email');

            if (err) {
                showVerifyError(friendlyError(err));
                return;
            }

            // All done — go to login with a success message
            sessionStorage.setItem('signupSuccess', 'Account verified! Please sign in.');
            window.location.href = 'index.html';
        });
    });

    // ── Resend Code ─────────────────────────────────────────────────────────
    if (resendBtn) {
        resendBtn.addEventListener('click', () => {
            if (!pendingCognitoUser) return;
            resendBtn.disabled = true;
            resendBtn.textContent = 'Sending…';

            pendingCognitoUser.resendConfirmationCode((err) => {
                resendBtn.disabled = false;
                resendBtn.textContent = 'Resend code';
                if (err) {
                    showVerifyError(friendlyError(err));
                } else {
                    showVerifyError('A new code has been sent to your email.', 'success');
                }
            });
        });
    }

    // ── Helpers ─────────────────────────────────────────────────────────────
    function showSignupError(message) {
        signupError.textContent = message;
        signupError.classList.remove('d-none');
        signupError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function showVerifyError(message, type = 'danger') {
        verifyError.textContent = message;
        verifyError.className = `alert alert-${type}`;
        verifyError.classList.remove('d-none');
    }

    function setButtonLoading(btn, label) {
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${label}`;
    }

    function resetButton(btn, label) {
        btn.disabled = false;
        btn.textContent = label;
    }

    function clearErrors() {
        ['name-error','signup-email-error','signup-password-error','signup-password-confirm-error','terms-error','verify-code-error']
            .forEach(id => { const el = document.getElementById(id); if (el) el.textContent = ''; });
        signupError.classList.add('d-none');
        signupError.textContent = '';
    }

    /** Turn Cognito SDK error codes into readable messages */
    function friendlyError(err) {
        switch (err.code) {
            case 'UsernameExistsException':
                return 'An account with this email already exists. Try signing in instead.';
            case 'InvalidPasswordException':
                return 'Password must be at least 8 characters and include uppercase, lowercase, and a number.';
            case 'CodeMismatchException':
                return 'Incorrect verification code. Please check your email and try again.';
            case 'ExpiredCodeException':
                return 'That code has expired. Click "Resend code" to get a new one.';
            case 'TooManyRequestsException':
                return 'Too many attempts. Please wait a moment and try again.';
            case 'LimitExceededException':
                return 'Too many requests. Please try again in a few minutes.';
            default:
                return err.message || 'Something went wrong. Please try again.';
        }
    }
});

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setFieldError(id, message) {
    const el = document.getElementById(id);
    if (el) el.textContent = message;
}
