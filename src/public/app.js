import { mergeRules, familyLabel, groupCounts, filterRecent, portName } from './logic.js';

const $ = (id) => document.getElementById(id);

const state = {
    status: null,
    error: null,
    rules: [],
    logs: { byPort: {}, byIp: {}, recent: [], total: 0 },
    myIp: null,
    filterIp: null,
    lines: Number(localStorage.getItem('logLines')) || 1000
};

const STATUS = {
    active: ['active', 'Active'],
    inactive: ['inactive', 'Inactive'],
    not_installed: ['warn', 'Not installed'],
    permission_denied: ['warn', 'No permission'],
    error: ['warn', 'Error']
};

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

/* API */

async function api(path, options = {}) {
    const response = await fetch(path, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
    });

    if (response.status === 401) {
        location.href = '/login';
        throw new Error('Session expired');
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || data.details?.join(', ') || `Request failed (${response.status})`);
    }
    return data;
}

async function mutate(path, method = 'POST', body) {
    const { token } = await api('/api/csrf-token');
    return api(path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        headers: { 'X-CSRF-Token': token }
    });
}

/* Rendering */

function render() {
    renderStatus();
    renderBanner();
    renderStats();
    renderRules();
    renderActivity();
}

function renderStatus() {
    const pill = $('statusPill');
    const [tone, label] = STATUS[state.status] || ['', 'Loading…'];
    pill.dataset.state = tone;
    pill.textContent = label;

    const toggle = $('fwToggle');
    toggle.disabled = !(state.status === 'active' || state.status === 'inactive');
    toggle.checked = state.status === 'active';
}

function renderBanner() {
    const banner = $('banner');
    const icon = '<svg class="banner-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 20h20L12 3Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 9v5m0 3v.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

    const variants = {
        inactive: {
            kind: 'danger',
            title: 'Firewall is off',
            text: 'All inbound traffic is allowed. Enable UFW to start enforcing your rules.',
            action: '<button class="btn" type="button" data-action="enable">Enable</button>'
        },
        not_installed: {
            kind: 'warn',
            title: 'UFW is not installed',
            text: 'Install it on the host, then retry: <code>sudo apt install ufw</code>',
            action: '<button class="btn" type="button" data-action="retry">Retry</button>'
        },
        permission_denied: {
            kind: 'warn',
            title: 'Permission denied',
            text: 'The server cannot run ufw. Run it as root, or give the container NET_ADMIN.',
            action: '<button class="btn" type="button" data-action="retry">Retry</button>'
        },
        error: {
            kind: 'danger',
            title: 'Could not read firewall status',
            text: escapeHtml(state.error || 'Unknown error'),
            action: '<button class="btn" type="button" data-action="retry">Retry</button>'
        }
    };

    const variant = variants[state.status];
    banner.hidden = !variant;
    if (!variant) return;

    banner.dataset.kind = variant.kind;
    banner.innerHTML = `
        ${icon}
        <div class="banner-body">
            <p class="banner-title">${variant.title}</p>
            <p class="banner-text">${variant.text}</p>
        </div>
        <div class="banner-actions">${variant.action}</div>`;
}

function renderStats() {
    const groups = mergeRules(state.rules);
    const openPorts = groups.filter((group) => group.action === 'ALLOW IN').length;
    const sourceIps = Object.keys(state.logs.byIp).length;

    $('statPorts').textContent = openPorts;
    $('statBlocked').textContent = state.logs.total.toLocaleString('en-US');
    $('statIps').textContent = sourceIps;
    $('statBlockedNote').textContent = `last ${state.lines.toLocaleString('en-US')} log lines`;
}

function renderRules() {
    const groups = mergeRules(state.rules);
    const body = $('rulesBody');

    if (groups.length === 0) {
        body.innerHTML = '<tr><td colspan="6" class="empty">No rules yet. Add a port above to allow it.</td></tr>';
        return;
    }

    body.innerHTML = groups.map((group) => {
        const target = group.proto === 'any' ? group.port : `${group.port}/${group.proto}`;
        const source = group.from && group.from !== 'Anywhere'
            ? `<div class="muted">from ${escapeHtml(group.from)}</div>`
            : '';

        return `<tr>
            <td class="mono">${escapeHtml(group.port)}${source}</td>
            <td class="muted hide-sm">${escapeHtml(portName(group.port) || '—')}</td>
            <td><span class="tag ${group.action.startsWith('ALLOW') ? 'allow' : 'deny'}">${escapeHtml(group.action)}</span></td>
            <td class="muted hide-sm">${escapeHtml(group.proto)}</td>
            <td class="muted hide-sm">${familyLabel(group)}</td>
            <td class="row-actions">
                <button class="btn small danger" type="button" data-ids="${escapeHtml(group.ids.join(','))}" data-target="${escapeHtml(target)}">Remove</button>
            </td>
        </tr>`;
    }).join('');
}

