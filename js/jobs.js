/**
 * VoiceCraft — Jobs Page Script
 *
 * Responsibilities:
 *   1. Verify the user is authenticated (redirect to login if not)
 *   2. Show progress for the current job (if arriving from form submission)
 *   3. List all past jobs from DynamoDB via the jobs Lambda
 *   4. Generate pre-signed S3 download URLs via the download Lambda
 *
 * Dependencies (loaded before this in jobs.html):
 *   - amazon-cognito-identity-js  → AmazonCognitoIdentity
 *   - aws-sdk                     → AWS
 *   - auth-config.js              → AUTH_CONFIG
 */

// ─── Config ───────────────────────────────────────────────────────────────────
// API Gateway base URL — update this after you create the API Gateway endpoint
const API_BASE_URL = AUTH_CONFIG.apiBaseUrl;

// How often to poll for job status updates (milliseconds)
const POLL_INTERVAL_MS = 4000;

// ─── State ────────────────────────────────────────────────────────────────────
const userPool = new AmazonCognitoIdentity.CognitoUserPool({
    UserPoolId: AUTH_CONFIG.userPoolId,
    ClientId:   AUTH_CONFIG.clientId,
});

let currentJobId  = null;
let pollTimer     = null;
let idToken       = null; // Cached for API calls

// ─── Initialisation ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    checkAuthAndInit();
});

/**
 * Verify the session is valid before showing the page.
 * Redirects to login if not authenticated.
 */
function checkAuthAndInit() {
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) { redirectToLogin(); return; }

    cognitoUser.getSession((err, session) => {
        if (err || !session.isValid()) { redirectToLogin(); return; }

        // Cache the ID token for API Gateway auth
        idToken = session.getIdToken().getJwtToken();

        const payload  = session.getIdToken().decodePayload();
        const email    = payload.email || '';
        const userName = payload.name  || payload['cognito:username'] || email.split('@')[0];

        // Show the page now auth is confirmed
        document.getElementById('auth-check').classList.add('d-none');
        document.getElementById('app').classList.remove('d-none');

        const userNameEl = document.getElementById('user-name');
        if (userNameEl) userNameEl.textContent = `Welcome, ${capitalise(userName)}`;

        setupLogout();
        initPage(payload.sub);
    });
}

function initPage(userId) {
    // Check if we've just arrived from a form submission
    currentJobId = sessionStorage.getItem('currentJobId');
    const jobMeta = sessionStorage.getItem('currentJobMeta');

    if (currentJobId) {
        showCurrentJobSection(currentJobId, jobMeta ? JSON.parse(jobMeta) : {});
        startPolling(currentJobId);
    }

    // Load all jobs for this user
    loadAllJobs(userId);
}

// ─── Current Job Progress ─────────────────────────────────────────────────────

function showCurrentJobSection(jobId, meta) {
    document.getElementById('current-job-section').classList.remove('d-none');

    // Populate meta line
    const metaEl = document.getElementById('current-job-meta');
    if (metaEl) {
        metaEl.innerHTML = buildMetaHtml(meta);
    }
}

/**
 * Poll DynamoDB every POLL_INTERVAL_MS until the job is COMPLETE or FAILED.
 */
function startPolling(jobId) {
    pollTimer = setInterval(async () => {
        try {
            const job = await fetchJob(jobId);
            updateCurrentJobUI(job);

            if (job.status === 'COMPLETE' || job.status === 'FAILED') {
                clearInterval(pollTimer);
                // Refresh the all-jobs list now there's a new completed entry
                const userId = sessionStorage.getItem('userId');
                if (userId) loadAllJobs(userId);
                // Clear the session flag so refreshing the page doesn't re-show
                sessionStorage.removeItem('currentJobId');
                sessionStorage.removeItem('currentJobMeta');
            }
        } catch (err) {
            console.error('Poll error:', err);
        }
    }, POLL_INTERVAL_MS);
}

function updateCurrentJobUI(job) {
    const badge      = document.getElementById('current-job-badge');
    const progressWrap = document.getElementById('current-job-progress-wrap');
    const statusMsg  = document.getElementById('current-job-status-msg');
    const downloadDiv = document.getElementById('current-job-download');
    const downloadBtn = document.getElementById('current-job-download-btn');
    const title      = document.getElementById('current-job-title');

    if (job.status === 'COMPLETE') {
        badge.textContent = 'Complete';
        badge.className   = 'badge rounded-pill badge-complete px-3 py-2';
        progressWrap.classList.add('d-none');
        downloadDiv.classList.remove('d-none');
        if (title) title.textContent = 'Narration ready!';

        // Request pre-signed download URL
        if (job.outputKey) {
            getDownloadUrl(job.outputKey).then(url => {
                if (url) downloadBtn.href = url;
            });
        }

    } else if (job.status === 'FAILED') {
        badge.textContent = 'Failed';
        badge.className   = 'badge rounded-pill badge-failed px-3 py-2';
        if (statusMsg) statusMsg.textContent = job.errorMessage || 'Processing failed. Please try again.';
        if (title) title.textContent = 'Job failed';

    } else {
        // Still processing
        if (statusMsg) statusMsg.textContent = 'Generating your audio narration with Amazon Polly...';
    }
}

