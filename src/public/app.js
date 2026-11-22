import {
    mergeRules,
    sortRules,
    familyLabel,
    groupCounts,
    filterRecent,
    portName,
    protocolLabel,
    donutSlices,
    protocolStats,
    serviceCategories,
    distinctServices,
    countsForIp,
    areaPath
} from './logic.js';

const $ = (id) => document.getElementById(id);

const TABS = ['overview', 'rules', 'activity', 'settings'];
const RANK_LIMIT = 8;
const SLICE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
const OTHER_COLOR = 'var(--faint)';
const PROTO_COLORS = { TCP: 'var(--chart-1)', UDP: 'var(--chart-2)' };
const PROTO_FALLBACK = 'var(--chart-4)';

const state = {
    status: null,
    error: null,
    rules: [],
    logs: { byPort: {}, byProto: {}, byIp: {}, ipPorts: {}, recent: [], series: [], total: 0 },
    myIp: null,
    filterIp: null,
    lines: Number(localStorage.getItem('logLines') || localStorage.getItem('logMaxLines')) || 1000,
    tab: 'overview',
    showAllPorts: false,
    showAllIps: false,
    sort: { key: 'port', direction: 'asc' }
};

const STATUS = {
    active: ['active', 'Active'],
    inactive: ['inactive', 'Inactive'],
    not_installed: ['warn', 'Not installed'],
    permission_denied: ['warn', 'No permission'],
    error: ['warn', 'Error']
};

const format = (value) => Number(value).toLocaleString('en-US');

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

const sliceColor = (slice, index) =>
    (slice.key === 'Other' ? OTHER_COLOR : SLICE_COLORS[index % SLICE_COLORS.length]);

const protoColor = (name) => PROTO_COLORS[name] || PROTO_FALLBACK;

/* Tabs */

const tabButtons = [...document.querySelectorAll('[role="tab"]')];
const panels = [...document.querySelectorAll('[role="tabpanel"]')];
const indicator = document.querySelector('.tab-indicator');

function moveIndicator() {
    const active = tabButtons.find((button) => button.dataset.tab === state.tab);
    if (!active || !indicator) return;

    const tabs = active.closest('.tabs').getBoundingClientRect();
    const rect = active.getBoundingClientRect();
    indicator.style.width = `${rect.width}px`;
    indicator.style.transform = `translateX(${rect.left - tabs.left - active.closest('.tabs').clientLeft}px)`;
}

function setTab(name, { focus = false } = {}) {
    if (!TABS.includes(name)) name = 'overview';
    state.tab = name;

    for (const button of tabButtons) {
        const active = button.dataset.tab === name;
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
        if (active && focus) button.focus();
    }

    for (const panel of panels) panel.hidden = panel.id !== `panel-${name}`;

    history.replaceState(null, '', `#${name}`);
    moveIndicator();
}

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
    renderOverview();
    renderRules();
    renderActivity();
    renderSettings();
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

function renderOverview() {
    const groups = mergeRules(state.rules);
    const openPorts = groups.filter((group) => group.action.startsWith('ALLOW')).length;
    const sourceIps = Object.keys(state.logs.byIp).length;
    const targetedPorts = Object.keys(state.logs.byPort).length;

    $('statPorts').textContent = format(openPorts);
    $('statBlocked').textContent = format(state.logs.total);
    $('statIps').textContent = format(sourceIps);
    $('statTargets').textContent = format(targetedPorts);

    $('statBlockedNote').textContent = `last ${format(state.lines)} log lines`;

    renderDonut();
    renderProtocols();
    renderSources();
    renderCategories();
    renderTraffic();
    renderSpark();
}

