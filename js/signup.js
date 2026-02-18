/**
 * Signup page logic
 * - Performs client-side validation
 * - Placeholder for AWS Cognito integration
 */

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('signup-form');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('signup-email');
    const passwordInput = document.getElementById('signup-password');
    const passwordConfirmInput = document.getElementById('signup-password-confirm');
    const termsInput = document.getElementById('terms');
    const signupError = document.getElementById('signup-error');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        clearErrors();

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const confirm = passwordConfirmInput.value;

        // Basic validation
        let valid = true;
        if (!name) {
            setFieldError('name-error', 'Please enter your full name.');
            valid = false;
        }
        if (!email || !isValidEmail(email)) {
            setFieldError('signup-email-error', 'Please enter a valid email address.');
            valid = false;
        }
        if (!password || password.length < 8) {
            setFieldError('signup-password-error', 'Password must be at least 8 characters.');
            valid = false;
        }
        if (password !== confirm) {
            setFieldError('signup-password-confirm-error', 'Passwords do not match.');
            valid = false;
        }
        if (!termsInput.checked) {
            setFieldError('terms-error', 'You must agree to the terms.');
            valid = false;
        }

        if (!valid) return;

        // TODO: Integrate with AWS Cognito or Amplify here.
        // Example: use AWS Amplify Auth.signUp({ username: email, password, attributes: { name } })

        // For demo purposes, simulate success and redirect to login
        signupError.classList.add('d-none');
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';

        setTimeout(() => {
            // Simulate storing a temporary user record (do NOT use in production)
            sessionStorage.setItem('userEmail', email);
            sessionStorage.setItem('userName', name.split(' ')[0]);

            // Redirect to index (login) with a success message
            sessionStorage.setItem('signupSuccess', 'Account created successfully. Please sign in.');
            window.location.href = 'index.html';
        }, 1000);
    });
});

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function setFieldError(id, message) {
    const el = document.getElementById(id);
    if (el) el.textContent = message;
}

function clearErrors() {
    const ids = ['name-error','signup-email-error','signup-password-error','signup-password-confirm-error','terms-error'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '';
    });
    const signupError = document.getElementById('signup-error');
    if (signupError) {
        signupError.classList.add('d-none');
        signupError.textContent = '';
    }
}

// Export a helper for future Cognito integration
window.VoiceCraftSignup = {
    isValidEmail
};
