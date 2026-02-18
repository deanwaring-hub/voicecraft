/**
 * VoiceCraft - Error Page Handler
 * Displays user-friendly error messages and provides navigation options
 */

/**
 * Error types and their messages
 */
const ERROR_TYPES = {
    404: {
        title: '404 - Page Not Found',
        message: 'The page you are looking for doesn\'t exist.',
        specific: 'error-404'
    },
    500: {
        title: '500 - Server Error',
        message: 'Our servers are experiencing issues.',
        specific: 'error-500'
    },
    401: {
        title: '401 - Unauthorized',
        message: 'Your session has expired. Please log in again.',
        specific: 'error-401'
    },
    403: {
        title: '403 - Access Denied',
        message: 'You don\'t have permission to access this resource.',
        specific: 'error-403'
    },
    timeout: {
        title: 'Request Timeout',
        message: 'The request took too long to complete.',
        specific: 'error-timeout'
    },
    file: {
        title: 'File Upload Error',
        message: 'There was an issue uploading your file.',
        specific: 'error-file'
    },
    generic: {
        title: 'Something Went Wrong',
        message: 'An unexpected error occurred.',
        specific: 'error-generic'
    }
};

/**
 * Initialize error page on load
 */
document.addEventListener('DOMContentLoaded', () => {
    displayError();
    setupAccessibility();
});

/**
 * Display error based on URL parameters or stored error data
 */
function displayError() {
    // Get error from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const errorCode = urlParams.get('code');
    const errorMessage = urlParams.get('message');
    const errorId = urlParams.get('id');

    // Fallback to sessionStorage
    let code = errorCode || sessionStorage.getItem('errorCode') || 'generic';
    let message = errorMessage || sessionStorage.getItem('errorMessage');
    let id = errorId || sessionStorage.getItem('errorId');

    // Get error configuration
    const errorConfig = ERROR_TYPES[code] || ERROR_TYPES.generic;

    // Update page title
    document.title = `${errorConfig.title} - VoiceCraft`;

    // Update error code
    const codeElement = document.getElementById('error-code');
    if (codeElement) {
        codeElement.textContent = errorConfig.title;
    }

    // Update error message
    const messageElement = document.getElementById('error-message');
    if (messageElement) {
        messageElement.textContent = message || errorConfig.message;
    }

    // Display specific error information if provided
    const detailsElement = document.getElementById('error-details');
    if (detailsElement && message) {
        detailsElement.textContent = `Details: ${message}`;
        detailsElement.classList.remove('d-none');
    }

    // Show specific error content
    const specificElement = document.getElementById(errorConfig.specific);
    if (specificElement) {
        specificElement.classList.remove('d-none');
    }

    // Display error ID if provided
    if (id) {
        const idContainer = document.getElementById('error-id-container');
        const idElement = document.getElementById('error-id');
        if (idContainer && idElement) {
            idElement.textContent = id;
            idContainer.classList.remove('d-none');
        }
    }

    // Clear sessionStorage after displaying
    sessionStorage.removeItem('errorCode');
    sessionStorage.removeItem('errorMessage');
    sessionStorage.removeItem('errorId');

    // Announce error to screen readers
    announceToScreenReaders(`Error: ${errorConfig.title}. ${message || errorConfig.message}`);
}

/**
 * Setup accessibility features
 */
function setupAccessibility() {
    // Focus management
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        mainContent.focus();
        mainContent.scrollIntoView({ behavior: 'smooth' });
    }

    // Keyboard navigation
    const buttons = document.querySelectorAll('.error-actions button, .support-links a');
    buttons.forEach(button => {
        button.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && button.tagName === 'BUTTON') {
                button.click();
            }
        });
    });
}

/**
 * Navigate back to previous page
 */
function goBack() {
    const referrer = document.referrer;
    
    // Check if referrer is valid VoiceCraft URL
    if (referrer && referrer.includes(window.location.hostname)) {
        window.history.back();
    } else {
        // Fallback to home if no valid referrer
        goHome();
    }
}

/**
 * Navigate to home page
 */
function goHome() {
    // Check if user is logged in by checking sessionStorage
    const userEmail = sessionStorage.getItem('userEmail');
    
    if (userEmail) {
        // Redirect to main app
        window.location.href = 'index.html';
    } else {
        // Redirect to login
        window.location.href = 'index.html';
    }
}

/**
 * Announce message to screen readers
 */
function announceToScreenReaders(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'alert');
    announcement.setAttribute('aria-live', 'assertive');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'visually-hidden';
    announcement.textContent = message;
    document.body.appendChild(announcement);

    // Remove after announcement
    setTimeout(() => announcement.remove(), 2000);
}

/**
 * Trigger error from main app
 * Usage: triggerError(404, 'Page not found', 'err-12345')
 */
function triggerError(code, message, errorId) {
    // Store error data
    sessionStorage.setItem('errorCode', code);
    if (message) {
        sessionStorage.setItem('errorMessage', message);
    }
    if (errorId) {
        sessionStorage.setItem('errorId', errorId);
    }

    // Redirect to error page
    window.location.href = 'error.html';
}

/**
 * Handle network errors
 */
window.addEventListener('error', (event) => {
    console.error('Global error:', event);
    
    // Generate error ID
    const errorId = generateErrorId();
    
    // Store error data
    sessionStorage.setItem('errorCode', 'generic');
    sessionStorage.setItem('errorMessage', 'An unexpected error occurred');
    sessionStorage.setItem('errorId', errorId);
    
    // Log to console for debugging
    console.error('Error tracked:', {
        message: event.message,
        source: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        errorId: errorId
    });
});

/**
 * Handle unhandled promise rejections
 */
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled rejection:', event.reason);
    
    // Generate error ID
    const errorId = generateErrorId();
    
    // Store error data
    sessionStorage.setItem('errorCode', 'generic');
    sessionStorage.setItem('errorMessage', 'An operation failed to complete');
    sessionStorage.setItem('errorId', errorId);
    
    // Log to console for debugging
    console.error('Rejection tracked:', {
        reason: event.reason,
        errorId: errorId
    });
});

/**
 * Generate unique error ID
 */
function generateErrorId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `ERR-${timestamp}-${random}`.toUpperCase();
}

/**
 * Handle fetch errors
 */
function fetchWithErrorHandling(url, options = {}) {
    return fetch(url, options)
        .catch(error => {
            console.error('Fetch error:', error);
            const errorId = generateErrorId();
            triggerError(500, 'Network request failed', errorId);
        })
        .then(response => {
            if (!response.ok) {
                const errorId = generateErrorId();
                
                let code = response.status;
                let message = `Server returned ${response.status}`;
                
                // Map common HTTP status codes
                if (response.status === 404) {
                    message = 'Requested resource not found';
                } else if (response.status === 401) {
                    message = 'Authentication required';
                } else if (response.status === 403) {
                    message = 'Access forbidden';
                } else if (response.status === 500) {
                    message = 'Internal server error';
                } else if (response.status >= 500) {
                    message = 'Server error';
                }
                
                triggerError(code, message, errorId);
            }
            return response;
        });
}

/**
 * Export functions for use in other scripts
 */
window.VoiceCraftError = {
    triggerError,
    fetchWithErrorHandling,
    generateErrorId
};
