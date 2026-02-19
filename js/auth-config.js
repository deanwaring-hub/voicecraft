/**
 * VoiceCraft - Auth & AWS Configuration
 * Single source of truth - update these values if you ever recreate resources
 */
const AUTH_CONFIG = {
    region:           'eu-west-2',
    userPoolId:       'eu-west-2_9G6wvet1N',
    clientId:         '79bnu9nead8lfbvf158pr2ppuf',
    identityPoolId:   'eu-west-2:54a7d7ad-80f4-46af-baed-cbb7550f5646',

    // Cognito Hosted UI domain
    hostedUiDomain:   'https://eu-west-29g6wvet1n.auth.eu-west-2.amazoncognito.com',

    // Where Cognito sends the user after login
    callbackUrl:      'https://daikdlt9atbtt.cloudfront.net/callback.html',

    // Where Cognito sends the user after logout
    logoutUrl:        'https://daikdlt9atbtt.cloudfront.net/',

    // OAuth scopes
    scopes:           'email+openid+profile',

    // S3 buckets
    inputBucket:      'voicecraft-text-input',
    outputBucket:     'voicecraft-audio-output',
};