function renderTraffic() {
    const host = $('trafficChart');
    const series = state.logs.series || [];
    const total = series.reduce((sum, point) => sum + point.count, 0);

    $('trafficMeta').textContent = series.length ? `${format(total)} attempts` : 'no data';

    if (series.length === 0) {
        host.innerHTML = '<p class="empty">No blocked attempts in range.</p>';
        return;
    }

    const width = 720;
    const height = 150;
    const { line, area } = areaPath(series.map((point) => point.count), width, height);
    const step = series.length > 1 ? width / (series.length - 1) : width;

    const grid = [0.25, 0.5, 0.75].map((ratio) =>
        `<line class="chart-grid" x1="0" y1="${(height * ratio).toFixed(1)}" x2="${width}" y2="${(height * ratio).toFixed(1)}"/>`
    ).join('');

    // Native <title> tooltips on hover columns: no JS crosshair to maintain
    const hits = series.map((point, index) =>
        `<rect class="chart-hit" x="${(index * step - step / 2).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${height}" fill="transparent"><title>${escapeHtml(point.t)} · ${format(point.count)} blocked</title></rect>`
    ).join('');

    host.innerHTML = `<svg viewBox="0 0 ${width} ${height + 18}" role="img" aria-label="Blocked attempts by log order">
        <defs>
            <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--chart-1)" stop-opacity="0.35"/>
                <stop offset="100%" stop-color="var(--chart-1)" stop-opacity="0"/>
            </linearGradient>
        </defs>
        ${grid}
        <path class="chart-area" d="${area}"/>
        <path class="chart-line" d="${line}"/>
        ${hits}
        <text class="chart-axis" x="0" y="${height + 14}">${escapeHtml(series[0].t)}</text>
        <text class="chart-axis" x="${width}" y="${height + 14}" text-anchor="end">${escapeHtml(series[series.length - 1].t)}</text>
    </svg>`;
}

function renderSpark() {
    const spark = $('blockedSpark');
    const values = (state.logs.series || []).map((point) => point.count);

    if (values.length < 2) {
        spark.innerHTML = '';
        return;
    }

    const { line, area } = areaPath(values, 120, 32);
    spark.setAttribute('viewBox', '0 0 120 32');
    spark.innerHTML = `<defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--chart-1)" stop-opacity="0.4"/>
            <stop offset="100%" stop-color="var(--chart-1)" stop-opacity="0"/>
        </linearGradient>
    </defs>
    <path d="${area}" fill="url(#sparkFill)"/>
    <path d="${line}" class="chart-line"/>`;
}

function renderDonut() {
    const donut = $('donut');
    const legend = $('donutLegend');
    const { total, slices } = donutSlices(state.logs.byPort, 5);

    $('donutMeta').textContent = `${Object.keys(state.logs.byPort).length} ports`;

    if (total === 0) {
        donut.innerHTML = '<p class="empty">No blocked attempts in range.</p>';
        legend.innerHTML = '';
        return;
    }

    const circumference = 2 * Math.PI * 50;
    let offset = 0;

    const circles = slices.map((slice, index) => {
        const length = Math.max((slice.percent / 100) * circumference - 2.5, 0.5);
        const circle = `<circle cx="60" cy="60" r="50" fill="none" stroke="${sliceColor(slice, index)}" stroke-width="12"
            stroke-dasharray="${length.toFixed(2)} ${(circumference - length).toFixed(2)}"
            stroke-dashoffset="${(-offset).toFixed(2)}"><title>${escapeHtml(slice.key)}: ${format(slice.count)} (${Math.round(slice.percent)}%)</title></circle>`;
        offset += (slice.percent / 100) * circumference;
        return circle;
    }).join('');

    const label = `Blocked attempts by targeted port: ${slices
        .map((slice) => `${slice.key} ${Math.round(slice.percent)}%`)
        .join(', ')}`;

    donut.innerHTML = `<svg viewBox="0 0 120 120" role="img" aria-label="${escapeHtml(label)}">
        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--surface-3)" stroke-width="12"/>
        <g transform="rotate(-90 60 60)">${circles}</g>
        <text class="donut-total" x="60" y="58" text-anchor="middle" dominant-baseline="middle">${format(total)}</text>
        <text class="donut-caption" x="60" y="73" text-anchor="middle">blocked</text>
    </svg>`;

    legend.innerHTML = slices.map((slice, index) => {
        const other = slice.key === 'Other';
        const name = other ? 'remaining ports' : (portName(slice.key) || 'unknown service');
        return `<li>
            <span class="legend-dot" style="background:${sliceColor(slice, index)}"></span>
            <span class="legend-label"><strong class="mono">${escapeHtml(slice.key)}</strong><span>${escapeHtml(name)}</span></span>
            <span class="legend-count">${format(slice.count)}</span>
            <span class="legend-percent">${Math.round(slice.percent)}%</span>
        </li>`;
    }).join('');
}

