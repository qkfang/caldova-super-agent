// Drives the "Try it out" tab on the Financial Crime Agent page
// (/agents/financial-crime): pick a case → review its account activity →
// scan the documents on the case → engage Felix's agent → risk summary.
// Loaded as a permanent script from App.razor so init runs reliably on full
// page load AND on Blazor enhanced navigation (inline <script> tags inside
// razor pages don't re-execute on enhanced navigation).
(function () {
    function init() {
        const root = document.querySelector('.fc-panel');
        if (!root || root.dataset.wired === '1') return;
        root.dataset.wired = '1';

        const $ = sel => root.querySelector(sel);
        const selectEl = $('#fc-case-select');
        const refreshBtn = $('#fc-refresh-btn');
        const emptyEl = $('#fc-empty');
        const caseStep = $('#fc-case-step');
        const caseDetails = $('#fc-case-details');
        const timelineEl = $('#fc-timeline');
        const screeningEl = $('#fc-screening');
        const partiesEl = $('#fc-parties');
        const docsStep = $('#fc-docs-step');
        const docsGrid = $('#fc-case-docs');
        const sampleHost = $('#fc-sample-host');
        const scanBtn = $('#fc-scan-btn');
        const scanStatus = $('#fc-scan-status');
        const docOutputEl = $('#fc-doc-output');
        const docOutputHint = $('#fc-doc-output-hint');
        const docCardsEl = $('#fc-doc-cards');
        const processStep = $('#fc-process-step');
        const processBtn = $('#fc-process-btn');
        const processStatus = $('#fc-process-status');
        const outputStep = $('#fc-output-step');
        const riskPill = $('#fc-risk-pill');
        const riskNum = $('#fc-risk-num');
        const riskSummary = $('#fc-risk-summary');
        const agentView = $('#fc-agent-view');
        const indicatorsEl = $('#fc-indicators');
        const breakdownEl = $('#fc-score-breakdown');
        const actionsEl = $('#fc-actions');
        const clearEl = $('#fc-clear');
        const approvalEl = $('#fc-approval');
        const smrEl = $('#fc-smr');
        const engageScope = $('.engage-tabs-scope');

        let cases = [];
        let selectedCase = null;
        // Documents attached to the selected case:
        // id -> { id, label, kind, src, selected, removable }
        let caseDocs = new Map();
        // Specimen manifest, lazy-loaded once.
        let sampleManifest = null;

        const KIND_LABELS = {
            'driver-licence': 'Driver licence',
            'passport': 'Passport',
            'bank-statement': 'Bank statement',
            'smsf-registration': 'SMSF registration',
            'death-certificate': 'Death certificate',
            'income-support-letter': 'Income support letter',
        };
        const kindLabel = kind => KIND_LABELS[kind] || String(kind || '').replace(/-/g, ' ');
        // "a driver licence", "an SMSF registration", "an income support letter"
        const kindWithArticle = kind => {
            const label = kindLabel(kind);
            const noun = /^[A-Z]{2}/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1);
            return (/^(SMSF|[aeiou])/i.test(noun) ? 'an ' : 'a ') + noun;
        };

        function escapeHtml(s) {
            return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        }

        function row(k, v, span) {
            return `<div class="${span ? 'span-2' : ''}"><span class="k">${escapeHtml(k)}</span><span>${escapeHtml(v || '—')}</span></div>`;
        }

        function statusIcon(status) {
            switch ((status || '').toLowerCase()) {
                case 'pass': return '<span class="fc-icon pass" aria-label="Passed">✓</span>';
                case 'fail': return '<span class="fc-icon fail" aria-label="Failed">✗</span>';
                case 'warn': return '<span class="fc-icon warn" aria-label="Needs attention">⚠</span>';
                case 'info': return '<span class="fc-icon info" aria-label="Information">ℹ</span>';
                default: return '<span class="fc-icon na" aria-label="Not applicable">–</span>';
            }
        }

        // ── Step 2 — case review ─────────────────────────────────
        function renderCase(c) {
            const adviser = c.adviserPractice ? `${c.adviserName} (${c.adviserPractice})` : c.adviserName;
            caseDetails.innerHTML =
                row('Case', c.caseNumber) +
                row('Received', c.receivedDate) +
                row('Member / client', c.clientName) +
                row('Member no.', c.memberNumber) +
                row('Product', c.product) +
                row('Request type', c.requestType) +
                row('Amount', c.amount) +
                row('Adviser', adviser) +
                row('Priority', c.priority ? `${c.priority} — ${c.priorityReason || ''}` : '', true) +
                row('Summary', c.requestSummary, true);
        }

        function renderTimeline(events) {
            if (!events || !events.length) {
                timelineEl.innerHTML = '<li class="fc-muted-item">No account activity recorded.</li>';
                return;
            }
            timelineEl.innerHTML = events.map(e => `
                <li class="flag-${escapeHtml(e.flag || 'info')}">
                    <div class="fc-tl-when">${escapeHtml(e.when)}</div>
                    <div>
                        <div class="fc-tl-channel">${escapeHtml(e.channel)}</div>
                        <div class="fc-tl-summary">${escapeHtml(e.summary)}</div>
                        <div class="fc-tl-detail">${escapeHtml(e.detail)}</div>
                    </div>
                </li>`).join('');
        }

        function renderScreening(results) {
            screeningEl.innerHTML = (results && results.length)
                ? results.map(s => `<li>${statusIcon(s.status)}<div><span class="fc-check-name">${escapeHtml(s.check)}</span> — ${escapeHtml(s.result)}</div></li>`).join('')
                : '<li class="fc-muted-item">No screening results on this case.</li>';
        }

        function renderParties(activity) {
            const parties = (activity.parties || []).map(p =>
                `<span class="fc-party">${escapeHtml(p.name)} <small>· ${escapeHtml(p.role)}${p.dateOfBirth ? ' · DOB ' + escapeHtml(p.dateOfBirth) : ''}</small></span>`).join('');
            const smsf = activity.receivingSmsf
                ? `<p class="fc-trusted">SMSF named on the request: <strong style="color:#b45309">${escapeHtml(activity.receivingSmsf.fundName)}</strong> · ABN ${escapeHtml(activity.receivingSmsf.abn)} · ESA ${escapeHtml(activity.receivingSmsf.esa)}</p>`
                : '';
            partiesEl.innerHTML =
                `<div class="fc-parties">${parties || '<span class="fc-muted-item">No parties recorded.</span>'}</div>` +
                `<p class="fc-trusted">Trusted contact for call-backs: <strong>${escapeHtml(activity.verifiedContact || '—')}</strong></p>` +
                smsf;
        }

        async function loadActivity(caseNumber) {
            timelineEl.innerHTML = '<li class="fc-muted-item">Loading…</li>';
            screeningEl.innerHTML = '<li class="fc-muted-item">Loading…</li>';
            partiesEl.innerHTML = '<span class="fc-muted-item">Loading…</span>';
            try {
                const res = await fetch(`/fincrime/cases/${encodeURIComponent(caseNumber)}/activity`);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const activity = await res.json();
                if (!selectedCase || selectedCase.caseNumber !== caseNumber) return;
                renderTimeline(activity.timeline);
                renderScreening(activity.screening);
                renderParties(activity);
            } catch (err) {
                timelineEl.innerHTML = `<li class="fc-muted-item">Failed to load account activity: ${escapeHtml(err.message)}</li>`;
                screeningEl.innerHTML = '';
                partiesEl.innerHTML = '';
            }
        }

        // ── Lightbox (case documents, specimen popover and result cards) ──
        function ensureLightbox() {
            let lb = document.getElementById('fc-lightbox');
            if (lb) return lb;
            lb = document.createElement('div');
            lb.id = 'fc-lightbox';
            lb.className = 'fc-lightbox';
            lb.innerHTML = '<button class="fc-lightbox-close" type="button" aria-label="Close">&times;</button><img alt="" />';
            document.body.appendChild(lb);
            lb.addEventListener('click', e => {
                if (e.target === lb || e.target.classList.contains('fc-lightbox-close')) lb.classList.remove('open');
            });
            document.addEventListener('keydown', e => { if (e.key === 'Escape') lb.classList.remove('open'); });
            return lb;
        }
        function openLightbox(src, alt) {
            const lb = ensureLightbox();
            const img = lb.querySelector('img');
            img.src = src;
            img.alt = alt || 'Document preview';
            lb.classList.add('open');
        }

        // ── Step 3 — case documents ──────────────────────────────
        function renderCaseDocs() {
            if (caseDocs.size === 0) {
                docsGrid.innerHTML = '<div class="fc-doc-empty muted">No documents on this case yet — add a specimen from the popover →</div>';
                return;
            }
            docsGrid.innerHTML = Array.from(caseDocs.values()).map(d => `
                <div class="fc-doc-tile ${d.selected ? 'selected' : ''}" data-doc-id="${escapeHtml(d.id)}">
                    ${d.removable ? '<button type="button" class="fc-doc-remove" title="Remove from case" aria-label="Remove from case">✕</button>' : ''}
                    <img src="${escapeHtml(d.src)}" alt="${escapeHtml(d.label)}" loading="lazy" />
                    <div class="fc-doc-kind">${escapeHtml(kindLabel(d.kind))}</div>
                    <div class="fc-doc-title">${escapeHtml(d.label)}</div>
                    <label class="fc-doc-toggle">
                        <input type="checkbox" ${d.selected ? 'checked' : ''} />
                        <span>Include in review</span>
                    </label>
                </div>`).join('');
            docsGrid.querySelectorAll('.fc-doc-tile').forEach(tile => {
                const id = tile.dataset.docId;
                const img = tile.querySelector('img');
                img.addEventListener('click', () => openLightbox(img.src, img.alt));
                const cb = tile.querySelector('input[type="checkbox"]');
                cb.addEventListener('change', () => {
                    const d = caseDocs.get(id);
                    if (d) { d.selected = cb.checked; tile.classList.toggle('selected', d.selected); }
                });
                const removeBtn = tile.querySelector('.fc-doc-remove');
                if (removeBtn) {
                    removeBtn.addEventListener('click', () => {
                        caseDocs.delete(id);
                        renderCaseDocs();
                        refreshSampleButtons();
                    });
                }
            });
        }

        async function loadCaseDocs(caseNumber) {
            docsGrid.innerHTML = '<div class="fc-doc-empty muted">Loading case documents…</div>';
            caseDocs = new Map();
            try {
                const res = await fetch(`/fincrime/cases/${encodeURIComponent(caseNumber)}/documents`);
                if (res.ok) {
                    const docs = await res.json();
                    if (!selectedCase || selectedCase.caseNumber !== caseNumber) return;
                    docs.forEach(d => caseDocs.set(d.id, { ...d, selected: true, removable: false }));
                }
            } catch (err) {
                console.warn('Financial crime case documents failed to load', err);
            }
            renderCaseDocs();
            renderSamplePopover();
        }

        async function ensureSampleManifest() {
            if (sampleManifest) return sampleManifest;
            try {
                const res = await fetch('/fincrime/samples');
                sampleManifest = res.ok ? await res.json() : [];
            } catch {
                sampleManifest = [];
            }
            return sampleManifest;
        }

        function renderSamplePopover() {
            sampleHost.innerHTML = `
                <button type="button" class="fc-sample-trigger" aria-haspopup="dialog">📎 Add specimen documents</button>
                <div class="fc-sample-popover" role="dialog" aria-label="Specimen documents">
                    <div class="fc-sample-popover-title">Specimen documents</div>
                    <div class="fc-sample-popover-hint">Click an image to preview it, or "Add" to attach it to this case. All specimens are fictional.</div>
                    <div class="fc-sample-grid"><div class="muted" style="padding:0.4rem;">Loading specimens…</div></div>
                </div>`;
            const trigger = sampleHost.querySelector('.fc-sample-trigger');
            const popover = sampleHost.querySelector('.fc-sample-popover');
            const grid = sampleHost.querySelector('.fc-sample-grid');

            trigger.addEventListener('click', async () => {
                const willOpen = !popover.classList.contains('open');
                popover.classList.toggle('open', willOpen);
                if (!willOpen) return;
                const samples = await ensureSampleManifest();
                if (!samples.length) {
                    grid.innerHTML = '<div class="muted" style="padding:0.4rem;">No specimens available.</div>';
                    return;
                }
                grid.innerHTML = samples.map(s => `
                    <div class="fc-sample-tile" data-sample-id="${escapeHtml(s.id)}">
                        <img src="${escapeHtml(s.src)}" alt="${escapeHtml(s.label)}" loading="lazy" />
                        <div class="fc-sample-expected">${escapeHtml(kindLabel(s.kind))} · case file: ${escapeHtml(s.expected)}</div>
                        <div class="fc-sample-label">${escapeHtml(s.label)}</div>
                        <button type="button" class="fc-sample-add"></button>
                    </div>`).join('');
                grid.querySelectorAll('.fc-sample-tile').forEach(tile => {
                    const sample = samples.find(s => s.id === tile.dataset.sampleId);
                    const img = tile.querySelector('img');
                    img.addEventListener('click', () => openLightbox(img.src, img.alt));
                    tile.querySelector('.fc-sample-add').addEventListener('click', () => {
                        if (!sample || caseDocs.has(sample.id)) return;
                        caseDocs.set(sample.id, {
                            id: sample.id, label: sample.label, kind: sample.kind, src: sample.src,
                            selected: true, removable: true,
                        });
                        renderCaseDocs();
                        refreshSampleButtons();
                    });
                });
                refreshSampleButtons();
            });
        }

        function refreshSampleButtons() {
            sampleHost.querySelectorAll('.fc-sample-tile').forEach(tile => {
                const btn = tile.querySelector('.fc-sample-add');
                const attached = caseDocs.has(tile.dataset.sampleId);
                btn.disabled = attached;
                btn.textContent = attached ? 'Attached' : 'Add';
            });
        }

        // Close the specimen popover on outside click / Escape (registered once).
        document.addEventListener('click', e => {
            if (!root.isConnected) return;
            const popover = sampleHost.querySelector('.fc-sample-popover.open');
            if (popover && !sampleHost.contains(e.target)) popover.classList.remove('open');
        }, true);
        document.addEventListener('keydown', e => {
            if (e.key !== 'Escape' || !root.isConnected) return;
            const popover = sampleHost.querySelector('.fc-sample-popover.open');
            if (popover) popover.classList.remove('open');
        });

        function selectedDocumentIds() {
            return Array.from(caseDocs.values()).filter(d => d.selected).map(d => d.id);
        }

        function renderDocCards(documents, cuConfigured, note) {
            if (!documents || !documents.length) {
                docOutputEl.hidden = false;
                docOutputHint.textContent = note || 'No documents were selected for review.';
                docCardsEl.innerHTML = '';
                return;
            }
            docOutputEl.hidden = false;
            const usedCu = documents.some(d => d.source === 'content-understanding');
            docOutputHint.textContent = (note ? note + ' ' : '') + (usedCu
                ? 'Each document was read by Azure Content Understanding and scored by the deterministic checks layer.'
                : cuConfigured
                    ? 'Content Understanding was unavailable, so the checks layer ran on the case-file record of each document.'
                    : 'Content Understanding is not configured — the checks layer ran on the case-file record of each document.');
            docCardsEl.innerHTML = documents.map((d, idx) => {
                const verdict = (d.verdict || 'suspicious').toLowerCase();
                const checks = d.checks || [];
                const applicable = checks.filter(c => (c.status || '').toLowerCase() !== 'n/a');
                const notApplicable = checks.filter(c => (c.status || '').toLowerCase() === 'n/a');
                const reasons = d.failureReasons || [];
                const reasonsHtml = reasons.length
                    ? `<ul class="fc-doc-reasons">${reasons.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>`
                    : '<p class="muted" style="margin:0; font-size:0.84rem;">No concerns — every applicable check passed.</p>';
                const checkItem = c => `<li>${statusIcon(c.status)}<div><div class="check-name">${escapeHtml(c.name)}</div><div class="check-detail">${escapeHtml(c.detail)}</div></div></li>`;
                const naHtml = notApplicable.length
                    ? `<details class="fc-doc-na"><summary>${notApplicable.length} check${notApplicable.length === 1 ? '' : 's'} not applicable to ${escapeHtml(kindWithArticle(d.kind))}</summary><ul class="fc-doc-checks">${notApplicable.map(checkItem).join('')}</ul></details>`
                    : '';
                const cuBlock = d.cuMarkdown
                    ? `<details class="fc-doc-cu"><summary>Content Understanding output (markdown)</summary><pre>${escapeHtml(d.cuMarkdown)}</pre></details>`
                    : '';
                const source = d.source === 'content-understanding' ? 'Content Understanding' : 'Case-file record';
                return `
                    <div class="fc-doc-card" data-doc-id="${escapeHtml(d.id)}">
                        <div><img src="${escapeHtml(d.src)}" alt="${escapeHtml(d.label)}" loading="lazy" /></div>
                        <div>
                            <div class="fc-doc-card-head">
                                <span class="fc-doc-card-title">Document #${idx + 1} — ${escapeHtml(d.label)}</span>
                                <span class="fc-doc-verdict ${escapeHtml(verdict)}">${escapeHtml(verdict)}</span>
                                <span class="fc-doc-source">${escapeHtml(source)}</span>
                            </div>
                            <p class="fc-doc-summary">${escapeHtml(d.summary || '')}</p>
                            <div class="fc-doc-section-label">Why this verdict</div>
                            ${reasonsHtml}
                            <div class="fc-doc-section-label">Checks performed</div>
                            <ul class="fc-doc-checks">${applicable.map(checkItem).join('')}</ul>
                            ${naHtml}
                            ${cuBlock}
                        </div>
                    </div>`;
            }).join('');
            docCardsEl.querySelectorAll('.fc-doc-card img').forEach(img => {
                img.addEventListener('click', () => openLightbox(img.src, img.alt));
            });
        }

        async function scanDocuments() {
            if (!selectedCase) return;
            const ids = selectedDocumentIds();
            if (!ids.length) {
                scanStatus.hidden = false;
                scanStatus.className = 'fc-status error';
                scanStatus.textContent = 'Select at least one document to scan.';
                return;
            }
            scanBtn.disabled = true;
            scanStatus.hidden = false;
            scanStatus.className = 'fc-status';
            scanStatus.innerHTML = `<span class="spinner"></span>Scanning ${ids.length} document${ids.length === 1 ? '' : 's'}…`;
            try {
                const res = await fetch('/fincrime/documents/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ caseNumber: selectedCase.caseNumber, documentIds: ids }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
                const docs = data.documents || [];
                const counts = ['legit', 'suspicious', 'fake']
                    .map(v => [v, docs.filter(d => d.verdict === v).length])
                    .filter(([, n]) => n > 0)
                    .map(([v, n]) => `${n} ${v}`);
                scanStatus.textContent = `Scanned ${docs.length} document${docs.length === 1 ? '' : 's'}: ${counts.join(', ')}.`;
                renderDocCards(docs, !!data.contentUnderstandingConfigured);
            } catch (err) {
                scanStatus.className = 'fc-status error';
                scanStatus.textContent = 'Document scan failed: ' + err.message;
            } finally {
                scanBtn.disabled = false;
            }
        }

        // ── Steps 1 & 4 — cases and the agent ────────────────────
        async function loadCases(preserveSelection) {
            const previous = preserveSelection ? selectEl.value : null;
            selectEl.innerHTML = '<option value="">— Loading cases… —</option>';
            try {
                const res = await fetch('/fincrime/cases');
                if (!res.ok) throw new Error('HTTP ' + res.status);
                cases = await res.json();
                if (!cases.length) {
                    selectEl.innerHTML = '<option value="">— No cases yet —</option>';
                    emptyEl.hidden = false;
                    selectCase('');
                    return;
                }
                emptyEl.hidden = true;
                selectEl.innerHTML =
                    '<option value="">— Select a case —</option>' +
                    cases.map(c => `<option value="${escapeHtml(c.caseNumber)}">${escapeHtml(c.caseNumber)} — ${escapeHtml(c.clientName)} (${escapeHtml(c.requestType)})</option>`).join('');
                if (previous && cases.some(c => c.caseNumber === previous)) {
                    selectEl.value = previous;
                    selectCase(previous);
                }
            } catch (err) {
                selectEl.innerHTML = '<option value="">— Failed to load —</option>';
                emptyEl.hidden = false;
                emptyEl.textContent = 'Failed to load cases: ' + err.message;
            }
        }

        function selectCase(caseNumber) {
            selectedCase = cases.find(c => c.caseNumber === caseNumber) || null;
            outputStep.hidden = true;
            processStatus.hidden = true;
            scanStatus.hidden = true;
            docOutputEl.hidden = true;
            docCardsEl.innerHTML = '';
            if (!selectedCase) {
                caseStep.hidden = true;
                docsStep.hidden = true;
                processStep.hidden = true;
                return;
            }
            renderCase(selectedCase);
            caseStep.hidden = false;
            docsStep.hidden = false;
            processStep.hidden = false;
            processBtn.disabled = false;
            scanBtn.disabled = false;
            loadActivity(selectedCase.caseNumber);
            loadCaseDocs(selectedCase.caseNumber);
        }

        function renderOutput(data) {
            const level = (data.riskLevel || 'Medium').toString();
            riskPill.textContent = level;
            riskPill.className = 'fc-risk-pill ' + level.toLowerCase();
            riskNum.textContent = typeof data.riskScore === 'number' ? `Score: ${data.riskScore}/100` : '';
            riskSummary.textContent = data.riskSummary || '';

            if (data.agentRiskLevel || typeof data.agentRiskScore === 'number') {
                const parts = [data.agentRiskLevel, typeof data.agentRiskScore === 'number' ? `${data.agentRiskScore}/100` : null].filter(Boolean);
                agentView.textContent = `Felix's agent rated this case ${parts.join(' · ')} — see the Agent Narrative tab. The score above comes from the explainable checks layer.`;
                agentView.hidden = false;
            } else if (data.agentConfigured && data.agentError) {
                agentView.textContent = 'The agent call failed, so this assessment comes from the explainable checks layer only.';
                agentView.hidden = false;
            } else if (!data.agentConfigured) {
                agentView.textContent = 'Foundry agent not configured — this assessment comes from the explainable checks layer.';
                agentView.hidden = false;
            } else {
                agentView.hidden = true;
            }

            const indicators = data.indicators || [];
            indicatorsEl.innerHTML = indicators.length
                ? indicators.map(i => `
                    <li class="fc-indicator sev-${escapeHtml(i.severity || 'medium')}">
                        <div class="fc-ind-head">
                            <span class="fc-ind-title">${escapeHtml(i.title)}</span>
                            <span class="fc-ind-points">+${escapeHtml(i.points)}</span>
                        </div>
                        <div class="fc-ind-evidence">${escapeHtml(i.evidence)}</div>
                        <div class="fc-ind-source">Source: ${escapeHtml(i.source)}</div>
                    </li>`).join('')
                : '<li class="fc-muted-item">No risk indicators found.</li>';

            if (typeof data.riskScore === 'number') {
                const points = indicators.map(i => i.points);
                const sum = 5 + points.reduce((a, b) => a + b, 0);
                let text = `Score = 5 (baseline)${points.map(p => ' + ' + p).join('')} = ${Math.min(sum, 99)}`;
                if (data.riskScore > Math.min(sum, 99)) text += ` → raised to ${data.riskScore}: an altered document always needs human review`;
                breakdownEl.textContent = text;
            } else {
                breakdownEl.textContent = '';
            }

            actionsEl.innerHTML = (data.actions || []).map(a =>
                `<li><strong>${escapeHtml(a.action)}</strong>${a.requiresApproval ? '<span class="fc-approval-badge">Human approval</span>' : ''} — ${escapeHtml(a.detail)}</li>`).join('')
                || '<li class="fc-muted-item">No further action recommended.</li>';

            clearEl.innerHTML = (data.checksClear || []).map(c => `<li>${statusIcon('pass')}<div>${escapeHtml(c)}</div></li>`).join('')
                || '<li class="fc-muted-item">Nothing confirmed clear yet.</li>';

            approvalEl.textContent = data.approvalRequired || 'Yes — financial-crime decisions always need human approval.';
            if (data.smrNote) {
                smrEl.textContent = data.smrNote;
                smrEl.hidden = false;
            } else {
                smrEl.hidden = true;
            }
        }

        async function processCase() {
            if (!selectedCase) return;
            processBtn.disabled = true;
            processStatus.hidden = false;
            processStatus.className = 'fc-status';
            processStatus.innerHTML = '<span class="spinner"></span>Engaging the Financial Crime Agent…';
            outputStep.hidden = true;

            try {
                const data = await window.zcAgentStream({
                    url: '/fincrime/process',
                    body: {
                        caseNumber: selectedCase.caseNumber,
                        documentIds: selectedDocumentIds(),
                    },
                    onDelta: (_chunk, fullText) => {
                        if (window.engageTabsStreamNarrative) window.engageTabsStreamNarrative(engageScope, fullText);
                    },
                    onError: msg => {
                        processStatus.className = 'fc-status error';
                        processStatus.textContent = 'Agent error: ' + msg;
                    },
                });
                if (!data) throw new Error('No response from the agent');

                if (data.agentError) {
                    processStatus.className = 'fc-status error';
                    processStatus.textContent = 'Agent error: ' + data.agentError + ' — showing the deterministic assessment.';
                } else {
                    processStatus.className = 'fc-status';
                    processStatus.textContent = data.agentConfigured
                        ? 'Financial Crime Agent completed the review.'
                        : 'Reviewed (Foundry agent not configured — using the deterministic assessment).';
                }

                // Keep the document cards in step 3 in sync with the numbering
                // the agent was given.
                renderDocCards(data.documents || [], !!data.contentUnderstandingConfigured,
                    (data.documents || []).length ? 'Documents as reviewed by the agent.' : 'No documents were included in the review.');
                renderOutput(data);
                outputStep.hidden = false;
                outputStep.scrollIntoView({ behavior: 'smooth', block: 'start' });

                if (window.engageTabsRender) window.engageTabsRender(engageScope, data);
            } catch (err) {
                processStatus.className = 'fc-status error';
                processStatus.textContent = 'Failed to run the review: ' + err.message;
            } finally {
                processBtn.disabled = false;
            }
        }

        selectEl.addEventListener('change', () => selectCase(selectEl.value));
        refreshBtn.addEventListener('click', () => loadCases(true));
        scanBtn.addEventListener('click', scanDocuments);
        processBtn.addEventListener('click', processCase);

        loadCases(false);
    }

    init();

    if (!window.__fincrimeDemoEnhancedHook) {
        window.__fincrimeDemoEnhancedHook = true;
        const hook = () => init();
        if (typeof Blazor !== 'undefined' && typeof Blazor.addEventListener === 'function') {
            Blazor.addEventListener('enhancedload', hook);
        } else {
            document.addEventListener('enhancedload', hook);
        }
    }
})();
