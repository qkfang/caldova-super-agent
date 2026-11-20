// Onboarding "Try it out" demo wiring (/agents/onboarding).
//
// Loaded globally from App.razor so it runs on a full page load AND re-binds
// after Blazor enhanced navigation (`enhancedload`) — inline <script> tags in
// enhanced-navigated pages are not reliably executed.
//
// Flow: 1 pick a sample inbound request → 2 engage the Onboarding Agent
// (streamed narrative + engage sub-tabs) → 3 review the Member Case form,
// NIGO checklist and priority → 4 open the case (REQ-…) and show where it
// is routed. Endpoints: /onboarding/samples, /onboarding/samples/{id},
// /onboarding/process, /onboarding/routing, /onboarding/submit.
(function () {
    const FIELD_NAMES = [
        'clientName', 'clientEmail', 'clientPhone', 'memberNumber', 'product', 'requestType',
        'receivedDate', 'amount', 'adviserName', 'adviserPractice', 'requestSummary', 'preferredContact'
    ];

    function escapeHtml(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function init() {
        const root = document.querySelector('.intake-panel');
        if (!root || root.dataset.wired === '1') return;
        root.dataset.wired = '1';

        const $ = sel => root.querySelector(sel);
        const samplesEl = $('#intake-samples');
        const previewEl = $('#intake-preview');
        const step2El = $('#intake-step-2');
        const step3El = $('#intake-step-3');
        const processBtn = $('#intake-process-btn');
        const processStatus = $('#intake-process-status');
        const engageScope = $('.engage-tabs-scope');
        const formWrap = $('#intake-form-wrap');
        const form = $('#intake-form');
        const requestTypeSelect = $('#intake-request-type');
        const nigoList = $('#intake-nigo-list');
        const nigoSummary = $('#intake-nigo-summary');
        const priorityEl = $('#intake-priority');
        const prioritySelect = $('#intake-priority-select');
        const priorityPill = $('#intake-priority-pill');
        const priorityReason = $('#intake-priority-reason');
        const routingPreview = $('#intake-routing-preview');
        const routingPreviewList = $('#intake-routing-preview-list');
        const submitBtn = $('#intake-submit-btn');
        const receipt = $('#intake-receipt');
        const receiptNum = $('#intake-receipt-num');
        const receiptMeta = $('#intake-receipt-meta');
        const routesEl = $('#intake-routes');
        const outstandingEl = $('#intake-outstanding');
        const resetBtn = $('#intake-reset-btn');

        const SUBMIT_LABEL = '<span class="intake-step-num inline">4</span>Confirm &amp; open case';

        let selectedSampleId = null;
        let processed = null;
        let routingRequestSeq = 0;

        async function loadSamples() {
            samplesEl.innerHTML = '<div class="muted">Loading samples…</div>';
            try {
                const res = await fetch('/onboarding/samples');
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const samples = await res.json();
                samplesEl.innerHTML = samples.map(s => `
                    <button type="button" class="intake-sample" data-id="${escapeHtml(s.id)}">
                        <div class="intake-sample-label">${escapeHtml(s.label)}</div>
                        <div class="intake-sample-meta"><span class="pill">${escapeHtml(s.requestType)}</span></div>
                        <div class="intake-sample-meta">📧 ${escapeHtml(s.emailSubject)}</div>
                        <div class="intake-sample-meta">📎 ${escapeHtml(s.formFileName)}</div>
                    </button>`).join('');
                samplesEl.querySelectorAll('.intake-sample').forEach(el => {
                    el.addEventListener('click', () => selectSample(el.dataset.id));
                });
            } catch (err) {
                samplesEl.innerHTML = `<div class="intake-status error">Failed to load samples: ${escapeHtml(err.message)}</div>`;
            }
        }

        function hideResults() {
            processStatus.hidden = true;
            formWrap.hidden = true;
            priorityEl.hidden = true;
            routingPreview.hidden = true;
            // Step 3 only re-appears once the agent has processed the sample.
            if (step3El) step3El.hidden = true;
            receipt.hidden = true;
        }

        async function selectSample(id) {
            selectedSampleId = id;
            processed = null;
            samplesEl.querySelectorAll('.intake-sample').forEach(el => {
                el.classList.toggle('selected', el.dataset.id === id);
            });
            hideResults();

            try {
                const res = await fetch(`/onboarding/samples/${encodeURIComponent(id)}`);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const s = await res.json();
                $('#intake-email-from').textContent = s.emailFrom;
                $('#intake-email-date').textContent = s.emailDate;
                $('#intake-email-subject').textContent = s.emailSubject;
                $('#intake-email-body').textContent = s.emailBody;
                $('#intake-form-name').textContent = s.formFileName;
                $('#intake-form-body').textContent = s.formDocumentText;
                previewEl.hidden = false;
                if (step2El) step2El.hidden = false;
                processBtn.disabled = false;
            } catch (err) {
                previewEl.hidden = true;
                processBtn.disabled = true;
                processStatus.hidden = false;
                processStatus.className = 'intake-status error';
                processStatus.textContent = 'Failed to load sample: ' + err.message;
            }
        }

        function setRequestType(value) {
            const v = value || '';
            if (v && !Array.from(requestTypeSelect.options).some(o => o.value === v)) {
                const opt = document.createElement('option');
                opt.value = v;
                opt.textContent = v;
                requestTypeSelect.appendChild(opt);
            }
            requestTypeSelect.value = v;
        }

        function fillForm(fields) {
            const f = fields || {};
            FIELD_NAMES.forEach(name => {
                if (name === 'requestType') return;
                const input = form.elements.namedItem(name);
                if (input) input.value = f[name] || '';
            });
            setRequestType(f.requestType);
        }

        function renderNigo(items) {
            const list = Array.isArray(items) ? items : [];
            nigoList.innerHTML = list.map((n, i) => {
                const status = n.status === 'ok' ? 'ok' : 'action';
                return `
                <li class="intake-nigo-item ${status}" data-id="${escapeHtml(n.id)}" data-label="${escapeHtml(n.label)}">
                    <select class="intake-nigo-status" aria-label="Status for ${escapeHtml(n.label)}">
                        <option value="ok"${status === 'ok' ? ' selected' : ''}>✅ In good order</option>
                        <option value="action"${status === 'action' ? ' selected' : ''}>⚠️ Needs action</option>
                    </select>
                    <div class="intake-nigo-text">
                        <div class="intake-nigo-label">${escapeHtml(n.label)}</div>
                        <input class="intake-nigo-note" id="intake-nigo-note-${i}" value="${escapeHtml(n.note)}" aria-label="Note for ${escapeHtml(n.label)}" />
                    </div>
                </li>`;
            }).join('') || '<li class="muted">No NIGO checks returned.</li>';
            updateNigoSummary();
        }

        function readNigo() {
            return Array.from(nigoList.querySelectorAll('.intake-nigo-item')).map(li => ({
                id: li.dataset.id || '',
                label: li.dataset.label || '',
                status: li.querySelector('.intake-nigo-status').value,
                note: li.querySelector('.intake-nigo-note').value
            }));
        }

        function updateNigoSummary() {
            const items = readNigo();
            const ok = items.filter(n => n.status === 'ok').length;
            const action = items.length - ok;
            nigoSummary.innerHTML = items.length
                ? `<span class="ok">${ok} in good order</span> · <span class="action">${action} need${action === 1 ? 's' : ''} action</span>`
                : '';
        }

        function setPriority(level, reason) {
            const value = ['Standard', 'High', 'Urgent'].includes(level) ? level : 'Standard';
            prioritySelect.value = value;
            if (typeof reason === 'string') priorityReason.value = reason;
            updatePriorityPill();
        }

        function updatePriorityPill() {
            const level = prioritySelect.value || 'Standard';
            priorityPill.textContent = level;
            priorityPill.className = 'intake-priority-pill ' + level.toLowerCase();
        }

        function renderRoutingPreview(routing) {
            const routes = Array.isArray(routing) ? routing : [];
            routingPreviewList.innerHTML = routes.map(r => `
                <span class="other-agent${r.primary ? ' primary' : ''}" title="${escapeHtml(r.reason)}">
                    <span class="other-agent-icon" aria-hidden="true">${escapeHtml(r.icon)}</span>${escapeHtml(r.department)}
                </span>`).join('');
            routingPreview.hidden = routes.length === 0;
        }

        async function refreshRoutingPreview() {
            const seq = ++routingRequestSeq;
            try {
                const res = await fetch('/onboarding/routing?requestType=' + encodeURIComponent(requestTypeSelect.value || ''));
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const data = await res.json();
                if (seq === routingRequestSeq) renderRoutingPreview(data.routing);
            } catch (_) {
                // Keep the previous preview — the server recomputes routing on submit anyway.
            }
        }

        async function processSample() {
            if (!selectedSampleId) return;
            processBtn.disabled = true;
            hideResults();
            processStatus.hidden = false;
            processStatus.className = 'intake-status';
            processStatus.innerHTML = '<span class="spinner"></span>Engaging Onboarding Agent…';

            try {
                const data = await window.zcAgentStream({
                    url: '/onboarding/process',
                    body: { sampleId: selectedSampleId },
                    onDelta: (_chunk, fullText) => {
                        // Stream the agent's text into the "Agent Narrative" tab as it arrives.
                        if (window.engageTabsStreamNarrative) {
                            window.engageTabsStreamNarrative(engageScope, fullText);
                        }
                    },
                    onError: (msg) => {
                        processStatus.className = 'intake-status error';
                        processStatus.textContent = 'Agent error: ' + msg;
                    }
                });
                if (!data) throw new Error('No response from agent');
                processed = data;

                if (data.agentError) {
                    processStatus.className = 'intake-status warn';
                    processStatus.textContent = 'Onboarding Agent unavailable (' + data.agentError + ') — showing the offline extraction.';
                } else {
                    processStatus.className = 'intake-status';
                    processStatus.textContent = data.agentConfigured
                        ? 'Onboarding Agent processed the email and the attached form.'
                        : 'Processed (Foundry agent not configured — using the offline extraction).';
                }

                fillForm(data.fields);
                renderNigo(data.nigo);
                setPriority(data.priority, data.priorityReason || '');
                renderRoutingPreview(data.routing);

                if (step3El) step3El.hidden = false;
                formWrap.hidden = false;
                priorityEl.hidden = false;

                // Surface the narrative, input and raw output in the engage sub-tabs.
                if (window.engageTabsRender) {
                    window.engageTabsRender(engageScope, data);
                }
            } catch (err) {
                processStatus.className = 'intake-status error';
                processStatus.textContent = 'Failed to process: ' + err.message;
            } finally {
                processBtn.disabled = false;
            }
        }

        function renderReceipt(data) {
            const caseNumber = data.caseNumber || '';
            receiptNum.textContent = caseNumber;
            receiptMeta.innerHTML = [
                escapeHtml(data.clientName),
                escapeHtml(data.memberNumber),
                escapeHtml(data.requestType),
                'Priority: <strong>' + escapeHtml(data.priority) + '</strong>'
            ].filter(Boolean).join('<span class="sep">·</span>');

            const routes = Array.isArray(data.routing) ? data.routing : [];
            routesEl.innerHTML = routes.map(r => {
                const href = (r.url || ('/agents/' + r.agentId)) + '?case=' + encodeURIComponent(caseNumber);
                return `
                <a class="intake-route" href="${escapeHtml(href)}" style="--route-accent: ${escapeHtml(r.accent || '#0ea5e9')}">
                    <div class="intake-route-head">
                        <span class="intake-route-icon" aria-hidden="true">${escapeHtml(r.icon)}</span>
                        <span class="intake-route-dept">${escapeHtml(r.department)}</span>
                        <span class="intake-route-tag${r.primary ? '' : ' parallel'}">${r.primary ? 'Next' : 'Also told'}</span>
                    </div>
                    <div class="intake-route-persona">${escapeHtml(r.persona)}</div>
                    <div class="intake-route-reason">${escapeHtml(r.reason)}</div>
                    <div class="intake-route-cta">Open ${escapeHtml(r.agentName)} →</div>
                </a>`;
            }).join('');

            const outstanding = Array.isArray(data.outstandingNigo) ? data.outstandingNigo : [];
            if (outstanding.length) {
                outstandingEl.innerHTML =
                    `⚠️ <strong>${outstanding.length} NIGO item${outstanding.length === 1 ? '' : 's'} to follow up</strong> ` +
                    `(${escapeHtml(data.nigoInGoodOrder)} of ${escapeHtml(data.nigoTotal)} checks in good order):` +
                    '<ul>' + outstanding.map(n => `<li><strong>${escapeHtml(n.label)}</strong> — ${escapeHtml(n.note)}</li>`).join('') + '</ul>';
                outstandingEl.hidden = false;
            } else {
                outstandingEl.innerHTML = '';
                outstandingEl.hidden = true;
            }
        }

        async function submitForm(ev) {
            ev.preventDefault();
            if (!selectedSampleId || !processed) return;
            if (!form.reportValidity()) return;
            submitBtn.disabled = true;
            submitBtn.textContent = 'Opening case…';
            try {
                const payload = { sampleId: selectedSampleId };
                FIELD_NAMES.forEach(name => {
                    const input = form.elements.namedItem(name);
                    payload[name] = input ? input.value : '';
                });
                payload.priority = prioritySelect.value;
                payload.priorityReason = priorityReason.value;
                payload.nigo = readNigo();

                const res = await fetch('/onboarding/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
                renderReceipt(data);
                receipt.hidden = false;
                receipt.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch (err) {
                alert('Failed to open the case: ' + err.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = SUBMIT_LABEL;
            }
        }

        function reset() {
            selectedSampleId = null;
            processed = null;
            samplesEl.querySelectorAll('.intake-sample').forEach(el => el.classList.remove('selected'));
            previewEl.hidden = true;
            processBtn.disabled = true;
            hideResults();
            // Re-hide step 2 so the demo restarts at step 1 only.
            if (step2El) step2El.hidden = true;
            form.reset();
            nigoList.innerHTML = '';
            nigoSummary.innerHTML = '';
            routingPreviewList.innerHTML = '';
            samplesEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        nigoList.addEventListener('change', e => {
            const select = e.target.closest('.intake-nigo-status');
            if (!select) return;
            const li = select.closest('.intake-nigo-item');
            li.classList.toggle('ok', select.value === 'ok');
            li.classList.toggle('action', select.value !== 'ok');
            updateNigoSummary();
        });
        prioritySelect.addEventListener('change', updatePriorityPill);
        requestTypeSelect.addEventListener('change', refreshRoutingPreview);
        processBtn.addEventListener('click', processSample);
        form.addEventListener('submit', submitForm);
        resetBtn.addEventListener('click', reset);

        loadSamples();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    if (!window.__onboardingDemoEnhancedHook) {
        window.__onboardingDemoEnhancedHook = true;
        if (typeof Blazor !== 'undefined' && typeof Blazor.addEventListener === 'function') {
            Blazor.addEventListener('enhancedload', init);
        } else {
            document.addEventListener('enhancedload', init);
        }
    }
})();
