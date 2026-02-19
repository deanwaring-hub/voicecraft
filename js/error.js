/**
 * VoiceCraft — Error Page Script
 *
 * Reads error details from URL params or sessionStorage, then renders
 * the appropriate message block on error.html.
 *
 * To trigger this page from anywhere in the app:
 *   window.VoiceCraftError.triggerError(404, 'Optional detail', 'optional-id');
 *
 * The page reads from:
 *   URL: ?code=404&message=Detail&id=ERR-XXX
 *   OR sessionStorage: errorCode, errorMessage, errorId
 */

// ── Error type definitions ────────────────────────────────────────────────────
const ERROR_TYPES = {
    404:     { title: '404 - Page Not Found',  message: "The page you're looking for doesn't exist.", specific: 'error-404'     },
    500:     { title: '500 - Server Error',    message: 'Our servers are experiencing issues.',        specific: 'error-500'     },
    401:     { title: '401 - Unauthorised',    message: 'Your session has expired. Please log in.',   specific: 'error-401'     },
    403:     { title: '403 - Access Denied',   message: "You don't have permission here.",             specific: 'error-403'     },
    timeout: { title: 'Request Timeout',       message: 'The request took too long.',                  specific: 'error-timeout' },
    file:    { title: 'File Upload Error',     message: 'There was a problem with your file.',        specific: 'error-file'    },
    generic: { title: 'Something Went Wrong', message: 'An unexpected error occurred.',               specific: 'error-generic' },
};

// ── Initialise ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    displayError();
    setupAccessibility();
});

/**
 * Read error code/message/id from the URL or sessionStorage,
 * then populate and reveal the relevant UI elements.
 */
function displayError() {
    const params = new URLSearchParams(window.location.search);

    // URL params take priority; fall back to sessionStorage
    const code    = params.get('code')    || sessionStorage.getItem('errorCode')    || 'generic';
    const message = params.get('message') || sessionStorage.getItem('errorMessage') || null;
    const id      = params.get('id')      || sessionStorage.getItem('errorId')      || null;

    // Clear sessionStorage so stale errors don't reappear on next visit
    sessionStorage.removeItem('errorCode');
    sessionStorage.removeItem('errorMessage');
    sessionStorage.removeItem('errorId');

    const config = ERROR_TYPES[code] || ERROR_TYPES.generic;

    // Update the page title and visible text fields
    document.title = `${config.title} - VoiceCraft`;
    setText('error-code',    config.title);
    setText('error-message', message || config.message);

    // Show the detailed description if a custom message was provided
    if (message) {
        const details = document.getElementById('error-details');
        if (details) {
            details.textContent = `Details: ${message}`;
            details.classList.remove('d-none');
        }
    }

    // Reveal the matching error-specific description block
    const specific = document.getElementById(config.specific);
    if (specific) specific.classList.remove('d-none');

    // Show the error ID block if one was provided
    if (id) {
        setText('error-id', id);
        const container = document.getElementById('error-id-container');
        if (container) container.classList.remove('d-none');
    }

    // Announce to screen readers
    announce(`Error: ${config.title}. ${message || config.message}`);
}

/**
 * Move focus to the heading so screen reader users hear the error immediately.
 */
function setupAccessibility() {
    const heading = document.getElementById('main-content');
    if (heading) {
        heading.focus();
        heading.scrollIntoView({ behavior: 'smooth' });
    }
}

// ── Navigation ────────────────────────────────────────────────────────────────

function goBack() {
    // Only go back if the referrer is on the same site to avoid open redirects
    if (document.referrer && document.referrer.includes(window.location.hostname)) {
        window.history.back();
    } else {
        goHome();
    }
}

function goHome() {
    window.location.href = 'index.html';
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Redirect to the error page with context. Call this from anywhere in the app.
 *
 * @param {string|number} code    - Error type: 404 | 500 | 401 | 403 | 'timeout' | 'file' | 'generic'
 * @param {string}        message - Optional human-readable detail
 * @param {string}        errorId - Optional reference ID (e.g. from generateErrorId())
 */
function triggerError(code, message, errorId) {
    sessionStorage.setItem('errorCode', String(code));
    if (message) sessionStorage.setItem('errorMessage', message);
    if (errorId) sessionStorage.setItem('errorId', errorId);
    window.location.href = 'error.html';
}

/**
 * Generate a short unique error ID for support reference.
 * Format: ERR-<timestamp base36>-<random>
 */
function generateErrorId() {
    const ts     = Date.now().toString(36);
    const rand   = Math.random().toString(36).substr(2, 6);
    return `ERR-${ts}-${rand}`.toUpperCase();
}

// Expose on window for use in other scripts
window.VoiceCraftError = { triggerError, generateErrorId };

// ── Utility Helpers ───────────────────────────────────────────────────────────

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function announce(message) {
    const el = document.createElement('div');
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'assertive');
    el.setAttribute('aria-atomic', 'true');
    el.className = 'visually-hidden';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
}

// ── Global Error Catching ─────────────────────────────────────────────────────
// These log unhandled errors to the console but do NOT auto-redirect,
// as that would be too aggressive for minor JS errors on other pages.

window.addEventListener('error', (event) => {
    console.error('Unhandled JS error:', {
        message:  event.message,
        source:   event.filename,
        line:     event.lineno,
        col:      event.colno,
    });
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});
