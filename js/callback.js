/**
 * VoiceCraft - Callback Handler
 *
 * This page is where Cognito redirects after a successful login.
 * The URL will look like:  /callback.html?code=XXXXXXXXXXXX
 *
 * This script:
 *  1. Reads the ?code= from the URL
 *  2. POSTs it to Cognito's /oauth2/token endpoint
 *  3. Extracts the user's email & name from the returned id_token
 *  4. Saves tokens to sessionStorage
 *  5. Redirects to the main app
 */

(async function () {
    const params = new URLSearchParams(window.location.search);
    const code   = params.get('code');
    const error  = params.get('error');

    if (error) {
        showError(`Cognito returned an error: ${error}`);
        return;
    }

    if (!code) {
        // No code in the URL — user probably landed here directly
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

async function exchangeCodeForTokens(code) {
    // Build the token request body
    const body = new URLSearchParams({
        grant_type:   'authorization_code',
        client_id:    AUTH_CONFIG.clientId,
        code:         code,
        redirect_uri: AUTH_CONFIG.callbackUrl,
    });

    const tokenEndpoint = `${AUTH_CONFIG.hostedUiDomain}/oauth2/token`;

    const response = await fetch(tokenEndpoint, {
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
        throw new Error('No id_token in response from Cognito.');
    }

    // Decode the id_token JWT payload (it's just base64 — no verification needed
    // for reading claims on the client side; Cognito verified it server-side)
    const payload = JSON.parse(atob(tokens.id_token.split('.')[1]));

    // Store everything we need
    sessionStorage.setItem('id_token',    tokens.id_token);
    sessionStorage.setItem('access_token', tokens.access_token);
    sessionStorage.setItem('userEmail',   payload.email  || '');
    sessionStorage.setItem('userName',    payload.name   || payload['cognito:username'] || payload.email.split('@')[0]);

    // Clean the ?code= from the URL then go to the app
    window.location.replace('index.html');
}

function showError(message) {
    document.getElementById('status-signing-in').classList.add('d-none');
    const errorDiv = document.getElementById('status-error');
    errorDiv.classList.remove('d-none');
    document.getElementById('error-message').textContent = message;
}
