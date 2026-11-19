// Transfers & Rollovers Agent page (/agents/transfers-rollovers) — "Try it out".
// Loaded as a permanent script from App.razor so init runs reliably on full
// page load AND on Blazor enhanced navigation (inline <script> tags inside
// razor pages do not re-execute on enhanced nav).
//
// Flow: pick a Member Case → engage Rory's agent (/transfers/process,
// streamed) → counterparties, insurance warnings, SMSF verification and SLA →
// rollover request dispatched / held / scheduled with the PDF download.
(function () {
    function init() {
        const root = document.querySelector('.tr-panel');
        if (!root || root.dataset.wired === '1') return;
        root.dataset.wired = '1';

        // Re-query the live document each time so a Blazor enhanced
        // navigation swap never leaves us writing into a detached node.
        const $ = sel => {
            const r = document.querySelector('.tr-panel') || root;
            return r ? r.querySelector(sel) : null;
        };

        function escapeHtml(s) {
            return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        }

        function show(sel, visible) {
            const el = $(sel);
            if (el) el.hidden = !visible;
        }

        function setText(sel, value) {
            const el = $(sel);
            if (el) el.textContent = value == null ? '' : value;
        }

        function tone(t) {
            return ['ok', 'warn', 'blocked', 'info'].includes(t) ? t : 'info';
        }

        function resetDownstream() {
            show('#tr-process-status', false);
            show('#tr-plan-step', false);
            show('#tr-request-step', false);
        }

        // ── Step 1: cases ────────────────────────────────────────────────
        async function loadCases(preferred) {
            const select = $('#tr-case-select');
            if (select) select.innerHTML = '<option value="">— Loading cases —</option>';
            show('#tr-case-summary', false);
            show('#tr-step-2', false);
            show('#tr-empty', false);
            const btn = $('#tr-process-btn');
            if (btn) btn.disabled = true;
            resetDownstream();
            try {
                const res = await fetch('/transfers/cases');
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const cases = await res.json();
                if (!cases.length) {
                    if (select) select.innerHTML = '<option value="">— No cases available —</option>';
                    show('#tr-empty', true);
                    return;
                }
                if (select) {
                    select.innerHTML = '<option value="">— Select a case —</option>' + cases.map(c =>
                        `<option value="${escapeHtml(c.caseNumber)}">${escapeHtml(c.caseNumber)} — ${escapeHtml(c.clientName)} (${escapeHtml(c.requestType)})</option>`
                    ).join('');
                    if (preferred && cases.some(c => c.caseNumber === preferred)) {
                        select.value = preferred;
                        selectCase();
                    }
                }
            } catch (err) {
                if (select) select.innerHTML = '<option value="">— Failed to load —</option>';
                const status = $('#tr-process-status');
                if (status) {
                    status.hidden = false;
                    status.className = 'tr-status error';
                    status.textContent = 'Failed to load cases: ' + err.message;
                }
            }
        }

        async function selectCase() {
            const select = $('#tr-case-select');
            const caseNumber = select ? select.value : '';
            const summary = $('#tr-case-summary');
            const btn = $('#tr-process-btn');
            resetDownstream();
            if (!caseNumber) {
                if (summary) summary.hidden = true;
                show('#tr-step-2', false);
                if (btn) btn.disabled = true;
                return;
            }
            try {
                const res = await fetch('/transfers/cases/' + encodeURIComponent(caseNumber));
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const c = await res.json();
                const adviser = c.adviserPractice ? `${c.adviserName} (${c.adviserPractice})` : c.adviserName;
                if (summary) {
                    summary.innerHTML =
                        `<div><span class="k">Case</span>${escapeHtml(c.caseNumber)}</div>` +
                        `<div><span class="k">Client</span>${escapeHtml(c.clientName)}</div>` +
                        `<div><span class="k">Member no.</span>${escapeHtml(c.memberNumber)}</div>` +
                        `<div><span class="k">Product</span>${escapeHtml(c.product)}</div>` +
                        `<div><span class="k">Request type</span>${escapeHtml(c.requestType)}</div>` +
                        `<div><span class="k">Received</span>${escapeHtml(c.receivedDate)}</div>` +
                        `<div><span class="k">Adviser</span>${escapeHtml(adviser)}</div>` +
                        `<div><span class="k">Amount</span>${escapeHtml(c.amount)}</div>` +
                        `<div><span class="k">Priority</span>${escapeHtml(c.priority)}</div>` +
                        `<div class="wide"><span class="k">Summary</span>${escapeHtml(c.requestSummary)}</div>`;
                    summary.hidden = false;
                }
                show('#tr-step-2', true);
                if (btn) btn.disabled = false;
            } catch (err) {
                if (summary) summary.hidden = true;
                show('#tr-step-2', false);
                if (btn) btn.disabled = true;
                const status = $('#tr-process-status');
                if (status) {
                    status.hidden = false;
                    status.className = 'tr-status error';
                    status.textContent = 'Failed to load case: ' + err.message;
                }
            }
        }

        // ── Step 2: engage ───────────────────────────────────────────────
        async function processCase() {
            const select = $('#tr-case-select');
            const caseNumber = select ? select.value : '';
            if (!caseNumber) return;
            const btn = $('#tr-process-btn');
            const status = $('#tr-process-status');
            const scope = $('.engage-tabs-scope');
            if (btn) btn.disabled = true;
            if (status) {
                status.hidden = false;
                status.className = 'tr-status';
                status.innerHTML = '<span class="spinner"></span>Engaging the Transfers &amp; Rollovers Agent…';
            }
            show('#tr-plan-step', false);
            show('#tr-request-step', false);

            try {
                const data = await window.zcAgentStream({
                    url: '/transfers/process',
                    body: { caseNumber },
                    onDelta: (_chunk, fullText) => {
                        if (window.engageTabsStreamNarrative) window.engageTabsStreamNarrative(scope, fullText);
                    },
                    onError: (msg) => {
                        const s = $('#tr-process-status');
                        if (s) {
                            s.className = 'tr-status error';
                            s.textContent = 'Agent error: ' + msg + ' — showing the deterministic plan.';
                        }
                    }
                });
                if (!data) throw new Error('No response from the agent');

                const s = $('#tr-process-status');
                if (s) {
                    if (data.agentError) {
                        s.className = 'tr-status error';
                        s.textContent = 'The live agent didn\'t complete (' + data.agentError + ') — showing the deterministic transfer plan.';
                    } else if (!data.agentConfigured) {
                        s.className = 'tr-status';
                        s.textContent = 'Processed with the deterministic transfer plan (Foundry agent not configured) — same directory, checks and PDF as the MCP tools.';
                    } else {
                        s.className = 'tr-status';
                        s.textContent = 'The Transfers & Rollovers Agent prepared the transfer plan.';
                    }
                }

                if (window.engageTabsRender) window.engageTabsRender(scope, data);
                renderPlan(data);
                renderRequest(data);
                const req = $('#tr-request-step');
                if (req) req.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } catch (err) {
                const s = $('#tr-process-status');
                if (s) {
                    s.className = 'tr-status error';
                    s.textContent = 'Failed to process: ' + err.message;
                }
            } finally {
                const b = $('#tr-process-btn');
                const sel = $('#tr-case-select');
                if (b) b.disabled = !(sel && sel.value);
            }
        }

        // ── Step 3: counterparties, warnings, SVS, SLA ───────────────────
        function renderPlan(data) {
            const plan = data.plan || {};
            setText('#tr-plan-asat', plan.asAtLabel ? `As at ${plan.asAtLabel}. ${plan.overallStatus || ''}` : (plan.overallStatus || ''));

            const legs = Array.isArray(plan.legs) ? plan.legs : [];
            const legsTable = $('#tr-legs-table');
            if (legsTable) {
                legsTable.innerHTML = legs.length
                    ? '<thead><tr><th>Counterparty</th><th>Direction</th><th>From → To</th><th class="num">Amount</th><th>Status</th><th>Why</th><th>Due</th></tr></thead><tbody>' +
                      legs.map(l =>
                          '<tr>' +
                              `<td><strong>${escapeHtml(l.counterparty)}</strong>` +
                                  (l.counterpartyId ? `<div class="muted mono">${escapeHtml(l.counterpartyId)}</div>` : '') +
                                  `<div class="muted">${escapeHtml(l.counterpartyType)}</div></td>` +
                              `<td>${escapeHtml(l.direction)}<div class="muted">${escapeHtml(l.transferType)}</div></td>` +
                              `<td>${escapeHtml(l.from)}<div class="muted">→ ${escapeHtml(l.to)}</div></td>` +
                              `<td class="num">${escapeHtml(l.amountLabel)}</td>` +
                              `<td><span class="tr-pill ${tone(l.statusTone)}">${escapeHtml(l.status)}</span>` +
                                  (l.reference ? `<div class="muted mono">${escapeHtml(l.reference)}</div>` : '') + '</td>' +
                              `<td>${escapeHtml(l.reason)}</td>` +
                              `<td>${escapeHtml(l.due)}</td>` +
                          '</tr>').join('') + '</tbody>'
                    : '';
            }
            show('#tr-legs-wrap', legs.length > 0);
            const legsEmpty = $('#tr-legs-empty');
            if (legsEmpty) {
                legsEmpty.hidden = legs.length > 0;
                legsEmpty.innerHTML = legs.length ? '' : `<strong>No transfer required.</strong> ${escapeHtml(plan.headline)}`;
            }

            const warnings = Array.isArray(plan.insuranceWarnings) ? plan.insuranceWarnings : [];
            const warnEl = $('#tr-warnings');
            if (warnEl) {
                warnEl.innerHTML = warnings.map(w =>
                    '<div class="tr-callout warn">' +
                        `<strong>⚠️ ${escapeHtml(w.fund)} — ${escapeHtml(w.cover)} cover of ${escapeHtml(Number(w.amount).toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }))}</strong> ` +
                        `<span class="tr-pill warn">${escapeHtml(w.status)}</span><br />${escapeHtml(w.message)}` +
                        `<span class="tr-callout-action">Action: ${escapeHtml(w.action)}</span>` +
                    '</div>').join('');
            }
            show('#tr-warnings-block', warnings.length > 0);

            const svs = plan.svs;
            if (svs) {
                const head = $('#tr-svs-head');
                if (head) {
                    head.innerHTML =
                        `<span class="tr-pill ${svs.passed ? 'ok' : 'blocked'}">${escapeHtml(svs.outcome)}</span> ` +
                        `<strong>${escapeHtml(svs.fundName || 'SMSF')}</strong> · ABN ${escapeHtml(svs.abn)}` +
                        (svs.complianceStatus ? ` · ${escapeHtml(svs.complianceStatus)}` : '');
                }
                const table = $('#tr-svs-table');
                if (table) {
                    table.innerHTML = '<thead><tr><th>Check</th><th>Result</th><th>Detail</th></tr></thead><tbody>' +
                        (svs.checks || []).map(ch =>
                            `<tr><td>${escapeHtml(ch.check)}</td>` +
                            `<td><span class="tr-pill ${ch.passed ? 'ok' : 'blocked'}">${ch.passed ? 'Pass' : 'Fail'}</span></td>` +
                            `<td>${escapeHtml(ch.detail)}</td></tr>`).join('') + '</tbody>';
                }
                setText('#tr-svs-rec', svs.recommendation);
            }
            show('#tr-svs-block', !!svs);

            const counterparties = Array.isArray(plan.counterparties) ? plan.counterparties : [];
            const cards = $('#tr-counterparties');
            if (cards) {
                cards.innerHTML = counterparties.map(cp => {
                    const id = [cp.usi ? 'USI ' + cp.usi : null, cp.abn ? 'ABN ' + cp.abn : null].filter(Boolean).join(' · ');
                    return '<div class="tr-card">' +
                        `<div class="tr-card-name">${escapeHtml(cp.name)}</div>` +
                        (id ? `<div class="tr-card-id">${escapeHtml(id)}</div>` : '') +
                        `<div class="tr-card-row"><span class="k">Type</span>${escapeHtml(cp.type)}</div>` +
                        `<div class="tr-card-row"><span class="k">Channel</span>${escapeHtml(cp.channel)}</div>` +
                        `<div class="tr-card-row"><span class="k">Contact</span>${escapeHtml(cp.contact)}</div>` +
                        (cp.esa ? `<div class="tr-card-row"><span class="k">ESA</span>${escapeHtml(cp.esa)}</div>` : '') +
                        `<div class="tr-card-row"><span class="k">Turnaround</span>${escapeHtml(cp.turnaroundNote)}</div>` +
                        (cp.insuranceHeld ? `<div class="tr-card-row tr-card-insurance"><span class="k">Insurance held</span>${escapeHtml(cp.insuranceHeld)}</div>` : '') +
                        `<div class="tr-card-row"><span class="k">Notes</span>${escapeHtml(cp.notes)}</div>` +
                    '</div>';
                }).join('');
            }
            show('#tr-counterparties-block', counterparties.length > 0);

            const sla = Array.isArray(plan.sla) ? plan.sla : [];
            const slaTable = $('#tr-sla-table');
            if (slaTable) {
                slaTable.innerHTML = '<thead><tr><th>Item</th><th>Counterparty</th><th>Started</th><th>Due</th><th>Status</th><th>Note</th></tr></thead><tbody>' +
                    sla.map(s =>
                        `<tr><td><strong>${escapeHtml(s.item)}</strong></td><td>${escapeHtml(s.counterparty)}</td>` +
                        `<td>${escapeHtml(s.start)}</td><td>${escapeHtml(s.due)}</td>` +
                        `<td><span class="tr-pill ${tone(s.tone)}">${escapeHtml(s.status)}</span></td>` +
                        `<td>${escapeHtml(s.note)}</td></tr>`).join('') + '</tbody>';
            }
            show('#tr-sla-block', sla.length > 0);

            const notes = Array.isArray(plan.notes) ? plan.notes : [];
            const notesEl = $('#tr-notes');
            if (notesEl) notesEl.innerHTML = notes.map(n => `<li>${escapeHtml(n)}</li>`).join('');
            show('#tr-notes-block', notes.length > 0);

            show('#tr-plan-step', true);
        }

        // ── Step 4: request dispatched / held / scheduled ────────────────
        function renderRequest(data) {
            const plan = data.plan || {};
            const card = $('#tr-request-card');
            if (card) card.className = 'tr-request-card ' + tone(plan.statusTone);
            setText('#tr-request-status', plan.requestStatus || plan.overallStatus || '');
            setText('#tr-request-headline', plan.headline || '');

            const link = $('#tr-pdf-link');
            if (data.transferRequestPdfUrl && link) {
                const fileName = data.transferRequestPdfFileName || 'transfer-request.pdf';
                link.href = data.transferRequestPdfUrl;
                link.setAttribute('download', fileName);
                setText('#tr-pdf-name', fileName);
                const legs = Array.isArray(plan.legs) ? plan.legs : [];
                setText('#tr-pdf-sub', legs.length
                    ? `${plan.requestStatus} — ${legs.length} transfer${legs.length === 1 ? '' : 's'} on the request.`
                    : 'Case-file record — no transfer is sent to another fund.');
                show('#tr-pdf', true);
            } else {
                show('#tr-pdf', false);
            }

            const updates = Array.isArray(plan.updates) ? plan.updates : [];
            const updatesEl = $('#tr-updates');
            if (updatesEl) {
                updatesEl.innerHTML = updates.length
                    ? updates.map((u, i) =>
                        '<div class="tr-update">' +
                            '<div class="tr-update-head">' +
                                `<span class="tr-update-audience">${escapeHtml(u.audience)}</span>` +
                                `<span class="tr-update-channel">· ${escapeHtml(u.channel)}</span>` +
                            '</div>' +
                            (u.note ? `<div class="tr-update-note">${escapeHtml(u.note)}</div>` : '') +
                            `<div class="tr-update-body agent-md" id="tr-update-body-${i}"></div>` +
                        '</div>').join('')
                    : '<p class="muted">No update is needed from Transfers &amp; Rollovers.</p>';
                updates.forEach((u, i) => {
                    const body = $('#tr-update-body-' + i);
                    if (!body) return;
                    if (typeof window.zcRenderMarkdown === 'function') window.zcRenderMarkdown(body, u.body || '');
                    else body.textContent = u.body || '';
                });
            }

            const approval = $('#tr-approval');
            if (approval) approval.className = 'tr-approval' + (plan.humanApprovalRequired ? ' required' : '');
            setText('#tr-approval-pill', plan.humanApprovalRequired ? 'Human approval required' : 'No approval needed');
            setText('#tr-approval-reason', plan.humanApprovalReason || '');

            show('#tr-request-step', true);
        }

        // ── Wiring ───────────────────────────────────────────────────────
        const selectInit = $('#tr-case-select');
        const refreshInit = $('#tr-refresh-btn');
        const processInit = $('#tr-process-btn');
        if (selectInit) selectInit.addEventListener('change', selectCase);
        if (refreshInit) refreshInit.addEventListener('click', () => loadCases());
        if (processInit) processInit.addEventListener('click', processCase);

        // Deep link: /agents/transfers-rollovers?caseNumber=REQ-… opens the
        // Try it out tab with that case selected.
        const params = new URLSearchParams(window.location.search);
        const preferred = params.get('caseNumber') || params.get('case');
        if (preferred) {
            const tryTab = document.querySelector('.agent-tab-scope .agent-tab[data-tab="try"]');
            if (tryTab && !tryTab.classList.contains('active')) tryTab.click();
        }
        loadCases(preferred);
    }

    init();

    if (!window.__trDemoEnhancedHook) {
        window.__trDemoEnhancedHook = true;
        const hook = () => init();
        if (typeof Blazor !== 'undefined' && typeof Blazor.addEventListener === 'function') {
            Blazor.addEventListener('enhancedload', hook);
        } else {
            document.addEventListener('enhancedload', hook);
        }
    }
})();
