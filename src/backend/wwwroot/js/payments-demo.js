// Payments Agent (Penny) — drives the "Try it out" tab on /agents/payments.
// Loaded as a permanent script from App.razor so init runs on a full page
// load AND on Blazor enhanced navigation (inline <script> tags inside razor
// pages don't re-execute on enhanced nav).
//
// Flow: 1 pick a case → 2 confirm the payment inputs → 3 engage the Payments
// Agent (streamed) → calculation, cross-checks and the Microsoft Teams
// approval (approval popup + in-page Approve / Reject as the Teams fallback)
// → release, which stays disabled until a human approval is recorded.
// Opening /agents/payments?approvalId=PAY-…[&decision=approve|reject] (the
// links on the Teams card) jumps straight to the approval popup;
// ?caseNumber=REQ-… opens the Try it out tab on that case.
(function () {
    const STATUS_TEXT = {
        pending: 'Sent · Pending',
        approved: 'Approved',
        rejected: 'Rejected',
        released: 'Released',
        blocked: 'Blocked',
        cancelled: 'Superseded'
    };
    const RELEASE_HINT = {
        pending: 'Release unlocks once the approval is recorded.',
        approved: 'Approved — the payment can now be released.',
        rejected: 'Rejected by the approver — this payment will not be released.',
        cancelled: 'Superseded by a newer approval — engage the agent again.',
        blocked: 'Blocked — no funds can leave the account.'
    };
    const CHECK_ICON = { pass: '✓', fail: '✕', warn: '!', na: '–' };
    const POLL_MS = 4000;

    let escHandler = null;

    function escapeHtml(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // AUD with cents only when there are cents: $7,932 · $25,622.74
    function fmtMoney(n) {
        const num = Number(n) || 0;
        const cents = Math.abs(num - Math.round(num)) > 0.004;
        return num.toLocaleString('en-AU', {
            style: 'currency',
            currency: 'AUD',
            minimumFractionDigits: cents ? 2 : 0,
            maximumFractionDigits: cents ? 2 : 0
        });
    }

    function numOrNull(v) {
        const s = String(v ?? '').trim();
        if (!s) return null;
        const n = parseFloat(s);
        return Number.isFinite(n) ? n : null;
    }

    function shorten(text, max) {
        const s = String(text ?? '');
        return s.length > max ? s.slice(0, max - 1) + '…' : s;
    }

    function timeOf(iso) {
        const d = iso ? new Date(iso) : new Date();
        return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
    }

    function payeeLine(a) {
        const payees = (a && a.payees) || [];
        if (payees.length > 1) return payees.map(p => `${p.name} (${p.account}) — ${p.netFormatted} net`).join(' · ');
        if (payees.length === 1) return `${payees[0].name} — ${payees[0].account}`;
        return (a && a.payeeName) || '—';
    }

    function paymentTypeLine(a) {
        if (!a) return '';
        let text = a.paymentTypeLabel || a.paymentType || '';
        if (a.paymentType === 'pension' && a.commencementFormatted) text += ` — ${a.commencementFormatted} commencement`;
        else if (a.payees && a.payees.length > 1) text += ` — ${a.payees.length} payees`;
        return text;
    }

    function reasonsOf(a, preferred) {
        const list = (preferred && preferred.length) ? preferred
            : (a && a.approvalReasons && a.approvalReasons.length) ? a.approvalReasons
            : [a && a.reason];
        return list.filter(Boolean);
    }

    function releasedText(a) {
        const payees = ((a && a.payees) || []).filter(p => p.paymentReference);
        if (payees.length > 1) {
            return 'Payment released — ' + payees.map(p => `${p.name} ${p.netFormatted} (ref ${p.paymentReference})`).join('; ') + '.';
        }
        return `Payment released — ${a.netFormatted || fmtMoney(a.netAmount)} net, reference ${a.paymentReference || '(pending)'}.`;
    }

    function renderMarkdown(el, text) {
        if (typeof window.zcRenderMarkdown === 'function') return window.zcRenderMarkdown(el, text || '');
        el.textContent = text || '';
        return Promise.resolve();
    }

    function show(el, baseClass, cls, html) {
        el.hidden = false;
        el.className = baseClass + (cls ? ' ' + cls : '');
        el.innerHTML = html;
    }

    function init() {
        const root = document.querySelector('.payments-panel');
        if (!root || root.dataset.wired === '1') return;
        root.dataset.wired = '1';

        const $ = sel => root.querySelector(sel);

        // Step 1 — case
        const select = $('#payments-case-select');
        const refreshBtn = $('#payments-refresh-btn');
        const emptyEl = $('#payments-case-empty');
        const summaryEl = $('#payments-case-summary');
        const deeplinkEl = $('#payments-deeplink');
        // Step 2 — inputs
        const inputsStep = $('#payments-inputs-step');
        const form = $('#payments-inputs-form');
        const hintEl = $('#payments-inputs-hint');
        const payeesFieldset = $('#payments-payees-fieldset');
        const payeeRowsEl = $('#payments-payee-rows');
        const onFileEl = $('#payments-payees-onfile');
        const noPayeeEl = $('#payments-no-payee');
        const decisionEl = $('#payments-case-decision');
        // Step 3 — engage + results
        const processStep = $('#payments-process-step');
        const processBtn = $('#payments-process-btn');
        const processStatus = $('#payments-process-status');
        const engageScope = $('.engage-tabs-scope');
        const resultEl = $('#payments-result');
        const calcTitle = $('#payments-calc-title');
        const calcHead = $('#payments-calc-head');
        const calcBody = $('#payments-calc-body');
        const netEl = $('#payments-net');
        const netLabel = $('#payments-net-label');
        const netAmount = $('#payments-net-amount');
        const contextEl = $('#payments-context');
        const ruleEl = $('#payments-calc-rule');
        const checksList = $('#payments-checks-list');
        const approvalPill = $('#payments-approval-pill');
        const approvalReasons = $('#payments-approval-reasons');
        const approvalApprover = $('#payments-approval-approver');
        const teamsPanel = $('#payments-teams');
        const teamsPill = $('#payments-teams-pill');
        const teamsMsg = $('#payments-teams-msg');
        const teamsPreview = $('#payments-teams-preview');
        const teamsApprovalId = $('#payments-teams-approvalid');
        const teamsLink = $('#payments-teams-link');
        const popupBtn = $('#payments-popup-btn');
        const releaseBtn = $('#payments-release-btn');
        const releaseHint = $('#payments-release-hint');
        const teamsStatus = $('#payments-teams-status');
        const blockedPanel = $('#payments-blocked');
        const blockedText = $('#payments-blocked-text');
        const blockedRecord = $('#payments-blocked-record');
        const blockedReleaseBtn = $('#payments-blocked-release');
        const blockedHint = $('#payments-blocked-hint');
        const inboundPanel = $('#payments-inbound');
        const inboundText = $('#payments-inbound-text');
        const confirmationTitle = $('#payments-confirmation-title');
        const confirmationEl = $('#payments-confirmation');
        // Approval popup — lives outside the panel so `position: fixed`
        // isn't trapped by the panel's backdrop-filter.
        const modalEl = document.getElementById('payments-approval-modal');
        if (!modalEl) return;
        const $m = sel => modalEl.querySelector(sel);
        const modalTitle = $m('#payments-modal-title');
        const modalDeeplink = $m('#payments-modal-deeplink');
        const modalReasons = $m('#payments-modal-reasons');
        const modalCase = $m('#payments-modal-case');
        const modalApprovalId = $m('#payments-modal-approval-id');
        const modalMember = $m('#payments-modal-member');
        const modalType = $m('#payments-modal-type');
        const modalPayee = $m('#payments-modal-payee');
        const modalGross = $m('#payments-modal-gross');
        const modalTax = $m('#payments-modal-tax');
        const modalNet = $m('#payments-modal-net');
        const modalStatus = $m('#payments-modal-status');
        const modalAgent = $m('#payments-modal-agent');
        const modalAgentBody = $m('#payments-modal-agent-body');
        const modalApproveBtn = $m('#payments-modal-approve-btn');
        const modalRejectBtn = $m('#payments-modal-reject-btn');
        const modalReleaseBtn = $m('#payments-modal-release-btn');

        let cases = [];
        let selected = null;
        let inputs = null;
        let currentApproval = null;
        let modalApproval = null;
        let pollTimer = null;
        let runSeq = 0;
        let deeplinkApprovalId = null;
        let confirmationBaseTitle = 'Payment confirmation draft';

        // ── Step 1: pick a case ──────────────────────────────────────

        async function loadCases(preferred) {
            try {
                const res = await fetch('/payments/cases');
                if (!res.ok) throw new Error('HTTP ' + res.status);
                cases = await res.json();
                const previous = preferred || select.value;
                select.innerHTML = '<option value="">— Select a case —</option>' +
                    cases.map(c => `<option value="${escapeHtml(c.caseNumber)}">${escapeHtml(c.caseNumber)} — ${escapeHtml(c.clientName)} (${escapeHtml(c.requestType)})</option>`).join('');
                emptyEl.hidden = cases.length > 0;

                // Keep the current case; otherwise open on Tom's hardship
                // payment (the canonical Payments example), else the first.
                let target = '';
                if (previous && cases.some(c => c.caseNumber === previous)) {
                    target = previous;
                } else {
                    const tom = cases.find(c => c.sampleId === 'hardship-tom');
                    target = tom ? tom.caseNumber : (cases[0] ? cases[0].caseNumber : '');
                }
                select.value = target;
                if (target && (!selected || selected.caseNumber !== target)) {
                    await selectCase(target);
                }
            } catch (err) {
                emptyEl.hidden = false;
                emptyEl.textContent = 'Failed to load cases: ' + err.message;
            }
        }

        async function selectCase(caseNumber) {
            resetResult();
            if (!caseNumber) {
                selected = null;
                inputs = null;
                summaryEl.hidden = true;
                inputsStep.hidden = true;
                processStep.hidden = true;
                return;
            }
            const seq = runSeq;
            try {
                const enc = encodeURIComponent(caseNumber);
                const [caseRes, inputsRes] = await Promise.all([
                    fetch(`/payments/cases/${enc}`),
                    fetch(`/payments/inputs/${enc}`)
                ]);
                if (!caseRes.ok) throw new Error('HTTP ' + caseRes.status);
                if (!inputsRes.ok) throw new Error('HTTP ' + inputsRes.status);
                const caseRecord = await caseRes.json();
                const caseInputs = await inputsRes.json();
                if (seq !== runSeq) return;
                selected = caseRecord;
                inputs = caseInputs;
            } catch (err) {
                selected = null;
                inputs = null;
                summaryEl.hidden = true;
                inputsStep.hidden = true;
                processStep.hidden = true;
                emptyEl.hidden = false;
                emptyEl.textContent = 'Failed to load the case: ' + err.message;
                return;
            }

            renderSummary();
            renderInputs(inputs);
            inputsStep.hidden = false;
            processStep.hidden = false;
        }

        function renderSummary() {
            const c = selected;
            $('#payments-case-num').textContent = c.caseNumber;
            $('#payments-case-member').textContent = (inputs && inputs.memberDisplay) || `${c.clientName} · ${c.memberNumber}`;
            $('#payments-case-product').textContent = c.product || '—';
            $('#payments-case-type').textContent = c.requestType || '—';
            $('#payments-case-received').textContent = c.receivedDate || '—';
            $('#payments-case-adviser').textContent = [c.adviserName, c.adviserPractice].filter(Boolean).join(', ') || '—';
            $('#payments-case-amount').textContent = c.amount || '—';
            $('#payments-case-priority').textContent = c.priority
                ? `${c.priority}${c.priorityReason ? ' — ' + c.priorityReason : ''}`
                : '—';
            $('#payments-case-summary-text').textContent = c.requestSummary || '';
            summaryEl.hidden = false;
        }

        // ── Step 2: payment inputs ───────────────────────────────────

        function fillSelect(sel, options, value) {
            sel.innerHTML = (options || []).map(o => `<option value="${escapeHtml(o.key)}">${escapeHtml(o.label)}</option>`).join('');
            if (value) sel.value = value;
        }

        function setValue(input, v) {
            input.value = (v === null || v === undefined) ? '' : String(v);
        }

        function renderInputs(inp) {
            const f = form.elements;
            fillSelect(f.paymentType, inp.paymentTypes, inp.paymentType);
            setValue(f.grossAmount, inp.grossAmount);
            setValue(f.requestedAmount, inp.requestedAmount);
            setValue(f.commencementAmount, inp.commencementAmount);
            setValue(f.paymentDate, inp.paymentDate);
            setValue(f.taxFreePercent, inp.taxFreePercent);
            setValue(f.memberAge, inp.memberAge);
            fillSelect(f.taxStatus, inp.taxStatuses, inp.taxStatus);
            fillSelect(f.caseApprovalStatus, inp.caseApprovalStatuses, inp.caseApprovalStatus);
            setValue(f.approvedAmount, inp.approvedAmount);

            hintEl.textContent = inp.hint || '';
            hintEl.hidden = !inp.hint;

            decisionEl.innerHTML = inp.caseApprovalNote
                ? `<strong>${escapeHtml(inp.caseDecidedBy || 'Benefits & Eligibility')}</strong> — ${escapeHtml(inp.caseApprovalNote)}` +
                  (inp.caseRuleCited ? `<span class="muted">Rule cited: ${escapeHtml(inp.caseRuleCited)}</span>` : '')
                : '';

            renderPayeeRows(inp.payees || []);
            const onFile = inp.payeesOnFile || [];
            onFileEl.innerHTML = onFile.length
                ? 'On file: ' + onFile.map(p =>
                    `<span class="payments-onfile-chip">${escapeHtml(p.name)}${p.account ? ' · ' + escapeHtml(p.account) : ''}<em>${escapeHtml(p.relationship)}</em></span>`).join('')
                : '';
            applyTypeVisibility();
        }

        function renderPayeeRows(payees) {
            payeeRowsEl.innerHTML = (payees || []).map(p => `
                <div class="payments-payee-row">
                    <input type="text" data-k="name" value="${escapeHtml(p.name)}" aria-label="Name on the account" />
                    <input type="text" data-k="bsb" value="${escapeHtml(p.bsb)}" aria-label="BSB (masked)" />
                    <input type="text" data-k="account" value="${escapeHtml(p.account)}" aria-label="Account number (masked)" />
                    <input type="number" data-k="share" value="${escapeHtml(p.sharePercent)}" min="0" max="100" step="0.01" aria-label="Share %" />
                </div>`).join('');
        }

        function readPayees() {
            return Array.from(payeeRowsEl.querySelectorAll('.payments-payee-row')).map(row => ({
                name: row.querySelector('[data-k="name"]').value.trim(),
                bsb: row.querySelector('[data-k="bsb"]').value.trim(),
                account: row.querySelector('[data-k="account"]').value.trim(),
                sharePercent: numOrNull(row.querySelector('[data-k="share"]').value)
            })).filter(p => p.name);
        }

        function applyTypeVisibility() {
            const type = form.elements.paymentType.value;
            const inbound = type === 'inbound';
            root.querySelectorAll('[data-field="requested"]').forEach(el => { el.hidden = !(type === 'hardship' || type === 'lump-sum'); });
            root.querySelectorAll('[data-field="commencement"]').forEach(el => { el.hidden = type !== 'pension'; });
            root.querySelectorAll('[data-field="tax"]').forEach(el => { el.hidden = inbound; });
            if (!inbound && !payeeRowsEl.querySelector('.payments-payee-row')) {
                renderPayeeRows([{ name: selected ? selected.clientName : '', bsb: '', account: '', sharePercent: 100 }]);
            }
            payeesFieldset.hidden = inbound;
            noPayeeEl.hidden = !inbound;
        }

        function readInputs() {
            const f = form.elements;
            const type = f.paymentType.value;
            const age = numOrNull(f.memberAge.value);
            return {
                caseNumber: selected.caseNumber,
                paymentType: type,
                grossAmount: numOrNull(f.grossAmount.value),
                requestedAmount: (type === 'hardship' || type === 'lump-sum') ? numOrNull(f.requestedAmount.value) : null,
                commencementAmount: type === 'pension' ? numOrNull(f.commencementAmount.value) : null,
                taxFreePercent: numOrNull(f.taxFreePercent.value),
                memberAge: age === null ? null : Math.round(age),
                taxStatus: f.taxStatus.value,
                caseApprovalStatus: f.caseApprovalStatus.value,
                approvedAmount: numOrNull(f.approvedAmount.value),
                paymentDate: f.paymentDate.value.trim() || null,
                payees: type === 'inbound' ? [] : readPayees()
            };
        }

        // ── Step 3: engage the Payments Agent ────────────────────────

        function resetResult() {
            runSeq++;
            stopPolling();
            currentApproval = null;
            resultEl.hidden = true;
            processStatus.hidden = true;
            teamsStatus.hidden = true;
        }

        async function processPayment() {
            if (!selected) return;
            resetResult();
            const seq = runSeq;
            processBtn.disabled = true;
            show(processStatus, 'payments-status', '', '<span class="spinner"></span>Engaging the Payments Agent…');

            try {
                const data = await window.zcAgentStream({
                    url: '/payments/process',
                    body: readInputs(),
                    onDelta: (_chunk, fullText) => {
                        if (seq === runSeq && window.engageTabsStreamNarrative) {
                            window.engageTabsStreamNarrative(engageScope, fullText);
                        }
                    },
                    onError: (msg) => {
                        if (seq === runSeq) {
                            show(processStatus, 'payments-status', 'warn', 'Agent error: ' + escapeHtml(msg) + ' — finishing with the deterministic result…');
                        }
                    }
                });
                if (seq !== runSeq) return;
                if (!data) throw new Error('No response from the Payments Agent');

                const statusText = !data.agentConfigured
                    ? 'Processed — Foundry agent not configured, so the Payments desk ran the payments_* tools deterministically.'
                    : data.agentError
                        ? `Payments Agent unavailable (${shorten(data.agentError, 140)}) — deterministic result shown.`
                        : 'Payments Agent processed the case.';
                show(processStatus, 'payments-status', data.agentError ? 'warn' : '', escapeHtml(statusText));

                renderResult(data);
                if (window.engageTabsRender) window.engageTabsRender(engageScope, data);

                // Team Leader sign-off needed: open the approval popup straight away.
                if (data.flow === 'outbound' && data.humanApprovalRequired && data.paymentApproval) {
                    openModal(data.paymentApproval, { reasons: data.humanApprovalReasons });
                }
            } catch (err) {
                if (seq === runSeq) show(processStatus, 'payments-status', 'error', 'Failed to process: ' + escapeHtml(err.message));
            } finally {
                processBtn.disabled = false;
            }
        }

        function renderResult(data) {
            confirmationBaseTitle = data.confirmationTitle || 'Payment confirmation draft';
            confirmationTitle.textContent = confirmationBaseTitle;
            renderCalc(data.calculation || {}, data.contextRows || []);
            renderChecks(data.crossChecks || []);
            renderApprovalSummary(data);

            teamsPanel.hidden = data.flow !== 'outbound';
            blockedPanel.hidden = data.flow !== 'blocked';
            inboundPanel.hidden = data.flow !== 'inbound';

            currentApproval = null;
            if (data.flow === 'outbound' && data.paymentApproval) {
                renderTeams(data.paymentApproval);
            } else if (data.flow === 'outbound') {
                teamsPanel.hidden = true;
            }

            if (data.flow === 'blocked') {
                const rec = data.paymentApproval;
                blockedText.textContent = data.humanApprovalReason || '';
                blockedRecord.textContent = rec
                    ? `Recorded as ${rec.approvalId} (blocked) — no Teams card raised.${rec.decidedBy ? ' Decision: ' + rec.decidedBy + '.' : ''}`
                    : '';
                blockedHint.textContent = data.releaseBlockedReason || '';
                blockedReleaseBtn.title = data.releaseBlockedReason || 'Release disabled';
            }

            if (data.flow === 'inbound') {
                const calc = data.calculation || {};
                inboundText.textContent = [
                    calc.netDisplay ? `${calc.netDisplay} on arrival.` : '',
                    data.humanApprovalReason
                ].filter(Boolean).join(' ');
            }

            renderMarkdown(confirmationEl, data.paymentConfirmation || '');

            resultEl.hidden = false;
            resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        function renderCalc(calc, contextRows) {
            calcTitle.textContent = calc.title || 'Payment calculation';
            const columns = calc.columns || [];
            calcHead.innerHTML = `<tr><th>Item</th>${columns.map(c => `<th class="amount">${escapeHtml(c)}</th>`).join('')}</tr>`;
            calcBody.innerHTML = (calc.rows || []).map(row => {
                const values = row.values || [];
                const cells = (row.display || []).map((text, i) => {
                    const value = Number(values[i]) || 0;
                    let cls = 'amount';
                    let shown = text;
                    if (row.kind === 'deduct' || row.kind === 'hold') {
                        cls += ' neg';
                        if (value > 0) shown = '−' + text;
                    } else if (row.kind === 'total') {
                        cls += ' pos';
                    }
                    return `<td class="${cls}">${escapeHtml(shown)}</td>`;
                }).join('');
                return `<tr class="kind-${escapeHtml(row.kind)}"><td>${escapeHtml(row.label)}</td>${cells}</tr>`;
            }).join('');

            netEl.className = 'payments-net mode-' + (calc.mode || 'payment');
            netLabel.textContent = calc.netLabel || 'Net payment';
            netAmount.textContent = calc.netDisplay || '';
            contextEl.innerHTML = contextRows.map(r => `<div><dt>${escapeHtml(r.label)}</dt><dd>${escapeHtml(r.value)}</dd></div>`).join('');
            ruleEl.textContent = calc.ruleCited ? 'Rule cited: ' + calc.ruleCited : '';
        }

        function renderChecks(checks) {
            checksList.innerHTML = checks.map(c => `
                <li class="payments-check status-${escapeHtml(c.status)}">
                    <span class="payments-check-icon" aria-hidden="true">${CHECK_ICON[c.status] || '•'}</span>
                    <div class="payments-check-body">
                        <div class="payments-check-head"><strong>${escapeHtml(c.label)}</strong><span class="payments-check-value">${escapeHtml(c.value)}</span></div>
                        <div class="payments-check-detail">${escapeHtml(c.detail)}</div>
                        ${c.source ? `<div class="payments-check-source">${escapeHtml(c.source)}</div>` : ''}
                    </div>
                </li>`).join('');
        }

        function renderApprovalSummary(data) {
            let pillText;
            let pillCls;
            if (data.flow === 'inbound') { pillText = 'Not needed'; pillCls = 'optional'; }
            else if (data.flow === 'blocked') { pillText = 'Release blocked'; pillCls = 'required'; }
            else if (data.humanApprovalRequired) { pillText = 'Team Leader'; pillCls = 'required'; }
            else { pillText = 'Standard sign-off'; pillCls = 'standard'; }
            approvalPill.textContent = pillText;
            approvalPill.className = 'payments-pill ' + pillCls;

            const reasons = (data.humanApprovalReasons && data.humanApprovalReasons.length)
                ? data.humanApprovalReasons
                : [data.humanApprovalReason];
            approvalReasons.innerHTML = reasons.filter(Boolean).map(r => `<li>${escapeHtml(r)}</li>`).join('');
            approvalApprover.textContent = data.approver ? 'Approver: ' + data.approver : '';
            approvalApprover.hidden = !data.approver;
        }

        // ── Microsoft Teams approval (outbound payments) ─────────────

        function renderTeams(a) {
            teamsApprovalId.textContent = a.approvalId;
            if (a.approvalUrl) {
                teamsLink.href = a.approvalUrl;
                teamsLink.textContent = a.approvalUrl;
            } else {
                teamsLink.removeAttribute('href');
                teamsLink.textContent = '(none)';
            }
            teamsMsg.innerHTML = a.teamsSent
                ? `Adaptive Card <strong>"Caldova Wealth — Payment approval"</strong> posted to <strong>#${escapeHtml(a.teamsChannel || 'payment-approvals')}</strong> via <code>teams_sendApprovalCard</code>. ` +
                  'Approve or reject on the card below (the in-page stand-in for the approver\'s Teams client) or open the approval popup.'
                : `The Teams card wasn't sent (${escapeHtml(a.teamsMessage || 'unknown error')}). Use the approval popup instead.`;
            teamsStatus.hidden = true;
            renderTeamsPreview(a);
            updateApprovalState(a);
        }

        function renderTeamsPreview(a) {
            const facts = [
                ['Case number', a.caseNumber],
                ['Member', a.memberDisplay],
                ['Payment type', paymentTypeLine(a)],
                ['Gross amount', a.grossFormatted],
                ['Tax withheld', a.taxWithheldFormatted],
                ['Net payment', a.netFormatted],
                ['Payee', payeeLine(a)],
                ['Payment date', a.paymentDate]
            ].filter(f => f[1]);

            teamsPreview.innerHTML = `
                <div class="tp-channel-head">
                    <span class="tp-logo" aria-hidden="true">T</span>
                    <span>Microsoft Teams · <strong>#${escapeHtml(a.teamsChannel || 'payment-approvals')}</strong></span>
                    <span class="tp-time">${escapeHtml(timeOf(a.createdAt))}</span>
                </div>
                <div class="tp-post">
                    <div class="tp-avatar" aria-hidden="true">P</div>
                    <div class="tp-post-body">
                        <div class="tp-author">Payments Agent (Penny)<span class="tp-app">App</span></div>
                        <div class="tp-card">
                            <div class="tp-card-title">💳 Caldova Wealth — Payment approval</div>
                            <div class="tp-card-sub">Payments Agent (Penny) · ${escapeHtml(a.caseNumber)} · Approval id ${escapeHtml(a.approvalId)}</div>
                            <dl class="tp-facts">${facts.map(f => `<dt>${escapeHtml(f[0])}</dt><dd>${escapeHtml(f[1])}</dd>`).join('')}</dl>
                            <div class="tp-why-title">Why approval is needed</div>
                            <ul class="tp-why">${reasonsOf(a).map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
                            <div class="tp-note">Penny's agent releases this payment only after it is approved. Bank details are masked.</div>
                            <div class="tp-actions" data-tp-actions></div>
                        </div>
                    </div>
                </div>`;
            renderPreviewActions(a);
        }

        function renderPreviewActions(a) {
            const el = teamsPreview.querySelector('[data-tp-actions]');
            if (!el || !a) return;
            const s = (a.status || 'pending').toLowerCase();
            if (s === 'pending') {
                el.innerHTML =
                    '<button type="button" class="tp-btn tp-approve" data-teams-action="approve">Approve</button>' +
                    '<button type="button" class="tp-btn tp-reject" data-teams-action="reject">Reject</button>' +
                    `<a class="tp-btn" href="${escapeHtml(a.approvalUrl || '#')}" target="_blank" rel="noopener">Open case in Caldova</a>`;
                return;
            }
            const who = a.decidedBy ? ` by ${a.decidedBy}` : '';
            const text = {
                approved: `✅ Approved${who}`,
                rejected: `❌ Rejected${who}`,
                released: `✅ Approved${who} · Released ${a.paymentReference || ''}`.trim(),
                blocked: 'Blocked — no funds can leave the account',
                cancelled: 'Superseded by a newer approval'
            }[s] || s;
            el.innerHTML = `<div class="tp-decided tp-${escapeHtml(s)}">${escapeHtml(text)}</div>`;
        }

        function updateApprovalState(a) {
            currentApproval = Object.assign({}, currentApproval || {}, a);
            const s = (currentApproval.status || 'pending').toLowerCase();
            teamsPill.className = 'payments-pill status-' + s;
            teamsPill.textContent = s === 'pending' && !currentApproval.teamsSent ? 'Pending' : (STATUS_TEXT[s] || s);

            // Release stays disabled until a human approval is recorded.
            releaseBtn.disabled = s !== 'approved';
            releaseBtn.textContent = s === 'released' ? 'Released' : 'Release payment';
            releaseHint.textContent = s === 'released' ? releasedText(currentApproval) : (RELEASE_HINT[s] || '');
            popupBtn.disabled = !(s === 'pending' || s === 'approved');

            renderPreviewActions(currentApproval);
            if (s === 'released' && currentApproval.confirmationDraft) {
                renderMarkdown(confirmationEl, currentApproval.confirmationDraft);
            }
            confirmationTitle.textContent = confirmationBaseTitle + (
                s === 'rejected' ? ' — not sent (payment rejected)'
                    : s === 'cancelled' ? ' — superseded'
                        : '');
            if (s === 'pending') startPolling(); else stopPolling();
        }

        // Keep the inline card, the popup and the deep-link banner in step
        // whenever an approval changes.
        function handleApprovalUpdate(a) {
            if (!a || !a.approvalId) return;
            if (currentApproval && currentApproval.approvalId === a.approvalId) updateApprovalState(a);
            syncModal(a);
            if (deeplinkApprovalId === a.approvalId) renderDeeplinkBanner(a);
        }

        async function postJson(url, body) {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body || {})
            });
            let data = {};
            try { data = await res.json(); } catch (_) { /* empty body */ }
            if (!res.ok) {
                if (data && data.approval) handleApprovalUpdate(data.approval);
                throw new Error((data && data.error) || ('HTTP ' + res.status));
            }
            return data;
        }

        async function decide(action) {
            if (!currentApproval) return;
            const approval = currentApproval;
            teamsPreview.querySelectorAll('[data-teams-action]').forEach(b => { b.disabled = true; });
            show(teamsStatus, 'payments-teams-status', '', '<span class="spinner"></span>Recording the decision…');
            try {
                const data = await postJson(
                    `/payments/approvals/${encodeURIComponent(approval.approvalId)}/${action}`,
                    { decidedBy: `${approval.approver || 'Approver'} (in-page Teams fallback)` });
                handleApprovalUpdate(data);
                show(teamsStatus, 'payments-teams-status', '',
                    escapeHtml(`Decision recorded: ${data.status}${data.decidedBy ? ' by ' + data.decidedBy : ''}.`));
            } catch (err) {
                show(teamsStatus, 'payments-teams-status', 'error', 'Failed: ' + escapeHtml(err.message));
                renderPreviewActions(currentApproval);
            }
        }

        async function releaseApproval(approvalId) {
            const data = await postJson(`/payments/approvals/${encodeURIComponent(approvalId)}/release`, {});
            handleApprovalUpdate(data);
            return data;
        }

        async function releaseInline() {
            if (!currentApproval) return;
            releaseBtn.disabled = true;
            show(teamsStatus, 'payments-teams-status', '', '<span class="spinner"></span>Releasing the payment…');
            try {
                const data = await releaseApproval(currentApproval.approvalId);
                show(teamsStatus, 'payments-teams-status', '', escapeHtml(releasedText(data)));
            } catch (err) {
                show(teamsStatus, 'payments-teams-status', 'error', 'Release refused: ' + escapeHtml(err.message));
                if (currentApproval) releaseBtn.disabled = (currentApproval.status || '') !== 'approved';
            }
        }

        // Picks up approvals made elsewhere — e.g. from the Teams card link
        // opened in another tab.
        function startPolling() {
            stopPolling();
            if (!currentApproval) return;
            const id = currentApproval.approvalId;
            pollTimer = setInterval(async () => {
                if (!root.isConnected || !currentApproval || currentApproval.approvalId !== id) {
                    stopPolling();
                    return;
                }
                try {
                    const res = await fetch(`/payments/approvals/${encodeURIComponent(id)}`);
                    if (!res.ok) return;
                    const a = await res.json();
                    if (currentApproval && currentApproval.approvalId === id && a.status !== currentApproval.status) {
                        handleApprovalUpdate(a);
                        show(teamsStatus, 'payments-teams-status', '',
                            escapeHtml(`Approval updated: ${a.status}${a.decidedBy ? ' by ' + a.decidedBy : ''}.`));
                    }
                } catch (_) { /* transient — try again on the next tick */ }
            }, POLL_MS);
        }

        function stopPolling() {
            if (pollTimer) {
                clearInterval(pollTimer);
                pollTimer = null;
            }
        }

        // ── Approval popup ───────────────────────────────────────────

        function openModal(a, opts) {
            if (!a || !a.approvalId) return;
            const options = opts || {};
            modalApproval = a;
            modalTitle.textContent = (a.approver || '').startsWith('Theo') ? 'Team Leader approval required' : 'Payment approval required';
            if (options.decision === 'approve' || options.decision === 'reject') {
                modalDeeplink.hidden = false;
                modalDeeplink.textContent = `You followed the ${options.decision === 'approve' ? 'Approve' : 'Reject'} action on the Microsoft Teams card — confirm it below.`;
            } else {
                modalDeeplink.hidden = true;
            }
            modalReasons.innerHTML = reasonsOf(a, options.reasons).map(r => `<li>${escapeHtml(r)}</li>`).join('');
            modalCase.textContent = a.caseNumber || '';
            modalApprovalId.textContent = a.approvalId;
            modalMember.textContent = a.memberDisplay || a.clientName || '';
            modalType.textContent = paymentTypeLine(a);
            modalPayee.textContent = payeeLine(a);
            modalGross.textContent = a.grossFormatted || fmtMoney(a.grossAmount);
            modalTax.textContent = a.taxWithheldFormatted || fmtMoney(a.taxWithheld);
            modalNet.textContent = a.netFormatted || fmtMoney(a.netAmount);
            modalStatus.hidden = true;
            modalAgent.hidden = true;
            modalAgentBody.innerHTML = '';
            syncModalButtons(a, true);
            modalEl.hidden = false;

            const focusBtn = options.decision === 'reject' ? modalRejectBtn
                : (!modalApproveBtn.disabled ? modalApproveBtn : modalReleaseBtn);
            if (focusBtn && !focusBtn.disabled) focusBtn.focus();
        }

        function syncModalButtons(a, announce) {
            const s = (a.status || 'pending').toLowerCase();
            modalApproveBtn.disabled = s !== 'pending';
            modalRejectBtn.disabled = !(s === 'pending' || s === 'approved');
            modalReleaseBtn.disabled = s !== 'approved';
            modalReleaseBtn.textContent = s === 'released' ? 'Released' : 'Release payment';
            if (announce && s !== 'pending') {
                const who = a.decidedBy ? ` by ${a.decidedBy}` : '';
                const text = {
                    approved: `Already approved${who} — the payment can now be released.`,
                    rejected: `Rejected${who} — this payment will not be released.`,
                    released: releasedText(a),
                    blocked: 'Blocked — no funds can leave the account.',
                    cancelled: 'Superseded by a newer approval for this case.'
                }[s] || s;
                show(modalStatus, 'payments-modal-status', '', escapeHtml(text));
            }
        }

        function syncModal(a) {
            if (!modalApproval || modalEl.hidden || modalApproval.approvalId !== a.approvalId) return;
            modalApproval = Object.assign({}, modalApproval, a);
            syncModalButtons(modalApproval, false);
        }

        function closeModal() {
            modalEl.hidden = true;
            modalApproval = null;
        }

        async function approveViaModal() {
            if (!modalApproval) return;
            const a = modalApproval;
            modalApproveBtn.disabled = true;
            modalRejectBtn.disabled = true;
            modalReleaseBtn.disabled = true;
            show(modalStatus, 'payments-modal-status', '', '<span class="spinner"></span>Approving and resuming the Payments Agent conversation…');
            try {
                const data = await postJson(
                    `/payments/approvals/${encodeURIComponent(a.approvalId)}/agent-approve`,
                    { decidedBy: `${a.approver || 'Approver'} (approval popup)` });
                const approval = data.approval || {};
                handleApprovalUpdate(approval);
                if (data.agentNarrative) {
                    modalAgent.hidden = false;
                    renderMarkdown(modalAgentBody, data.agentNarrative);
                }
                const parts = [];
                if ((approval.status || '') === 'released') {
                    parts.push(releasedText(approval));
                } else {
                    parts.push(`Approval recorded${approval.decidedBy ? ' by ' + approval.decidedBy : ''}.`);
                }
                if (data.agentError) parts.push(`Agent resume failed (${shorten(data.agentError, 140)}) — release the payment below.`);
                else if (!data.agentConfigured) parts.push('Foundry agent not configured — release the payment below.');
                else if (!data.agentResumeAttempted) parts.push('No agent conversation to resume — release the payment below.');
                show(modalStatus, 'payments-modal-status', '', escapeHtml(parts.join(' ')));
                if (!modalReleaseBtn.disabled) modalReleaseBtn.focus();
            } catch (err) {
                show(modalStatus, 'payments-modal-status', 'error', 'Failed: ' + escapeHtml(err.message));
                if (modalApproval) syncModalButtons(modalApproval, false);
            }
        }

        async function rejectViaModal() {
            if (!modalApproval) return;
            const a = modalApproval;
            modalApproveBtn.disabled = true;
            modalRejectBtn.disabled = true;
            modalReleaseBtn.disabled = true;
            show(modalStatus, 'payments-modal-status', '', '<span class="spinner"></span>Recording the rejection…');
            try {
                const data = await postJson(
                    `/payments/approvals/${encodeURIComponent(a.approvalId)}/reject`,
                    { decidedBy: `${a.approver || 'Approver'} (approval popup)` });
                handleApprovalUpdate(data);
                show(modalStatus, 'payments-modal-status', '',
                    escapeHtml(`Rejected${data.decidedBy ? ' by ' + data.decidedBy : ''} — this payment will not be released.`));
            } catch (err) {
                show(modalStatus, 'payments-modal-status', 'error', 'Failed: ' + escapeHtml(err.message));
                if (modalApproval) syncModalButtons(modalApproval, false);
            }
        }

        async function releaseViaModal() {
            if (!modalApproval) return;
            modalReleaseBtn.disabled = true;
            show(modalStatus, 'payments-modal-status', '', '<span class="spinner"></span>Releasing the payment…');
            try {
                const data = await releaseApproval(modalApproval.approvalId);
                show(modalStatus, 'payments-modal-status', '', escapeHtml(releasedText(data)));
            } catch (err) {
                show(modalStatus, 'payments-modal-status', 'error', 'Release refused: ' + escapeHtml(err.message));
                if (modalApproval) syncModalButtons(modalApproval, false);
            }
        }

        // ── Teams card deep link: ?approvalId=PAY-…[&decision=…] ─────

        function renderDeeplinkBanner(a) {
            show(deeplinkEl, 'payments-deeplink', '',
                `Opened from the Microsoft Teams approval card — <strong>${escapeHtml(a.approvalId)}</strong> for case ${escapeHtml(a.caseNumber)} (${escapeHtml(STATUS_TEXT[a.status] || a.status)}).`);
        }

        async function handleDeepLink() {
            const params = new URLSearchParams(window.location.search);
            const approvalId = params.get('approvalId');
            const caseParam = params.get('caseNumber');
            const tryTab = document.querySelector('.agent-tab-scope .agent-tab[data-tab="try"]');
            if ((approvalId || caseParam) && tryTab && !tryTab.classList.contains('active')) tryTab.click();
            if (!approvalId) return caseParam;

            try {
                const res = await fetch(`/payments/approvals/${encodeURIComponent(approvalId)}`);
                let a = {};
                try { a = await res.json(); } catch (_) { /* not JSON */ }
                if (!res.ok) throw new Error((a && a.error) || ('HTTP ' + res.status));
                deeplinkApprovalId = a.approvalId;
                renderDeeplinkBanner(a);
                openModal(a, { decision: (params.get('decision') || '').toLowerCase() });
                return a.caseNumber;
            } catch (err) {
                show(deeplinkEl, 'payments-deeplink', 'error',
                    'This approval link could not be opened: ' + escapeHtml(err.message) +
                    '. Approvals are held in memory, so they reset when the app restarts.');
                return null;
            }
        }

        // ── Wiring ───────────────────────────────────────────────────

        select.addEventListener('change', () => selectCase(select.value));
        refreshBtn.addEventListener('click', () => loadCases());
        form.addEventListener('submit', ev => ev.preventDefault());
        form.elements.paymentType.addEventListener('change', applyTypeVisibility);
        processBtn.addEventListener('click', processPayment);
        teamsPreview.addEventListener('click', ev => {
            const btn = ev.target.closest('[data-teams-action]');
            if (!btn) return;
            ev.preventDefault();
            decide(btn.dataset.teamsAction);
        });
        popupBtn.addEventListener('click', () => { if (currentApproval) openModal(currentApproval); });
        releaseBtn.addEventListener('click', releaseInline);
        modalApproveBtn.addEventListener('click', approveViaModal);
        modalRejectBtn.addEventListener('click', rejectViaModal);
        modalReleaseBtn.addEventListener('click', releaseViaModal);
        modalEl.addEventListener('click', ev => {
            if (ev.target && ev.target.closest && ev.target.closest('[data-modal-dismiss]')) closeModal();
        });
        if (escHandler) document.removeEventListener('keydown', escHandler);
        escHandler = ev => {
            if (ev.key === 'Escape' && !modalEl.hidden) closeModal();
        };
        document.addEventListener('keydown', escHandler);

        handleDeepLink().then(preferred => loadCases(preferred));
    }

    init();

    if (!window.__paymentsDemoEnhancedHook) {
        window.__paymentsDemoEnhancedHook = true;
        const hook = () => init();
        if (typeof Blazor !== 'undefined' && typeof Blazor.addEventListener === 'function') {
            Blazor.addEventListener('enhancedload', hook);
        } else {
            document.addEventListener('enhancedload', hook);
        }
    }
})();
