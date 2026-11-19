// Benefits & Eligibility "Try it out" demo wiring (/agents/benefits-eligibility).
//
// Loaded globally from App.razor so it runs on a full page load AND re-binds
// after Blazor enhanced navigation (`enhancedload`) — inline <script> tags in
// enhanced-navigated pages are not reliably executed.
//
// Flow: 1 pick a Member Case → 2 review the case and the rule documents that
// apply → 3 engage the Benefits & Eligibility Agent (streamed narrative +
// engage sub-tabs) → 4 render the eligibility checklist (rule · status ·
// finding · clause) with the recommendation badge and outcome summary.
// Endpoints: /benefits/cases, /benefits/cases/{n}, /benefits/rules/{n},
// /benefits/process, /benefits/checklist/{n}. Open the page with
// ?case=REQ-… to pre-select a case (used by the Onboarding receipt links).
(function () {
    function escapeHtml(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function formatDate(value) {
        if (!value) return '';
        const d = new Date(value);
        if (isNaN(d.getTime())) return String(value);
        return d.toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    // Split a clauseRef such as "HS-1" or "TD-1, TD-3" into individual clause ids.
    function clauseTokens(ref) {
        return String(ref || '')
            .split(/[\s,;/]+/)
            .map(t => t.trim().replace(/[().]+$/, ''))
            .filter(t => /^[A-Za-z]+-[A-Za-z0-9.]+$/.test(t));
    }

    function recommendationPillClass(rec) {
        switch ((rec || '').toLowerCase()) {
            case 'approve': return 'approve';
            case 'partialapprove': return 'partial';
            case 'decline': return 'decline';
            default: return 'info';
        }
    }

    function normaliseStatus(s) {
        const v = String(s || '').toLowerCase();
        return v === 'pass' || v === 'fail' ? v : 'info';
    }

    function init() {
        const root = document.querySelector('.assessment-panel');
        if (!root || root.dataset.wired === '1') return;
        root.dataset.wired = '1';

        const $ = sel => root.querySelector(sel);
        const select = $('#assessment-case-select');
        const refreshBtn = $('#assessment-refresh-btn');
        const emptyEl = $('#assessment-empty');
        const caseStep = $('#assessment-case-step');
        const card = $('#assessment-case-card');
        const rulesEl = $('#assessment-rules');
        const rulesCount = $('#assessment-rules-count');
        const processStep = $('#assessment-process-step');
        const processBtn = $('#assessment-process-btn');
        const processStatus = $('#assessment-process-status');
        const outputStep = $('#assessment-output-step');
        const checklistEl = $('#assessment-checklist');
        const checklistPill = $('#assessment-checklist-pill');
        const sourceEl = $('#assessment-source');
        const tallyEl = $('#assessment-tally');
        const decisionReason = $('#assessment-decision-reason');
        const decisionOutcome = $('#assessment-decision-outcome');
        const engageScope = $('.engage-tabs-scope');

        let currentCase = null;
        let clauseIndex = {};
        let selectSeq = 0;
        const params = new URLSearchParams(window.location.search);
        let pendingPreselect = params.get('caseNumber') || params.get('case');

        function showEmpty(message) {
            emptyEl.hidden = false;
            if (message) emptyEl.textContent = message;
        }

        async function loadCases() {
            select.innerHTML = '<option value="">— Loading cases —</option>';
            emptyEl.hidden = true;
            try {
                const res = await fetch('/benefits/cases');
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const cases = await res.json();
                if (!cases.length) {
                    select.innerHTML = '<option value="">— No cases in memory —</option>';
                    emptyEl.hidden = false;
                    caseStep.hidden = true;
                    processStep.hidden = true;
                    outputStep.hidden = true;
                    return;
                }
                const previous = currentCase ? currentCase.caseNumber : '';
                select.innerHTML =
                    '<option value="">— Select a case —</option>' +
                    cases.map(c => `<option value="${escapeHtml(c.caseNumber)}">${escapeHtml(c.caseNumber)} — ${escapeHtml(c.clientName)} (${escapeHtml(c.requestType)})</option>`).join('');
                if (previous && cases.some(c => c.caseNumber === previous)) select.value = previous;

                if (pendingPreselect) {
                    const wanted = pendingPreselect.toLowerCase();
                    pendingPreselect = null;
                    const match = cases.find(c => String(c.caseNumber).toLowerCase() === wanted);
                    if (match) {
                        select.value = match.caseNumber;
                        const tryTab = document.querySelector('.agent-tab[data-tab="try"]');
                        if (tryTab && !tryTab.classList.contains('active')) tryTab.click();
                        selectCase(match.caseNumber);
                    }
                }
            } catch (err) {
                select.innerHTML = '<option value="">— Failed to load —</option>';
                showEmpty('Failed to load cases: ' + err.message);
            }
        }

        async function selectCase(caseNumber) {
            const seq = ++selectSeq;
            currentCase = null;
            outputStep.hidden = true;
            processStatus.hidden = true;
            if (!caseNumber) {
                caseStep.hidden = true;
                processStep.hidden = true;
                return;
            }
            try {
                const [caseRes, rulesRes] = await Promise.all([
                    fetch(`/benefits/cases/${encodeURIComponent(caseNumber)}`),
                    fetch(`/benefits/rules/${encodeURIComponent(caseNumber)}`)
                ]);
                if (!caseRes.ok) throw new Error('HTTP ' + caseRes.status);
                const c = await caseRes.json();
                const rules = rulesRes.ok ? await rulesRes.json() : null;
                if (seq !== selectSeq) return;

                currentCase = c;
                renderCard(c);
                renderRules(rules);
                caseStep.hidden = false;
                processStep.hidden = false;
                processBtn.disabled = false;
            } catch (err) {
                if (seq !== selectSeq) return;
                caseStep.hidden = true;
                processStep.hidden = true;
                outputStep.hidden = true;
                showEmpty('Failed to load case: ' + err.message);
            }
        }

        function renderCard(c) {
            const p = (c.priority || '').toLowerCase();
            const prioClass = ['urgent', 'high', 'standard'].includes(p) ? p : 'standard';
            const adviser = c.adviserPractice ? `${c.adviserName} (${c.adviserPractice})` : c.adviserName;
            card.innerHTML = `
                <div class="row"><div class="k">Case no.</div><div class="v mono">${escapeHtml(c.caseNumber)}</div></div>
                <div class="row"><div class="k">Opened</div><div class="v">${escapeHtml(formatDate(c.createdAt))}</div></div>
                <div class="row"><div class="k">Client</div><div class="v">${escapeHtml(c.clientName)}</div></div>
                <div class="row"><div class="k">Member no.</div><div class="v mono">${escapeHtml(c.memberNumber)}</div></div>
                <div class="row"><div class="k">Product</div><div class="v">${escapeHtml(c.product)}</div></div>
                <div class="row"><div class="k">Request type</div><div class="v">${escapeHtml(c.requestType)}</div></div>
                <div class="row"><div class="k">Received</div><div class="v">${escapeHtml(c.receivedDate)}</div></div>
                <div class="row"><div class="k">Adviser</div><div class="v">${escapeHtml(adviser)}</div></div>
                <div class="row"><div class="k">Amount</div><div class="v">${escapeHtml(c.amount)}</div></div>
                <div class="row"><div class="k">Preferred contact</div><div class="v">${escapeHtml(c.preferredContact)}</div></div>
                <div class="row span-2"><div class="k">Summary</div><div class="v">${escapeHtml(c.requestSummary)}</div></div>
                <div class="row span-2"><div class="k">Priority</div><div class="v"><span class="prio-pill ${prioClass}">${escapeHtml(c.priority)}</span>${escapeHtml(c.priorityReason)}</div></div>
            `;
        }

        function renderRules(data) {
            const docs = (data && Array.isArray(data.documents)) ? data.documents : [];
            const checked = new Set(((data && data.checkedClauses) || []).map(x => String(x).toUpperCase()));
            clauseIndex = {};
            if (!docs.length) {
                rulesEl.innerHTML = '<div class="muted">No rule documents found for this case.</div>';
                rulesCount.textContent = '';
                return;
            }
            rulesEl.innerHTML = docs.map((d, idx) => {
                const sections = (d.sections || []).map(s => {
                    const id = String(s.clauseId || '');
                    clauseIndex[id.toUpperCase()] = { id, title: s.title, text: s.text };
                    const isChecked = checked.has(id.toUpperCase());
                    return `
                        <li class="rule-clause${isChecked ? ' checked' : ''}" data-clause="${escapeHtml(id)}">
                            <span class="clause">${escapeHtml(id)}</span><span class="title">${escapeHtml(s.title)}</span><span class="marker">${isChecked ? 'Checked for this case' : ''}</span>
                            <span class="desc">${escapeHtml(s.text)}</span>
                            ${s.legalReference ? `<span class="ref">Source: ${escapeHtml(s.legalReference)}</span>` : ''}
                        </li>`;
                }).join('');
                const requirements = (d.requirements || []).map(r => `<li>${escapeHtml(r)}</li>`).join('');
                const restrictions = (d.restrictions || []).map(r => `<li>${escapeHtml(r)}</li>`).join('');
                return `
                    <details class="rule-doc" data-doc="${escapeHtml(d.id)}"${idx === 0 ? ' open' : ''}>
                        <summary>
                            <span class="doc-chevron" aria-hidden="true">▶</span>
                            <span class="doc-emoji" aria-hidden="true">📄</span>
                            <span class="doc-title">${escapeHtml(d.title)}</span>
                            <span class="doc-type">${escapeHtml(d.documentType)}</span>
                        </summary>
                        <div class="rule-doc-body">
                            <div class="rule-meta">
                                <div class="k">Issuer</div><div>${escapeHtml(d.issuer)}</div>
                                <div class="k">Product</div><div>${escapeHtml(d.product)}</div>
                                <div class="k">Effective</div><div>${escapeHtml(d.effectiveDate)}</div>
                            </div>
                            <p class="rule-summary">${escapeHtml(d.summary)}</p>
                            <h5>Rules</h5>
                            <ul class="rule-clauses">${sections}</ul>
                            <div class="rule-lists">
                                <div><h5>What must be on file</h5><ul>${requirements}</ul></div>
                                <div><h5>Limits &amp; restrictions</h5><ul>${restrictions}</ul></div>
                            </div>
                            <div class="rule-kb">Knowledge base document: <em>${escapeHtml(d.knowledgeBaseTitle)}</em> (wealth_knowledge)</div>
                        </div>
                    </details>`;
            }).join('');
            rulesCount.textContent = `${docs.length} document${docs.length === 1 ? '' : 's'} · ${checked.size} clause${checked.size === 1 ? '' : 's'} checked for this case`;
        }

        function jumpToClause(clauseId) {
            const key = String(clauseId || '').toUpperCase();
            const target = Array.from(rulesEl.querySelectorAll('.rule-clause'))
                .find(li => String(li.dataset.clause || '').toUpperCase() === key);
            if (!target) return;
            const details = target.closest('details');
            if (details) details.open = true;
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            target.classList.remove('flash');
            void target.offsetWidth;
            target.classList.add('flash');
        }

        // Colour the clauses in step 2 by the checklist result that cites
        // them (a failing check outranks a note, which outranks a pass).
        function markCitedClauses(items) {
            const rank = { fail: 3, info: 2, pass: 1 };
            const byClause = {};
            (items || []).forEach(it => {
                const status = normaliseStatus(it.status);
                clauseTokens(it.clauseRef).forEach(id => {
                    const key = id.toUpperCase();
                    if (!byClause[key] || rank[status] > rank[byClause[key]]) byClause[key] = status;
                });
            });
            rulesEl.querySelectorAll('.rule-clause').forEach(li => {
                li.classList.remove('cited-pass', 'cited-fail', 'cited-info');
                const status = byClause[String(li.dataset.clause || '').toUpperCase()];
                const marker = li.querySelector('.marker');
                if (status) {
                    li.classList.add('cited-' + status);
                    if (marker) marker.textContent = 'Cited — ' + status;
                }
            });
        }

        function clauseChips(ref) {
            const tokens = clauseTokens(ref);
            if (!tokens.length) {
                return ref ? `<span class="clause-ref">${escapeHtml(ref)}</span>` : '';
            }
            return tokens.map(id => {
                const c = clauseIndex[id.toUpperCase()];
                const tip = c ? `${c.id} — ${c.title}: ${c.text}` : id;
                return `<button type="button" class="clause-ref" data-clause-jump="${escapeHtml(id)}" title="${escapeHtml(tip)}">${escapeHtml(id)}</button>`;
            }).join('');
        }

        function renderChecklist(report) {
            const items = Array.isArray(report.items) ? report.items : [];
            checklistPill.textContent = report.recommendationLabel || 'Recommendation';
            checklistPill.className = 'assessment-result-pill ' + recommendationPillClass(report.recommendation);
            sourceEl.textContent = report.source === 'agent'
                ? "From the agent's JSON checklist"
                : 'Deterministic checklist (case file + rule documents)';
            decisionReason.textContent = report.recommendationReason || '';
            decisionOutcome.textContent = report.outcomeSummary || '—';

            const counts = { pass: 0, fail: 0, info: 0 };
            items.forEach(it => { counts[normaliseStatus(it.status)]++; });
            tallyEl.innerHTML =
                `<span class="pass">${counts.pass} pass</span> · <span class="fail">${counts.fail} fail</span> · <span class="info">${counts.info} note${counts.info === 1 ? '' : 's'}</span>`;

            const icon = s => s === 'pass' ? '✓' : (s === 'fail' ? '✗' : 'ⓘ');
            const word = s => s === 'pass' ? 'Pass' : (s === 'fail' ? 'Fail' : 'Info');
            checklistEl.innerHTML = items.map(it => {
                const status = normaliseStatus(it.status);
                return `
                <li class="${status}">
                    <span class="icon ${status}" aria-hidden="true">${icon(status)}</span>
                    <div>
                        <div class="label">
                            <span>${escapeHtml(it.label)}</span>
                            <span class="status-text">${word(status)}</span>
                            ${clauseChips(it.clauseRef)}
                        </div>
                        <div class="finding">${escapeHtml(it.finding)}</div>
                    </div>
                </li>`;
            }).join('') || '<li class="info"><span class="icon info">ⓘ</span><div class="finding">No checklist items were returned.</div></li>';
        }

        async function processCase() {
            if (!currentCase) return;
            const caseNumber = currentCase.caseNumber;
            processBtn.disabled = true;
            processStatus.hidden = false;
            processStatus.className = 'assessment-status';
            processStatus.innerHTML = '<span class="spinner"></span>Engaging Benefits &amp; Eligibility Agent…';
            outputStep.hidden = true;

            try {
                const data = await window.zcAgentStream({
                    url: '/benefits/process',
                    body: { caseNumber },
                    onDelta: (_chunk, fullText) => {
                        // Stream the live narrative into the "Agent Narrative" tab.
                        if (window.engageTabsStreamNarrative) {
                            window.engageTabsStreamNarrative(engageScope, fullText);
                        }
                    },
                    onError: (msg) => {
                        processStatus.className = 'assessment-status error';
                        processStatus.textContent = 'Agent error: ' + msg;
                    }
                });
                if (!data) throw new Error('No response from agent');
                if (!currentCase || currentCase.caseNumber !== caseNumber) return;

                let report = data.agentChecklistReport;
                if (!report) {
                    const res = await fetch(`/benefits/checklist/${encodeURIComponent(caseNumber)}`);
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    report = await res.json();
                }

                if (data.agentError) {
                    processStatus.className = 'assessment-status warn';
                    processStatus.textContent = 'Benefits & Eligibility Agent unavailable (' + data.agentError + ') — showing the deterministic eligibility assessment.';
                } else if (!data.agentConfigured) {
                    processStatus.className = 'assessment-status';
                    processStatus.textContent = 'Processed (Foundry agent not configured — showing the deterministic eligibility assessment built from the case file and rule documents).';
                } else if (report.source !== 'agent') {
                    processStatus.className = 'assessment-status warn';
                    processStatus.textContent = "The agent's reply had no readable checklist block — showing the deterministic checklist alongside its narrative.";
                } else {
                    processStatus.className = 'assessment-status';
                    processStatus.textContent = 'Benefits & Eligibility Agent assessed the case against the rules.';
                }

                // Surface the narrative, input and raw output in the engage sub-tabs.
                if (window.engageTabsRender) {
                    window.engageTabsRender(engageScope, data);
                }

                renderChecklist(report);
                markCitedClauses(report.items);
                outputStep.hidden = false;
            } catch (err) {
                processStatus.className = 'assessment-status error';
                processStatus.textContent = 'Failed to process: ' + err.message;
            } finally {
                processBtn.disabled = false;
            }
        }

        checklistEl.addEventListener('click', e => {
            const chip = e.target.closest('[data-clause-jump]');
            if (!chip) return;
            e.preventDefault();
            jumpToClause(chip.dataset.clauseJump);
        });
        select.addEventListener('change', () => selectCase(select.value));
        refreshBtn.addEventListener('click', loadCases);
        processBtn.addEventListener('click', processCase);

        loadCases();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    if (!window.__benefitsDemoEnhancedHook) {
        window.__benefitsDemoEnhancedHook = true;
        if (typeof Blazor !== 'undefined' && typeof Blazor.addEventListener === 'function') {
            Blazor.addEventListener('enhancedload', init);
        } else {
            document.addEventListener('enhancedload', init);
        }
    }
})();
