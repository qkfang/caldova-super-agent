// Team Leader page — "Try it out" (floor dashboard) and "Group Chat" wiring.
// Loaded as a permanent script from App.razor so init runs reliably on full
// page load AND on Blazor enhanced navigation (inline <script> tags inside
// razor pages do not re-execute on enhanced nav).
    (function () {
        function escapeHtml(s) {
            return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
        }

        function isDirect(adviserName) {
            return !adviserName || /^\s*none/i.test(adviserName);
        }

        function caseOptionLabel(c) {
            return `${escapeHtml(c.caseNumber)} — ${escapeHtml(c.clientName)} (${escapeHtml(c.requestType)})`;
        }

        // ── Try it out: floor dashboard ────────────────────────────────────
        function init() {
        const root = document.querySelector('.leader-panel');
        if (!root || root.dataset.wired === '1') return;
        root.dataset.wired = '1';

        const $ = sel => root.querySelector(sel);
        const selectEl = $('#leader-case-select');
        const refreshBtn = $('#leader-refresh-btn');
        const emptyEl = $('#leader-empty');
        const cardEl = $('#leader-case-card');
        const step2El = $('#leader-step-2');
        const processBtn = $('#leader-process-btn');
        const processStatus = $('#leader-process-status');
        const resultsEl = $('#leader-results');
        const engageScope = $('.engage-tabs-scope');

        let selectedCase = null;

        function setSelectedCase(c) {
            selectedCase = c;
            resultsEl.hidden = true;
            if (!c) {
                cardEl.hidden = true;
                step2El.hidden = true;
                processBtn.disabled = true;
                return;
            }
            $('#leader-case-num').textContent = c.caseNumber;
            $('#leader-case-client').textContent = c.clientName || '—';
            $('#leader-case-member').textContent = c.memberNumber || '—';
            $('#leader-case-type').textContent = c.requestType || '—';
            $('#leader-case-received').textContent = c.receivedDate || '—';
            $('#leader-case-adviser').textContent = isDirect(c.adviserName)
                ? 'None — direct member'
                : `${c.adviserName}${c.adviserPractice ? ' (' + c.adviserPractice + ')' : ''}`;
            $('#leader-case-amount').textContent = c.amount || '—';
            $('#leader-case-priority').textContent = `${c.priority || '—'}${c.priorityReason ? ' — ' + c.priorityReason : ''}`;
            $('#leader-case-request').textContent = c.requestSummary || '—';
            cardEl.hidden = false;
            // Reveal step 2 (engage agent) now that a case is picked.
            step2El.hidden = false;
            processBtn.disabled = false;
        }

        async function loadCases() {
            selectEl.innerHTML = '<option value="">— Loading… —</option>';
            emptyEl.hidden = true;
            setSelectedCase(null);
            processStatus.hidden = true;

            try {
                const res = await fetch('/team-leader/cases');
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const cases = await res.json();
                if (!cases.length) {
                    selectEl.innerHTML = '<option value="">— No cases on the floor —</option>';
                    emptyEl.hidden = false;
                    return;
                }
                selectEl.innerHTML = '<option value="">— Select a case —</option>' +
                    cases.map(c => `<option value="${escapeHtml(c.caseNumber)}">${caseOptionLabel(c)}</option>`).join('');
            } catch (err) {
                selectEl.innerHTML = '<option value="">— Failed to load —</option>';
                processStatus.hidden = false;
                processStatus.className = 'leader-status error';
                processStatus.textContent = 'Failed to load cases: ' + err.message;
            }
        }

        async function selectCase(caseNumber) {
            processStatus.hidden = true;
            if (!caseNumber) {
                setSelectedCase(null);
                return;
            }
            try {
                const res = await fetch(`/team-leader/cases/${encodeURIComponent(caseNumber)}`);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                setSelectedCase(await res.json());
            } catch (err) {
                setSelectedCase(null);
                processStatus.hidden = false;
                processStatus.className = 'leader-status error';
                processStatus.textContent = 'Failed to load case: ' + err.message;
            }
        }

        const stateLabels = { due: 'Due', running: 'Running', paused: 'Paused', watch: 'Watch', ok: 'Done' };

        function focusClass(caseNumber, focusNumber) {
            return caseNumber === focusNumber ? 'is-focus' : '';
        }

        function caseCell(caseNumber, clientName) {
            return `<td class="tl-case">${escapeHtml(caseNumber)}<small>${escapeHtml(clientName)}</small></td>`;
        }

        function renderFocus(f) {
            const facts = (f.keyFacts || []).map(k => `<li>${escapeHtml(k)}</li>`).join('');
            $('#leader-focus').innerHTML =
                `<div class="tl-focus-head">` +
                    `<span class="tl-focus-label">Theo's focus</span>` +
                    `<span class="tl-focus-title">${escapeHtml(f.caseNumber)} · ${escapeHtml(f.clientName)} · ${escapeHtml(f.requestType)}</span>` +
                    `<span class="tl-badge watch">${escapeHtml(f.stage)}</span>` +
                `</div>` +
                `<div class="tl-focus-grid">` +
                    `<div><span class="k">Owner</span>${escapeHtml(f.owner)}</div>` +
                    `<div><span class="k">Decision for Theo</span>${escapeHtml(f.decision)}</div>` +
                    `<div class="span-2"><span class="k">Where it stands</span>${escapeHtml(f.summary)}</div>` +
                    `<div class="span-2"><span class="k">Recommendation</span>${escapeHtml(f.recommendation)}</div>` +
                    (facts ? `<div class="span-2"><span class="k">Key facts on file</span><ul class="tl-facts">${facts}</ul></div>` : '') +
                `</div>`;
        }

        function renderFloor(data) {
            const floor = data.floor || {};
            const focusNumber = data.caseNumber;

            $('#leader-asat').textContent = floor.asAt || '';
            renderFocus(data.focus || {});

            $('#leader-stage-tiles').innerHTML = (floor.stageCounts || []).map(s =>
                `<div class="tl-tile${s.count > 0 && s.stage === 'Awaiting approval' ? ' hot' : ''}">` +
                    `<span class="tl-tile-count">${escapeHtml(s.count)}</span>` +
                    `<span class="tl-tile-stage">${escapeHtml(s.stage)}</span>` +
                    `<span class="tl-tile-hint">${escapeHtml(s.hint)}</span>` +
                `</div>`).join('');

            const clocks = floor.clocks || [];
            $('#leader-clocks-body').innerHTML = clocks.length
                ? clocks.map(c =>
                    `<tr class="${focusClass(c.caseNumber, focusNumber)}">` +
                        `<td><span class="tl-badge ${escapeHtml(c.state)}">${escapeHtml(stateLabels[c.state] || c.state)}</span>${escapeHtml(c.clock)}</td>` +
                        caseCell(c.caseNumber, c.clientName) +
                        `<td>${escapeHtml(c.rule)}</td>` +
                        `<td>${escapeHtml(c.status)}</td>` +
                    `</tr>`).join('')
                : '<tr><td colspan="4">No clocks running.</td></tr>';

            const escalations = floor.escalations || [];
            $('#leader-escalations').innerHTML = escalations.length
                ? escalations.map(e =>
                    `<li class="${focusClass(e.caseNumber, focusNumber)}">` +
                        `<span class="tl-badge ${escapeHtml(String(e.severity || '').toLowerCase())}">${escapeHtml(e.severity)}</span>` +
                        `<strong>${escapeHtml(e.clientName)}</strong> · ${escapeHtml(e.caseNumber)} — ${escapeHtml(e.reason)}` +
                        `<span class="tl-esc-meta">Owner: ${escapeHtml(e.owner)} · ${escapeHtml(e.clock)}</span>` +
                    `</li>`).join('')
                : '<li>No escalations on the floor.</li>';

            const approvals = floor.approvals || [];
            $('#leader-approvals-body').innerHTML = approvals.length
                ? approvals.map(a =>
                    `<tr class="${focusClass(a.caseNumber, focusNumber)}">` +
                        `<td><strong>${escapeHtml(a.priority)}</strong></td>` +
                        caseCell(a.caseNumber, a.clientName) +
                        `<td>${escapeHtml(a.item)}</td>` +
                        `<td>${escapeHtml(a.authority)}</td>` +
                        `<td>${escapeHtml(a.recommendation)}</td>` +
                        `<td>${escapeHtml(a.due)}</td>` +
                    `</tr>`).join('')
                : '<tr><td colspan="6">Nothing waiting for approval.</td></tr>';

            const vulnerable = floor.vulnerable || [];
            $('#leader-vulnerable').innerHTML = vulnerable.length
                ? vulnerable.map(v =>
                    `<li class="${focusClass(v.caseNumber, focusNumber)}">` +
                        `<strong>${escapeHtml(v.clientName)}</strong> · ${escapeHtml(v.caseNumber)} — ${escapeHtml(v.flag)}` +
                        `<span class="tl-meta">${escapeHtml(v.handling)}</span>` +
                    `</li>`).join('')
                : '<li>No vulnerable members flagged.</li>';

            $('#leader-coaching').innerHTML = (floor.coaching || []).map(c => `<li>${escapeHtml(c)}</li>`).join('');
            $('#leader-priorities').innerHTML = (floor.priorities || []).map(p => `<li>${escapeHtml(p)}</li>`).join('');
        }

        async function processCase() {
            if (!selectedCase) return;
            processBtn.disabled = true;
            processStatus.hidden = false;
            processStatus.className = 'leader-status';
            processStatus.innerHTML = '<span class="spinner"></span>Theo\'s agent is reviewing the floor…';
            resultsEl.hidden = true;

            try {
                const data = await window.zcAgentStream({
                    url: '/team-leader/process',
                    body: { caseNumber: selectedCase.caseNumber },
                    onDelta: (_chunk, fullText) => {
                        if (window.engageTabsStreamNarrative) {
                            window.engageTabsStreamNarrative(engageScope, fullText);
                        }
                    },
                    onError: (msg) => {
                        processStatus.className = 'leader-status error';
                        processStatus.textContent = 'Agent error: ' + msg;
                    }
                });
                if (!data) throw new Error('No response from the agent');

                processStatus.className = 'leader-status';
                if (data.agentConfigured && data.agentNotes) {
                    processStatus.textContent = 'Team Leader Agent reviewed the floor — the live briefing is in the Agent Narrative tab; the dashboard below is built from the case data.';
                } else if (data.agentConfigured) {
                    processStatus.className = 'leader-status error';
                    processStatus.textContent = 'Live agent unavailable' + (data.agentError ? ' (' + data.agentError + ')' : '') +
                        ' — showing the floor dashboard built from the case data.';
                } else {
                    processStatus.textContent = 'Floor dashboard built from the case data (Foundry agent not configured — no live narrative).';
                }

                renderFloor(data);
                resultsEl.hidden = false;
                resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

                // Surface input + raw output in the Engage Agent sub-tabs.
                if (window.engageTabsRender) {
                    window.engageTabsRender(engageScope, data);
                }
            } catch (err) {
                processStatus.className = 'leader-status error';
                processStatus.textContent = 'Failed to review the floor: ' + err.message;
            } finally {
                processBtn.disabled = !selectedCase;
            }
        }

        selectEl.addEventListener('change', () => selectCase(selectEl.value));
        refreshBtn.addEventListener('click', loadCases);
        processBtn.addEventListener('click', processCase);

        loadCases();
        }

        // ── Group Chat panel wiring ────────────────────────────────────
        function initGroupChat() {
            const root = document.querySelector('.groupchat-panel');
            if (!root || root.dataset.wired === '1') return;
            root.dataset.wired = '1';

            const $ = sel => root.querySelector(sel);
            const selectEl   = $('#gc-case-select');
            const refreshBtn = $('#gc-refresh-btn');
            const emptyEl    = $('#gc-empty');
            const cardEl     = $('#gc-case-card');
            const step2El    = $('#gc-step-2');
            const startBtn   = $('#gc-start-btn');
            const statusEl   = $('#gc-status');
            const rosterEl   = $('#gc-roster');
            const transcript = $('#gc-transcript');
            const transcriptStep = $('#gc-transcript-step');
            const modeEl     = $('#gc-mode');

            let selectedCase = null;
            let activeStream = null;

            function setSelectedCase(c) {
                selectedCase = c;
                if (!c) {
                    cardEl.hidden = true;
                    step2El.hidden = true;
                    startBtn.disabled = true;
                    return;
                }
                $('#gc-case-num').textContent = c.caseNumber;
                $('#gc-case-client').textContent = c.clientName || '—';
                $('#gc-case-type').textContent = c.requestType || '—';
                $('#gc-case-received').textContent = c.receivedDate || '—';
                $('#gc-case-priority').textContent = `${c.priority || '—'}${c.priorityReason ? ' — ' + c.priorityReason : ''}`;
                $('#gc-case-request').textContent = c.requestSummary || '—';
                cardEl.hidden = false;
                // Reveal step 2 (start group chat) now that a case is picked.
                step2El.hidden = false;
                startBtn.disabled = !!activeStream;
            }

            async function loadCases() {
                selectEl.innerHTML = '<option value="">— Loading… —</option>';
                emptyEl.hidden = true;
                setSelectedCase(null);
                statusEl.hidden = true;
                try {
                    const res = await fetch('/team-leader/cases');
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    const cases = await res.json();
                    if (!cases.length) {
                        selectEl.innerHTML = '<option value="">— No cases on the floor —</option>';
                        emptyEl.hidden = false;
                        return;
                    }
                    selectEl.innerHTML = '<option value="">— Select a case —</option>' +
                        cases.map(c => `<option value="${escapeHtml(c.caseNumber)}">${caseOptionLabel(c)}</option>`).join('');
                } catch (err) {
                    selectEl.innerHTML = '<option value="">— Failed to load —</option>';
                    statusEl.hidden = false;
                    statusEl.className = 'leader-status error';
                    statusEl.textContent = 'Failed to load cases: ' + err.message;
                }
            }

            async function selectCase(caseNumber) {
                if (!caseNumber) { setSelectedCase(null); return; }
                try {
                    const res = await fetch(`/team-leader/cases/${encodeURIComponent(caseNumber)}`);
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    setSelectedCase(await res.json());
                } catch (err) {
                    setSelectedCase(null);
                    statusEl.hidden = false;
                    statusEl.className = 'leader-status error';
                    statusEl.textContent = 'Failed to load case: ' + err.message;
                }
            }

            async function loadRoster() {
                try {
                    const res = await fetch('/team-leader/groupchat/participants');
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    const parts = await res.json();
                    rosterEl.innerHTML =
                        `<span class="gc-chip leader">Theo — Client Operations Team Leader (chair)</span>` +
                        parts.map(p =>
                            `<span class="gc-chip">${escapeHtml(p.persona)} — ${escapeHtml(p.role)}</span>`
                        ).join('');
                } catch (err) {
                    rosterEl.innerHTML =
                        `<span class="gc-chip">Failed to load the roster: ${escapeHtml(err.message)}</span>`;
                }
            }

            function appendTurn(turn) {
                const isLeader = turn.speakerId === 'team-leader';
                const cls = ['gc-msg'];
                if (isLeader) cls.push('gc-leader');
                if (turn.kind === 'info') cls.push('gc-info');
                if (turn.kind === 'error') cls.push('gc-error');
                if (turn.kind === 'conclude') cls.push('gc-conclude');

                const kindLabel = ({
                    info: 'orchestration', ask: 'asks', reply: 'replies',
                    conclude: 'concludes with a plan', error: 'error'
                })[turn.kind] || turn.kind;

                const div = document.createElement('div');
                div.className = cls.join(' ');
                div.innerHTML =
                    `<div class="gc-meta">` +
                        `<span class="gc-who">${escapeHtml(turn.persona)}</span>` +
                        `<span class="gc-role">${escapeHtml(turn.role)}</span>` +
                        `<span class="gc-kind">${escapeHtml(kindLabel)}</span>` +
                    `</div>` +
                    `<div class="gc-body"></div>`;
                div.querySelector('.gc-body').textContent = turn.text;
                transcript.appendChild(div);
                transcript.scrollTop = transcript.scrollHeight;
            }

            async function startGroupChat() {
                if (!selectedCase) return;
                if (activeStream) { try { activeStream.close(); } catch { /* ignore — closing an already-closed stream */ } activeStream = null; }

                startBtn.disabled = true;
                statusEl.hidden = false;
                statusEl.className = 'leader-status';
                statusEl.innerHTML = '<span class="spinner"></span>Opening the group chat…';
                transcript.innerHTML = '';
                modeEl.textContent = '';
                transcriptStep.hidden = false;

                try {
                    const res = await fetch('/team-leader/groupchat/start', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ caseNumber: selectedCase.caseNumber })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));

                    modeEl.textContent = data.mode === 'live'
                        ? 'Live Foundry agents'
                        : 'Scripted replay — Foundry not configured';
                    statusEl.innerHTML = '<span class="spinner"></span>Theo is chairing the discussion…';
                    transcriptStep.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    const sse = new EventSource(`/team-leader/groupchat/stream/${encodeURIComponent(data.sessionId)}`);
                    activeStream = sse;
                    sse.onmessage = ev => {
                        let turn;
                        try { turn = JSON.parse(ev.data); } catch { return; }
                        if (turn.kind === 'done') {
                            sse.close();
                            activeStream = null;
                            statusEl.className = 'leader-status';
                            statusEl.textContent = 'Group chat complete — Theo\'s plan is at the end of the transcript.';
                            startBtn.disabled = !selectedCase;
                            return;
                        }
                        appendTurn(turn);
                    };
                    sse.onerror = () => {
                        sse.close();
                        activeStream = null;
                        if (!startBtn.disabled) return;
                        statusEl.className = 'leader-status error';
                        statusEl.textContent = 'Stream interrupted.';
                        startBtn.disabled = !selectedCase;
                    };
                } catch (err) {
                    statusEl.className = 'leader-status error';
                    statusEl.textContent = 'Failed to start the group chat: ' + err.message;
                    startBtn.disabled = !selectedCase;
                }
            }

            selectEl.addEventListener('change', () => selectCase(selectEl.value));
            refreshBtn.addEventListener('click', loadCases);
            startBtn.addEventListener('click', startGroupChat);

            loadCases();
            loadRoster();
        }

        init();
        initGroupChat();

        if (!window.__teamLeaderDemoEnhancedHook) {
            window.__teamLeaderDemoEnhancedHook = true;
            const hook = () => { init(); initGroupChat(); };
            if (typeof Blazor !== 'undefined' && typeof Blazor.addEventListener === 'function') {
                Blazor.addEventListener('enhancedload', hook);
            } else {
                document.addEventListener('enhancedload', hook);
            }
        }
    })();