function renderActivity() {
    renderTopPorts();
    renderTopIps();
    renderFilterChip();
    renderRecent();
}

function renderTopPorts() {
    const entries = groupCounts(state.logs.byPort, 5);
    const list = $('topPorts');

    if (entries.length === 0) {
        list.innerHTML = '<li class="empty">No blocked attempts</li>';
        return;
    }

    const max = entries[0].count;
    list.innerHTML = entries.map(({ key, count }) => `<li class="list-item">
        <span class="list-label">
            <span class="mono">${escapeHtml(key)}</span>
            <span class="muted">${escapeHtml(portName(key))}</span>
        </span>
        <span class="list-count">${count.toLocaleString('en-US')}</span>
        <span class="bar"><span style="width:${Math.max(4, Math.round((count / max) * 100))}%"></span></span>
    </li>`).join('');
}

function renderTopIps() {
    const entries = groupCounts(state.logs.byIp, 5);
    const list = $('topIps');

    if (entries.length === 0) {
        list.innerHTML = '<li class="empty">No blocked attempts</li>';
        return;
    }

    const max = entries[0].count;
    list.innerHTML = entries.map(({ key, count }) => `<li>
        <button class="list-item" type="button" data-ip="${escapeHtml(key)}" aria-pressed="${state.filterIp === key}">
            <span class="list-label"><span class="mono">${escapeHtml(key)}</span></span>
            <span class="list-count">${count.toLocaleString('en-US')}</span>
            <span class="bar"><span style="width:${Math.max(4, Math.round((count / max) * 100))}%"></span></span>
        </button>
    </li>`).join('');
}

function renderFilterChip() {
    const chip = $('filterChip');
    chip.hidden = !state.filterIp;
    if (!state.filterIp) return;

    chip.innerHTML = `
        <span>Source <span class="mono">${escapeHtml(state.filterIp)}</span></span>
        <button type="button" data-clear-filter aria-label="Clear source filter">×</button>`;
}

function renderRecent() {
    const entries = filterRecent(state.logs.recent, state.filterIp);
    const body = $('recentBody');

    if (entries.length === 0) {
        body.innerHTML = `<tr><td colspan="4" class="empty">${state.filterIp ? 'No attempts from this address in the selected range.' : 'No blocked attempts in the selected range.'}</td></tr>`;
        return;
    }

    body.innerHTML = entries.map((entry) => `<tr>
        <td class="mono muted">${escapeHtml(entry.time)}</td>
        <td class="mono">${escapeHtml(entry.src)}${entry.src === state.myIp ? ' <span class="tag">you</span>' : ''}</td>
        <td class="mono">${escapeHtml(entry.port)}</td>
        <td><span class="tag">${escapeHtml(entry.proto)}</span></td>
    </tr>`).join('');
}

/* Data */

async function load() {
    const [rules, logs, who] = await Promise.all([
        api('/api/rules'),
        api(`/api/logs?lines=${state.lines}`),
        api('/api/whoami')
    ]);

    state.status = rules.status;
    state.error = rules.error || null;
    state.rules = rules.rules || [];
    state.logs = logs;
    state.myIp = who.ip;
    render();
}

async function refreshLogs() {
    state.logs = await api(`/api/logs?lines=${state.lines}`);
    renderStats();
    renderActivity();
}

/* Confirm dialog */

function confirmAction({ title, body, label, danger = false }) {
    return new Promise((resolve) => {
        const dialog = $('confirmDialog');
        const ok = $('confirmOk');

        $('confirmTitle').textContent = title;
        $('confirmBody').textContent = body;
        ok.textContent = label;
        ok.className = `btn ${danger ? 'danger' : 'primary'}`;

        ok.onclick = () => dialog.close('confirm');
        $('confirmCancel').onclick = () => dialog.close('cancel');

        // Also resolves on Escape, which closes the dialog without a value
        const onClose = () => {
            dialog.removeEventListener('close', onClose);
            resolve(dialog.returnValue === 'confirm');
        };
        dialog.addEventListener('close', onClose);

        dialog.returnValue = '';
        dialog.showModal();
    });
}