function renderProtocols() {
    const stats = protocolStats(state.logs.byProto);
    const stack = $('protoStack');
    const legend = $('protoLegend');
    const total = stats.reduce((sum, entry) => sum + entry.count, 0);

    $('protoMeta').textContent = `${format(total)} attempts`;

    if (stats.length === 0) {
        stack.innerHTML = '';
        legend.innerHTML = '<li class="empty">No protocol data in range.</li>';
        return;
    }

    stack.innerHTML = stats.map((entry) =>
        `<span style="width:${entry.percent}%;background:${protoColor(entry.name)}" title="${escapeHtml(entry.name)}: ${format(entry.count)} (${entry.percent}%)"></span>`
    ).join('');

    legend.innerHTML = stats.map((entry) => `<li>
        <span class="legend-dot" style="background:${protoColor(entry.name)}"></span>
        <span class="legend-label"><strong>${escapeHtml(entry.name)}</strong></span>
        <span class="legend-count">${format(entry.count)}</span>
        <span class="legend-percent">${entry.percent}%</span>
    </li>`).join('');
}

function renderSources() {
    const entries = groupCounts(state.logs.byIp, 5);
    const list = $('topSources');

    if (entries.length === 0) {
        list.innerHTML = '<li class="empty">No external sources in range.</li>';
        return;
    }

    const max = entries[0].count;
    list.innerHTML = entries.map(({ key, count }) => `<li>
        <button class="rank" type="button" data-ip="${escapeHtml(key)}">
            <span class="rank-label"><strong class="mono">${escapeHtml(key)}</strong></span>
            <span class="rank-count">${format(count)}</span>
            <span class="rank-bar"><span style="--w:${Math.max(4, Math.round((count / max) * 100))}%"></span></span>
        </button>
    </li>`).join('');
}

function renderCategories() {
    const entries = serviceCategories(state.logs.byPort);
    const list = $('categories');

    $('categoriesMeta').textContent = `${entries.length} groups`;

    if (entries.length === 0) {
        list.innerHTML = '<li class="empty">No blocked attempts in range.</li>';
        return;
    }

    list.innerHTML = entries.map((entry) => `<li>
        <div class="rank category">
            <span class="rank-label"><strong>${escapeHtml(entry.name)}</strong></span>
            <span class="rank-count">${format(entry.count)} · ${entry.percent}%</span>
            <span class="rank-bar"><span style="--w:${Math.max(4, entry.percent)}%"></span></span>
        </div>
    </li>`).join('');
}

function renderSortHeaders() {
    for (const header of document.querySelectorAll('#panel-rules th[data-sort]')) {
        const active = header.dataset.sort === state.sort.key;
        header.setAttribute('aria-sort', active
            ? (state.sort.direction === 'asc' ? 'ascending' : 'descending')
            : 'none');

        const arrow = header.querySelector('.sort-arrow');
        if (arrow) arrow.textContent = active ? (state.sort.direction === 'asc' ? '▲' : '▼') : '';
    }
}

function renderRules() {
    const groups = sortRules(mergeRules(state.rules), state.sort.key, state.sort.direction);
    const open = groups.filter((group) => group.action.startsWith('ALLOW')).length;
    const v6 = groups.filter((group) => group.v6).length;

    renderSortHeaders();

    $('miniPorts').textContent = format(open);
    $('miniV6').textContent = format(v6);
    $('miniServices').textContent = format(distinctServices(groups));
    $('rulesMeta').textContent = `${groups.length} ${groups.length === 1 ? 'rule' : 'rules'}`;

    const body = $('rulesBody');

    if (groups.length === 0) {
        body.innerHTML = '<tr><td colspan="6" class="empty">No rules yet. Add a port above to allow it.</td></tr>';
        return;
    }

    body.innerHTML = groups.map((group) => {
        const target = `${group.port}${group.proto === 'any' ? '' : `/${group.proto}`}${group.from && group.from !== 'Anywhere' ? ` from ${group.from}` : ''}`;
        const source = group.from && group.from !== 'Anywhere'
            ? `<div class="muted">from ${escapeHtml(group.from)}</div>`
            : '';

        return `<tr>
            <td class="mono">${escapeHtml(group.port)}${source}</td>
            <td class="muted hide-sm">${escapeHtml(portName(group.port) || '—')}</td>
            <td><span class="tag ${group.action.startsWith('ALLOW') ? 'allow' : 'deny'}">${escapeHtml(group.action)}</span></td>
            <td class="muted hide-sm">${escapeHtml(protocolLabel(group.proto))}</td>
            <td class="muted hide-sm">${familyLabel(group)}</td>
            <td class="row-actions">
                <button class="btn small danger" type="button" data-ids="${escapeHtml(group.ids.join(','))}" data-target="${escapeHtml(target)}">Remove</button>
            </td>
        </tr>`;
    }).join('');
}

