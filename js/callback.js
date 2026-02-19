/**
 * VoiceCraft — OAuth Callback Handler
 *
 * This page is used ONLY if we switch to the Cognito Hosted UI login flow.
 * With direct SDK login (the current default), this page is not triggered.
 * It's kept here so the OAuth redirect URL remains valid in Cognito.
 *
 * Flow (Hosted UI only):
 *   1. Cognito redirects here with ?code=XXXX after the user authenticates
 *   2. We POST the code to Cognito's /oauth2/token endpoint
 *   3. Cognito returns id_token, access_token, refresh_token
 *   4. We decode the id_token to get user info (email, name)
 *   5. We store everything in sessionStorage and redirect to the main app
 */

(async function () {

    const params = new URLSearchParams(window.location.search);
    const code   = params.get('code');
    const error  = params.get('error');

    // Cognito returned an explicit OAuth error (e.g. access_denied)
    if (error) {
        showError(`Sign in error: ${params.get('error_description') || error}`);
        return;
    }

    // No auth code in the URL — user landed here directly, send them home
    if (!code) {
        window.location.href = 'index.html';
        return;
    }

    try {
        await exchangeCodeForTokens(code);
    } catch (err) {
        console.error('Token exchange failed:', err);
        showError(err.message || 'Failed to complete sign in. Please try again.');
    }

})();

/**
 * POST the authorisation code to Cognito's token endpoint.
 * On success, stores tokens and user info then redirects to the main app.
 *
 * @param {string} code - The one-time authorisation code from the URL
 */
async function exchangeCodeForTokens(code) {
    const body = new URLSearchParams({
        grant_type:   'authorization_code',
        client_id:    AUTH_CONFIG.clientId,
        code:         code,
        redirect_uri: AUTH_CONFIG.callbackUrl,
    });

    const response = await fetch(`${AUTH_CONFIG.hostedUiDomain}/oauth2/token`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    body.toString(),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Token endpoint returned ${response.status}: ${text}`);
    }

    const tokens = await response.json();

    if (!tokens.id_token) {
        throw new Error('No ID token returned from Cognito.');
    }

    // Decode the JWT payload section (base64) to extract user claims.
    // Cognito already verified the signature server-side, so we just read the claims.
    const payload = JSON.parse(atob(tokens.id_token.split('.')[1]));
    const email   = payload.email || '';

    // Persist to sessionStorage for the main app
    sessionStorage.setItem('id_token',    tokens.id_token);
    sessionStorage.setItem('access_token', tokens.access_token);
    sessionStorage.setItem('userEmail',   email);
    sessionStorage.setItem('userName',    payload.name || payload['cognito:username'] || email.split('@')[0]);

    // Replace the current history entry so the back button skips this page
    window.location.replace('index.html');
}

/**
 * Switch the UI to the error state and display a message.
 *
 * @param {string} message - Human-readable error description
 */
function showError(message) {
    document.getElementById('status-signing-in').classList.add('d-none');
    document.getElementById('status-error').classList.remove('d-none');
    document.getElementById('error-message').textContent = message;
}
