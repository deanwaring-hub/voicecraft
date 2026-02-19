/**
 * VoiceCraft — Auth & AWS Configuration
 *
 * Single source of truth for all AWS resource identifiers.
 * This file is loaded FIRST before all other scripts.
 * If you ever recreate a Cognito pool, S3 bucket, or Identity Pool,
 * update the relevant value here and nowhere else.
 */
const AUTH_CONFIG = {

    // ── AWS Region ─────────────────────────────────────────────────────────
    region: 'eu-west-2',

    // ── Cognito User Pool ──────────────────────────────────────────────────
    // Used for direct SDK login (email + password, no Hosted UI redirect)
    userPoolId: 'eu-west-2_9G6wvet1N',
    clientId:   '79bnu9nead8lfbvf158pr2ppuf',

    // ── Cognito Identity Pool ──────────────────────────────────────────────
    // Grants authenticated users temporary AWS credentials so the browser
    // can upload files directly to S3 without a backend proxy
    identityPoolId: 'eu-west-2:54a7d7ad-80f4-46af-baed-cbb7550f5646',

    // ── Cognito Hosted UI ──────────────────────────────────────────────────
    // Not used for login (we use the SDK directly), but kept here in case
    // we ever need OAuth flows or the callback page
    hostedUiDomain: 'https://eu-west-29g6wvet1n.auth.eu-west-2.amazoncognito.com',
    callbackUrl:    'https://daikdlt9atbtt.cloudfront.net/callback.html',
    logoutUrl:      'https://daikdlt9atbtt.cloudfront.net/',
    scopes:         'email+openid+profile',

    // ── S3 Buckets ─────────────────────────────────────────────────────────
    // inputBucket  — user uploads go here; triggers the Polly Lambda
    // outputBucket — Lambda saves the generated MP3 here
    inputBucket:  'voicecraft-text-input',
    outputBucket: 'voicecraft-audio-output',

    // ── API Gateway ────────────────────────────────────────────────────────
    // Base URL for the VoiceCraft REST API (jobs + download URL endpoints)
    apiBaseUrl: 'https://6e3t8ktui5.execute-api.eu-west-2.amazonaws.com/prod',

};