function renderActivity() {
    const counts = countsForIp(state.logs, state.filterIp);
    const portEntries = groupCounts(counts, state.showAllPorts ? Infinity : RANK_LIMIT);
    const ipEntries = groupCounts(state.logs.byIp, state.showAllIps ? Infinity : RANK_LIMIT);

    $('activityRange').textContent = format(state.lines);

    $('portsMeta').textContent = state.filterIp ? `from ${state.filterIp}` : 'all sources';
    renderPortChart(portEntries);
    renderMore('portsMore', Object.keys(counts).length, state.showAllPorts, 'port');

    $('ipsMeta').textContent = `${Object.keys(state.logs.byIp).length} sources`;
    const ipList = $('topIps');
    if (ipEntries.length === 0) {
        ipList.innerHTML = '<li class="empty">No external sources in range.</li>';
    } else {
        const max = ipEntries[0].count;
        ipList.innerHTML = ipEntries.map(({ key, count }) => `<li>
            <button class="rank" type="button" data-ip="${escapeHtml(key)}" aria-pressed="${state.filterIp === key}">
                <span class="rank-label"><strong class="mono">${escapeHtml(key)}</strong></span>
                <span class="rank-count">${format(count)}</span>
                <span class="rank-bar"><span style="--w:${Math.max(4, Math.round((count / max) * 100))}%"></span></span>
            </button>
        </li>`).join('');
    }
    renderMore('ipsMore', Object.keys(state.logs.byIp).length, state.showAllIps, 'source');

    renderFilterChip();
    renderRecent();
}

function renderPortChart(entries) {
    const host = $('topPorts');

    if (entries.length === 0) {
        host.innerHTML = '<p class="empty">No blocked attempts in range.</p>';
        return;
    }

    const width = 560;
    const rowHeight = 34;
    const barX = 132;
    const barWidth = width - barX - 60;
    const max = entries[0].count;

    const rows = entries.map((entry, index) => {
        const y = index * rowHeight;
        const value = Math.max(3, Math.round((entry.count / max) * barWidth));
        return `<g>
            <text class="bar-label" x="0" y="${y + 13}">${escapeHtml(entry.key)}</text>
            <text class="bar-sub" x="0" y="${y + 26}">${escapeHtml(portName(entry.key) || 'unknown service')}</text>
            <rect class="bar-track" x="${barX}" y="${y + 8}" width="${barWidth}" height="10" rx="5"/>
            <rect class="bar-fill" x="${barX}" y="${y + 8}" width="${value}" height="10" rx="5"><title>${escapeHtml(entry.key)} · ${format(entry.count)} blocked</title></rect>
            <text class="bar-value" x="${width}" y="${y + 16}" text-anchor="end">${format(entry.count)}</text>
        </g>`;
    }).join('');

    host.innerHTML = `<svg viewBox="0 0 ${width} ${entries.length * rowHeight}" class="bars" role="img" aria-label="Top targeted ports">${rows}</svg>`;
}

function renderMore(id, total, expanded, noun) {
    const button = $(id);
    button.hidden = total <= RANK_LIMIT;
    button.setAttribute('aria-expanded', String(expanded));
    button.textContent = expanded ? `Show top ${RANK_LIMIT}` : `Show all ${total} ${noun}s`;
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

    $('recentMeta').textContent = state.filterIp ? `filtered · ${entries.length} of 15` : 'last 15';

    if (entries.length === 0) {
        body.innerHTML = `<tr><td colspan="4" class="empty">${state.filterIp ? 'No attempts from this address in the selected range.' : 'No blocked attempts in the selected range.'}</td></tr>`;
        return;
    }

    body.innerHTML = entries.map((entry) => `<tr>
        <td class="mono muted hide-sm">${escapeHtml(entry.time)}</td>
        <td class="mono">${escapeHtml(entry.src)}${entry.src === state.myIp ? ' <span class="tag you">you</span>' : ''}</td>
        <td class="mono">${escapeHtml(entry.port)}</td>
        <td><span class="tag">${escapeHtml(entry.protocol || entry.proto)}</span></td>
    </tr>`).join('');
}