// ─── All Jobs List ────────────────────────────────────────────────────────────

async function loadAllJobs(userId) {
    const loadingEl = document.getElementById('jobs-loading');
    const listEl    = document.getElementById('jobs-list');
    const emptyEl   = document.getElementById('jobs-empty');
    const errorEl   = document.getElementById('jobs-error');

    try {
        const jobs = await fetchAllJobs(userId);

        loadingEl.classList.add('d-none');

        if (!jobs || jobs.length === 0) {
            emptyEl.classList.remove('d-none');
            return;
        }

        // Sort newest first
        jobs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        listEl.innerHTML = '';
        for (const job of jobs) {
            listEl.appendChild(buildJobCard(job));
        }
        listEl.classList.remove('d-none');

    } catch (err) {
        console.error('Failed to load jobs:', err);
        loadingEl.classList.add('d-none');
        errorEl.textContent = 'Failed to load jobs. Please refresh the page.';
        errorEl.classList.remove('d-none');
    }
}

function buildJobCard(job) {
    const card = document.createElement('div');
    card.className = 'job-card';

    const statusBadge = buildStatusBadge(job.status);
    const metaHtml    = buildMetaHtml(job);
    const date        = job.createdAt ? new Date(job.createdAt).toLocaleString('en-GB') : 'Unknown date';

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
                <span class="fw-semibold">Job ${job.jobId ? job.jobId.slice(0, 8) : 'Unknown'}...</span>
                <div class="job-meta mt-1">${metaHtml}</div>
                <div class="job-meta mt-1"><span>&#128197; ${date}</span></div>
            </div>
            ${statusBadge}
        </div>
        <div class="download-section mt-2" id="download-${job.jobId}">
            ${job.status === 'COMPLETE' && job.outputKey
                ? `<button class="btn btn-sm btn-outline-primary"
                           onclick="handleDownload('${job.outputKey}', '${job.jobId}')">
                       &#8595; Download MP3
                   </button>`
                : ''}
            ${job.status === 'FAILED'
                ? `<small class="text-danger">${job.errorMessage || 'Processing failed'}</small>`
                : ''}
        </div>
    `;

    return card;
}

function buildStatusBadge(status) {
    const map = {
        COMPLETE:   ['badge-complete',   'Complete'],
        PROCESSING: ['badge-processing', 'Processing'],
        FAILED:     ['badge-failed',     'Failed'],
        PENDING:    ['badge-pending',    'Pending'],
    };
    const [cls, label] = map[status] || ['badge-pending', status || 'Unknown'];
    return `<span class="badge rounded-pill ${cls} px-3 py-2">${label}</span>`;
}

function buildMetaHtml(meta) {
    const parts = [];
    if (meta.voice)    parts.push(`&#127908; ${meta.voice}`);
    if (meta.category) parts.push(`&#128218; ${capitalise(meta.category)}`);
    if (meta.audio)    parts.push(`&#127925; ${formatAudioLabel(meta.audio)}`);
    return parts.map(p => `<span>${p}</span>`).join('');
}

function formatAudioLabel(audio) {
    const map = {
        'brown-noise':    'Brown Noise',
        'music':          'Music',
        'calming-sounds': 'Calming Sounds',
    };
    return map[audio] || capitalise(audio);
}

// ─── Download Handling ────────────────────────────────────────────────────────

async function handleDownload(outputKey, jobId) {
    const btn = document.querySelector(`#download-${jobId} button`);
    if (btn) { btn.disabled = true; btn.textContent = 'Getting link...'; }

    try {
        const url = await getDownloadUrl(outputKey);
        if (url) {
            window.open(url, '_blank');
        } else {
            alert('Could not generate download link. Please try again.');
        }
    } catch (err) {
        console.error('Download error:', err);
        alert('Could not generate download link. Please try again.');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '&#8595; Download MP3'; }
    }
}

/**
 * Call the API Gateway endpoint to get a pre-signed S3 URL for the given key.
 * The URL is valid for 15 minutes.
 */
async function getDownloadUrl(outputKey) {
    const response = await fetch(`${API_BASE_URL}/download-url?key=${encodeURIComponent(outputKey)}`, {
        headers: { 'Authorization': idToken },
    });

    if (!response.ok) throw new Error(`API returned ${response.status}`);

    const data = await response.json();
    return data.url || null;
}

// ─── API Calls ────────────────────────────────────────────────────────────────

/**
 * Fetch a single job record by ID from the jobs API.
 */
async function fetchJob(jobId) {
    const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
        headers: { 'Authorization': idToken },
    });
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    return response.json();
}

/**
 * Fetch all jobs for the current user from the jobs API.
 */
async function fetchAllJobs(userId) {
    const response = await fetch(`${API_BASE_URL}/jobs?userId=${encodeURIComponent(userId)}`, {
        headers: { 'Authorization': idToken },
    });
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    return response.json();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function setupLogout() {
    const btn = document.getElementById('logout-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
        if (!confirm('Are you sure you want to sign out?')) return;
        const cognitoUser = userPool.getCurrentUser();
        if (cognitoUser) cognitoUser.signOut();
        sessionStorage.clear();
        redirectToLogin();
    });
}

function redirectToLogin() {
    window.location.href = 'index.html';
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function capitalise(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}