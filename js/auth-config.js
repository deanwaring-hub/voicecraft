1/**
 * VoiceCraft - Cognito Auth Configuration
 * Single source of truth - update these values if you ever recreate the pool
 */
const AUTH_CONFIG = {
    region:        'eu-west-2',
    userPoolId:    'eu-west-2_9G6wvet1N',
    clientId:      '79bnu9nead8lfbvf158pr2ppuf',
    domain:        'https://cognito-idp.eu-west-2.amazonaws.com/eu-west-2_9G6wvet1N',

    // The Cognito Hosted UI domain (for login redirects)
    // Found in Cognito > User Pool > App integration > Domain
    // Looks like: https://voicecraft-web.auth.eu-west-2.amazoncognito.com
    hostedUiDomain: 'https://voicecraft-web.auth.eu-west-2.amazoncognito.com',

    // Where Cognito sends the user after login
    callbackUrl:   'https://daikdlt9atbtt.cloudfront.net/callback.html',

    // Where Cognito sends the user after logout
    logoutUrl:     'https://daikdlt9atbtt.cloudfront.net/',

    // OAuth scopes to request
    scopes:        'email+openid+profile',
};
