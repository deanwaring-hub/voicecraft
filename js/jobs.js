/**
 * VoiceCraft — Jobs Page Script
 */

const API_BASE_URL    = AUTH_CONFIG.apiBaseUrl;
const POLL_INTERVAL_MS = 4000;

const userPool = new AmazonCognitoIdentity.CognitoUserPool({
    UserPoolId: AUTH_CONFIG.userPoolId,
    ClientId:   AUTH_CONFIG.clientId,
});

let currentJobId = null;
let pollTimer    = null;
let idToken      = null;

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    checkAuthAndInit();
});

function checkAuthAndInit() {
    const cognitoUser = userPool.getCurrentUser();
    if (!cognitoUser) { redirectToLogin(); return; }

    cognitoUser.getSession((err, session) => {
        if (err || !session.isValid()) { redirectToLogin(); return; }

        idToken = session.getIdToken().getJwtToken();

        const payload  = session.getIdToken().decodePayload();
        const email    = payload.email || '';
        const userName = payload.name || payload['cognito:username'] || email.split('@')[0];

        document.getElementById('auth-check').classList.add('d-none');
        document.getElementById('app').classList.remove('d-none');

        const userNameEl = document.getElementById('user-name');
        if (userNameEl) userNameEl.textContent = `Welcome, ${capitalise(userName)}`;

        setupLogout();
        initPage(payload.sub);
    });
}

function initPage(userId) {
    sessionStorage.setItem('userId', userId);

    currentJobId = sessionStorage.getItem('currentJobId');
    const jobMeta = sessionStorage.getItem('currentJobMeta');

    if (currentJobId) {
        showCurrentJobSection(currentJobId, jobMeta ? JSON.parse(jobMeta) : {});
        startPolling(currentJobId);
    }
    // If no currentJobId, current-job-section stays d-none (set in HTML)

    loadAllJobs(userId);
}

// ─── Current Job ──────────────────────────────────────────────────────────────

function showCurrentJobSection(jobId, meta) {
    document.getElementById('current-job-section').classList.remove('d-none');
    const metaEl = document.getElementById('current-job-meta');
    if (metaEl) metaEl.innerHTML = buildMetaHtml(meta);
}

async function startPolling(jobId) {
    // Check immediately — don't wait 4 seconds for first result
    const done = await pollOnce(jobId);
    if (done) return;

    pollTimer = setInterval(async () => {
        const finished = await pollOnce(jobId);
        if (finished) clearInterval(pollTimer);
    }, POLL_INTERVAL_MS);
}

async function pollOnce(jobId) {
    try {
        const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
            headers: { 'Authorization': idToken },
        });

        // Job not found (deleted or never existed) — clear and hide
        if (response.status === 404) {
            console.log('Current job not found in DB — clearing');
            sessionStorage.removeItem('currentJobId');
            sessionStorage.removeItem('currentJobMeta');
            document.getElementById('current-job-section').classList.add('d-none');
            return true;
        }

        if (!response.ok) throw new Error(`API ${response.status}`);

        const job = await response.json();
        console.log(`Job ${jobId} status: ${job.status}`);
        updateCurrentJobUI(job);

        if (job.status === 'COMPLETE' || job.status === 'FAILED') {
            // Reload the all-jobs list to include this job
            const userId = sessionStorage.getItem('userId');
            if (userId) loadAllJobs(userId);
            return true;
        }

        return false;
    } catch (err) {
        console.error('Poll error:', err);
        return false;
    }
}

function updateCurrentJobUI(job) {
    const badge        = document.getElementById('current-job-badge');
    const progressWrap = document.getElementById('current-job-progress-wrap');
    const downloadDiv  = document.getElementById('current-job-download');
    const downloadBtn  = document.getElementById('current-job-download-btn');
    const title        = document.getElementById('current-job-title');

    if (job.status === 'COMPLETE') {
        badge.textContent = 'Complete';
        badge.className   = 'badge rounded-pill badge-complete px-3 py-2';
        progressWrap.classList.add('d-none');
        downloadDiv.classList.remove('d-none');
        if (title) title.textContent = 'Narration ready!';

        if (job.outputKey) {
            getDownloadUrl(job.outputKey).then(url => {
                if (url) downloadBtn.href = url;
            }).catch(console.error);
        }

    } else if (job.status === 'FAILED') {
        badge.textContent = 'Failed';
        badge.className   = 'badge rounded-pill badge-failed px-3 py-2';
        progressWrap.classList.add('d-none');
        if (title) title.textContent = 'Job failed';
        const errMsg = document.createElement('p');
        errMsg.className   = 'text-danger small mt-2 mb-0';
        errMsg.textContent = job.errorMessage || 'Processing failed. Please try again.';
        progressWrap.parentNode.appendChild(errMsg);
    }
    // PROCESSING/PENDING: leave the animated bar as-is
}

