/**
 * VoiceCraft — Sign Up Page Script
 *
 * Uses the Cognito Identity SDK to register users directly on-site.
 * No Hosted UI redirect — the user never leaves VoiceCraft.
 *
 * Flow:
 *   Step 1 — User fills the registration form
 *             → userPool.signUp() is called
 *             → Cognito sends a 6-digit code to the user's email
 *             → We hide Step 1 and show Step 2
 *
 *   Step 2 — User enters the verification code
 *             → cognitoUser.confirmRegistration() is called
 *             → On success, redirect to index.html (login)
 */

document.addEventListener('DOMContentLoaded', () => {

    // ── Cognito User Pool ─────────────────────────────────────────────────────
    const userPool = new AmazonCognitoIdentity.CognitoUserPool({
        UserPoolId: AUTH_CONFIG.userPoolId,
        ClientId:   AUTH_CONFIG.clientId,
    });

    // ── DOM References ────────────────────────────────────────────────────────
    const signupStep     = document.getElementById('signup-step');
    const verifyStep     = document.getElementById('verify-step');
    const signupForm     = document.getElementById('signup-form');
    const verifyForm     = document.getElementById('verify-form');
    const signupError    = document.getElementById('signup-error');
    const verifyError    = document.getElementById('verify-error');
    const resendBtn      = document.getElementById('resend-code-btn');
    const verifyEmailMsg = document.getElementById('verify-email-display');

    // Stored between Step 1 and Step 2
    let pendingCognitoUser = null;

    // ── Step 1: Registration ──────────────────────────────────────────────────
    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        clearAllErrors();

        // Collect values
        const name     = document.getElementById('name').value.trim();
        const email    = document.getElementById('signup-email').value.trim();
        const password = document.getElementById('signup-password').value;
        const confirm  = document.getElementById('signup-password-confirm').value;
        const terms    = document.getElementById('terms').checked;

        // Client-side validation before hitting Cognito
        let valid = true;
        if (!name)                             { setFieldError('name-error', 'Please enter your full name.'); valid = false; }
        if (!email || !isValidEmail(email))    { setFieldError('signup-email-error', 'Please enter a valid email address.'); valid = false; }
        if (!password || password.length < 8)  { setFieldError('signup-password-error', 'Password must be at least 8 characters.'); valid = false; }
        if (password !== confirm)              { setFieldError('signup-password-confirm-error', 'Passwords do not match.'); valid = false; }
        if (!terms)                            { setFieldError('terms-error', 'You must agree to the terms to continue.'); valid = false; }
        if (!valid) return;

        const submitBtn = signupForm.querySelector('button[type="submit"]');
        setButtonLoading(submitBtn, 'Creating account...');

        // Attributes to attach to the Cognito user record
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

            // Registration succeeded — Cognito has sent the code
            pendingCognitoUser = result.user;
            if (verifyEmailMsg) verifyEmailMsg.textContent = email;
            signupStep.classList.add('d-none');
            verifyStep.classList.remove('d-none');
        });
    });

    // ── Step 2: Email Verification ────────────────────────────────────────────
    verifyForm.addEventListener('submit', (e) => {
        e.preventDefault();
        clearAllErrors();

        const code = document.getElementById('verify-code').value.trim();
        if (!code) {
            setFieldError('verify-code-error', 'Please enter the 6-digit verification code.');
            return;
        }

        const submitBtn = verifyForm.querySelector('button[type="submit"]');
        setButtonLoading(submitBtn, 'Verifying...');

        pendingCognitoUser.confirmRegistration(code, true, (err) => {
            resetButton(submitBtn, 'Verify Email');

            if (err) {
                showVerifyMessage(friendlyError(err), 'danger');
                return;
            }

            // Email confirmed — send to login with a success flag
            sessionStorage.setItem('signupSuccess', 'Account verified! Please sign in.');
            window.location.href = 'index.html';
        });
    });

    // ── Resend Verification Code ──────────────────────────────────────────────
    if (resendBtn) {
        resendBtn.addEventListener('click', () => {
            if (!pendingCognitoUser) return;

            resendBtn.disabled    = true;
            resendBtn.textContent = 'Sending...';

            pendingCognitoUser.resendConfirmationCode((err) => {
                resendBtn.disabled    = false;
                resendBtn.textContent = 'Resend code';

                if (err) {
                    showVerifyMessage(friendlyError(err), 'danger');
                } else {
                    showVerifyMessage('A new code has been sent to your email.', 'success');
                }
            });
        });
    }

    // ── UI Helpers ────────────────────────────────────────────────────────────

    function showSignupError(message) {
        signupError.textContent = message;
        signupError.classList.remove('d-none');
        signupError.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function showVerifyMessage(message, type = 'danger') {
        verifyError.textContent = message;
        verifyError.className   = `alert alert-${type}`;
        verifyError.classList.remove('d-none');
    }

    function clearAllErrors() {
        ['name-error', 'signup-email-error', 'signup-password-error',
         'signup-password-confirm-error', 'terms-error', 'verify-code-error']
            .forEach(id => setFieldError(id, ''));
        signupError.classList.add('d-none');
        signupError.textContent = '';
    }

    function setButtonLoading(btn, label) {
        btn.disabled  = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${label}`;
    }

    function resetButton(btn, label) {
        btn.disabled    = false;
        btn.textContent = label;
    }

    /**
     * Map Cognito SDK error codes to user-friendly messages.
     */
    function friendlyError(err) {
        switch (err.code) {
            case 'UsernameExistsException':
                return 'An account with this email already exists. Try signing in instead.';
            case 'InvalidPasswordException':
                return 'Password must include uppercase, lowercase, a number, and a special character.';
            case 'CodeMismatchException':
                return 'Incorrect verification code. Please check your email and try again.';
            case 'ExpiredCodeException':
                return 'That code has expired. Click "Resend code" to get a new one.';
            case 'TooManyRequestsException':
            case 'LimitExceededException':
                return 'Too many requests. Please wait a moment and try again.';
            default:
                return err.message || 'Something went wrong. Please try again.';
        }
    }

});

// ── Standalone Utilities ──────────────────────────────────────────────────────
// (Outside DOMContentLoaded so they're available globally if needed)

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setFieldError(id, message) {
    const el = document.getElementById(id);
    if (el) el.textContent = message;
}