function renderSettings() {
    const groups = mergeRules(state.rules);

    if (document.activeElement !== $('linesInput')) {
        $('linesInput').value = String(state.lines);
    }
    $('linesNote').textContent = `Analyzing the last ${format(state.lines)} lines · server reads up to 50,000.`;

    $('sysStatus').textContent = (STATUS[state.status] || ['', 'Unknown'])[1];
    $('sysRules').textContent = format(groups.filter((group) => group.action.startsWith('ALLOW')).length);
    $('sysBlocked').textContent = format(state.logs.total);
    $('sysIps').textContent = format(Object.keys(state.logs.byIp).length);
    $('sysMyIp').textContent = state.myIp || '—';
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
    renderOverview();
    renderActivity();
    renderSettings();
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

async function addRule(port, protocol, type) {
    if (type === 'deny') {
        const confirmed = await confirmAction({
            title: `Deny port ${port}?`,
            body: 'Deny rules can lock you out of services you rely on, including SSH. Make sure you keep another way in.',
            label: 'Add deny rule',
            danger: true
        });
        if (!confirmed) return false;
    }

    await mutate('/api/rules', 'POST', { port, protocol, type });
    toast(type === 'deny' ? 'Deny rule added' : 'Rule added');
    await load();
    return true;
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

function selectIp(ip) {
    state.filterIp = state.filterIp === ip ? null : ip;
    state.showAllPorts = false;
    state.showAllIps = false;
    renderActivity();
    if (state.tab !== 'activity') setTab('activity');
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

for (const button of tabButtons) {
    button.addEventListener('click', () => setTab(button.dataset.tab));
}

document.querySelector('.tabs').addEventListener('keydown', (event) => {
    const index = TABS.indexOf(state.tab);
    let next = null;

    if (event.key === 'ArrowRight') next = TABS[(index + 1) % TABS.length];
    if (event.key === 'ArrowLeft') next = TABS[(index - 1 + TABS.length) % TABS.length];
    if (event.key === 'Home') next = TABS[0];
    if (event.key === 'End') next = TABS[TABS.length - 1];
    if (!next) return;

    event.preventDefault();
    setTab(next, { focus: true });
});

$('addForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = $('portInput');
    const port = input.value.trim();
    const protocol = $('protoInput').value;
    const type = $('typeInput').value;
    if (!port) return;

    const button = $('addBtn');
    button.disabled = true;
    try {
        if (await addRule(port, protocol, type)) input.value = '';
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

document.querySelector('#panel-rules thead').addEventListener('click', (event) => {
    const header = event.target.closest('th[data-sort]');
    if (!header) return;

    const key = header.dataset.sort;
    state.sort = {
        key,
        // First click sorts ascending; clicking the active column again reverses it.
        direction: state.sort.key === key && state.sort.direction === 'asc' ? 'desc' : 'asc'
    };
    renderRules();
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
        await refreshLogs();
    } catch (error) {
        toast(error.message, 'error');
    } finally {
        button.disabled = false;
    }
});

$('portsMore').addEventListener('click', () => {
    state.showAllPorts = !state.showAllPorts;
    renderActivity();
});

$('ipsMore').addEventListener('click', () => {
    state.showAllIps = !state.showAllIps;
    renderActivity();
});

for (const list of [$('topIps'), $('topSources')]) {
    list.addEventListener('click', (event) => {
        const button = event.target.closest('[data-ip]');
        if (button) selectIp(button.dataset.ip);
    });
}

$('viewActivityBtn').addEventListener('click', () => setTab('activity'));

$('filterChip').addEventListener('click', (event) => {
    if (!event.target.closest('[data-clear-filter]')) return;
    state.filterIp = null;
    renderActivity();
});

$('linesForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = $('linesInput');
    const value = Math.min(50000, Math.max(100, Math.round(Number(input.value) || 1000)));

    state.lines = value;
    localStorage.setItem('logLines', String(value));
    input.value = String(value);

    const button = $('applyLines');
    button.disabled = true;
    try {
        await refreshLogs();
        toast(`Analyzing ${format(value)} log lines`);
    } catch (error) {
        toast(error.message, 'error');
    } finally {
        button.disabled = false;
    }
});

$('logoutBtn').addEventListener('click', async () => {
    try {
        await mutate('/logout');
    } finally {
        location.href = '/login';
    }
});

window.addEventListener('resize', moveIndicator);

/* Init */

setTab(TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview');
requestAnimationFrame(moveIndicator);

load().catch((error) => {
    state.status = 'error';
    state.error = error.message;
    render();
});