// ─── All Jobs List ────────────────────────────────────────────────────────────

async function loadAllJobs(userId) {
    const loadingEl = document.getElementById('jobs-loading');
    const listEl    = document.getElementById('jobs-list');
    const emptyEl   = document.getElementById('jobs-empty');
    const errorEl   = document.getElementById('jobs-error');

    // Reset state
    listEl.classList.add('d-none');
    emptyEl.classList.add('d-none');
    errorEl.classList.add('d-none');
    loadingEl.classList.remove('d-none');

    try {
        const response = await fetch(`${API_BASE_URL}/jobs?userId=${encodeURIComponent(userId)}`, {
            headers: { 'Authorization': idToken },
        });
        if (!response.ok) throw new Error(`API ${response.status}`);
        const jobs = await response.json();

        loadingEl.classList.add('d-none');

        if (!jobs || jobs.length === 0) {
            emptyEl.classList.remove('d-none');
            return;
        }

        jobs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        listEl.innerHTML = '';
        for (const job of jobs) listEl.appendChild(buildJobCard(job));
        listEl.classList.remove('d-none');

    } catch (err) {
        console.error('Failed to load jobs:', err);
        loadingEl.classList.add('d-none');
        errorEl.textContent = 'Failed to load jobs. Please refresh the page.';
        errorEl.classList.remove('d-none');
    }
}

function buildJobCard(job) {
    const card  = document.createElement('div');
    card.className = 'job-card';
    card.id = `job-card-${job.jobId}`;

    const date = job.createdAt ? new Date(job.createdAt).toLocaleString('en-GB') : 'Unknown date';

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
                <span class="fw-semibold">Job ${(job.jobId || '').slice(0, 8)}...</span>
                <div class="job-meta mt-1">${buildMetaHtml(job)}</div>
                <div class="job-meta mt-1"><span>&#128197; ${date}</span></div>
            </div>
            ${buildStatusBadge(job.status)}
        </div>
        <div class="d-flex align-items-center gap-2 mt-2" id="download-${job.jobId}">
            ${job.status === 'COMPLETE' && job.outputKey
                ? `<button class="btn btn-sm btn-outline-primary"
                           onclick="handleDownload('${job.outputKey}', '${job.jobId}')">
                       &#8595; Download MP3
                   </button>`
                : ''}
            ${job.status === 'FAILED'
                ? `<small class="text-danger">${job.errorMessage || 'Processing failed'}</small>`
                : ''}
            <button class="btn btn-sm btn-outline-danger ms-auto"
                    onclick="handleDeleteJob('${job.jobId}')">
                &#128465; Delete
            </button>
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
    return { 'brown-noise': 'Brown Noise', 'music': 'Music', 'calming-sounds': 'Calming Sounds' }[audio] || capitalise(audio || '');
}

// ─── Download ─────────────────────────────────────────────────────────────────

async function handleDownload(outputKey, jobId) {
    const btn = document.querySelector(`#download-${jobId} button`);
    if (btn) { btn.disabled = true; btn.textContent = 'Getting link...'; }
    try {
        const url = await getDownloadUrl(outputKey);
        if (url) window.open(url, '_blank');
        else alert('Could not generate download link. Please try again.');
    } catch (err) {
        console.error('Download error:', err);
        alert('Could not generate download link. Please try again.');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '&#8595; Download MP3'; }
    }
}

async function getDownloadUrl(outputKey) {
    const response = await fetch(`${API_BASE_URL}/download-url?key=${encodeURIComponent(outputKey)}`, {
        headers: { 'Authorization': idToken },
    });
    if (!response.ok) throw new Error(`API ${response.status}`);
    const data = await response.json();
    return data.url || null;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

async function handleDeleteJob(jobId) {
    if (!confirm('Delete this job? This cannot be undone.')) return;

    const card = document.getElementById(`job-card-${jobId}`);
    if (card) card.style.opacity = '0.5';

    try {
        const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
            method:  'DELETE',
            headers: { 'Authorization': idToken },
        });

        if (response.ok) {
            if (card) card.remove();
            const listEl = document.getElementById('jobs-list');
            if (listEl && listEl.children.length === 0) {
                listEl.classList.add('d-none');
                document.getElementById('jobs-empty').classList.remove('d-none');
            }
        } else {
            if (card) card.style.opacity = '1';
            alert('Failed to delete job. Please try again.');
        }
    } catch (err) {
        console.error('Delete error:', err);
        if (card) card.style.opacity = '1';
        alert('Failed to delete job. Please try again.');
    }
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

function redirectToLogin() { window.location.href = 'index.html'; }

// ─── Utilities ────────────────────────────────────────────────────────────────

function capitalise(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}