/* Actions */

async function addRule(port) {
    await mutate('/api/rules', 'POST', { port, protocol: 'both', type: 'allow' });
    toast('Rule added');
    await load();
}

async function removeRule(ids, target) {
    const confirmed = await confirmAction({
        title: `Remove ${target}?`,
        body: ids.length > 1
            ? `This deletes ${ids.length} rules (IPv4 and IPv6).`
            : 'This rule will be deleted immediately.',
        label: 'Remove',
        danger: true
    });
    if (!confirmed) return;

    // Delete highest id first: ufw renumbers the remaining rules after each delete.
    const ordered = [...ids].map(Number).sort((a, b) => b - a);
    for (const id of ordered) {
        await mutate(`/api/rules/${id}`, 'DELETE');
    }
    toast('Rule removed');
    await load();
}

async function setFirewall(enabled) {
    const toggle = $('fwToggle');

    if (!enabled) {
        const confirmed = await confirmAction({
            title: 'Disable the firewall?',
            body: 'All inbound traffic will be allowed until you enable it again.',
            label: 'Disable',
            danger: true
        });
        if (!confirmed) {
            toggle.checked = true;
            return;
        }
    }

    toggle.disabled = true;
    try {
        await mutate(`/api/rules/${enabled ? 'enable' : 'disable'}`);
        toast(enabled ? 'Firewall enabled' : 'Firewall disabled');
        await load();
    } catch (error) {
        toggle.checked = !enabled;
        toast(error.message, 'error');
    } finally {
        toggle.disabled = !['active', 'inactive'].includes(state.status);
    }
}

/* Toast */

let toastTimer;

function toast(message, kind = 'info') {
    const element = $('toast');
    element.textContent = message;
    element.dataset.kind = kind;
    element.classList.add('show');

    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('show'), 3200);
}

/* Wiring */

$('addForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = $('portInput');
    const port = input.value.trim();
    if (!port) return;

    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    try {
        await addRule(port);
        input.value = '';
    } catch (error) {
        toast(error.message, 'error');
    } finally {
        button.disabled = false;
    }
});

$('rulesBody').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-ids]');
    if (!button) return;

    button.disabled = true;
    try {
        await removeRule(button.dataset.ids.split(','), button.dataset.target);
    } catch (error) {
        toast(error.message, 'error');
    } finally {
        button.disabled = false;
    }
});

$('fwToggle').addEventListener('change', (event) => setFirewall(event.target.checked));

$('banner').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    if (button.dataset.action === 'enable') {
        button.disabled = true;
        try {
            await setFirewall(true);
        } catch (error) {
            toast(error.message, 'error');
        } finally {
            button.disabled = false;
        }
        return;
    }

    button.disabled = true;
    try {
        await load();
    } catch (error) {
        state.status = 'error';
        state.error = error.message;
        render();
        toast(error.message, 'error');
    } finally {
        button.disabled = false;
    }
});

$('refreshBtn').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
        await load();
    } catch (error) {
        toast(error.message, 'error');
    } finally {
        button.disabled = false;
    }
});

$('linesSelect').addEventListener('change', async (event) => {
    state.lines = Number(event.target.value);
    localStorage.setItem('logLines', String(state.lines));
    try {
        await refreshLogs();
    } catch (error) {
        toast(error.message, 'error');
    }
});

$('topIps').addEventListener('click', (event) => {
    const button = event.target.closest('[data-ip]');
    if (!button) return;

    state.filterIp = state.filterIp === button.dataset.ip ? null : button.dataset.ip;
    renderActivity();
});

$('filterChip').addEventListener('click', (event) => {
    if (!event.target.closest('[data-clear-filter]')) return;
    state.filterIp = null;
    renderActivity();
});

$('logoutBtn').addEventListener('click', async () => {
    try {
        await mutate('/logout');
    } finally {
        location.href = '/login';
    }
});

/* Init */

$('linesSelect').value = String(state.lines);

load().catch((error) => {
    state.status = 'error';
    state.error = error.message;
    render();
});
