// Investment Analyst Agent page (/agents/investment-analyst) — "Try it out".
// Loaded as a permanent script from App.razor so init runs reliably on full
// page load AND on Blazor enhanced navigation (inline <script> tags inside
// razor pages do not re-execute on enhanced nav).
//
// Flow: pick a Member Case → review the investment details → engage Ivy's
// agent (/investments/process, streamed) → render the comparison table,
// Mermaid chart, plan and workbook link → chat (/investments/chat).
(function () {
    const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    let mermaidSeq = 0;

    // Lazy-load Mermaid once per page session. If the CDN can't be reached the
    // promise rejects and every chart keeps its plain fallback (bars / source).
    function loadMermaid() {
        if (!window.__invMermaidPromise) {
            window.__invMermaidPromise = import(MERMAID_URL).then(mod => {
                const mermaid = mod.default || mod;
                mermaid.initialize({
                    startOnLoad: false,
                    securityLevel: 'strict',
                    theme: 'neutral',
                    suppressErrorRendering: true,
                    xyChart: { width: 720, height: 340, titleFontSize: 15 },
                    themeVariables: {
                        background: 'transparent',
                        xyChart: {
                            backgroundColor: 'transparent',
                            plotColorPalette: '#1660d0',
                            titleColor: '#0b1f3a',
                            xAxisLabelColor: '#475467',
                            yAxisLabelColor: '#475467',
                            xAxisTitleColor: '#475467',
                            yAxisTitleColor: '#475467',
                            xAxisLineColor: '#98a2b3',
                            yAxisLineColor: '#98a2b3',
                            xAxisTickColor: '#98a2b3',
                            yAxisTickColor: '#98a2b3'
                        }
                    }
                });
                return mermaid;
            });
        }
        return window.__invMermaidPromise;
    }

    async function renderMermaidSvg(source) {
        const mermaid = await loadMermaid();
        const id = 'inv-mmd-' + Date.now() + '-' + (mermaidSeq++);
        const result = await mermaid.render(id, source);
        return result && result.svg ? result.svg : '';
    }

    // Replace ```mermaid blocks rendered by /api/markdown (Markdig emits
    // <pre class="mermaid">) with SVG charts inside agent markdown areas.
    async function upgradeMermaidBlocks(container) {
        if (!container) return;
        const nodes = Array.from(container.querySelectorAll(
            '.agent-md pre.mermaid:not([data-inv-mmd]), .agent-md div.mermaid:not([data-inv-mmd]), .agent-md code.language-mermaid:not([data-inv-mmd])'));
        for (const node of nodes) {
            node.setAttribute('data-inv-mmd', 'pending');
            const target = node.tagName === 'CODE' && node.parentElement && node.parentElement.tagName === 'PRE'
                ? node.parentElement
                : node;
            const source = (node.textContent || '').trim();
            if (!source) continue;
            try {
                const svg = await renderMermaidSvg(source);
                if (!svg || !target.isConnected) continue;
                const wrap = document.createElement('div');
                wrap.className = 'inv-mermaid-rendered';
                wrap.setAttribute('data-inv-mmd', 'done');
                wrap.innerHTML = svg;
                target.replaceWith(wrap);
            } catch (_) {
                node.setAttribute('data-inv-mmd', 'failed');
            }
        }
    }

    function init() {
        const initialRoot = document.querySelector('.inv-panel');
        if (!initialRoot || initialRoot.dataset.wired === '1') return;
        initialRoot.dataset.wired = '1';

        // Always re-query against the live document so a Blazor enhanced
        // navigation swap never leaves us writing into a detached node.
        const $ = sel => {
            const r = document.querySelector('.inv-panel') || initialRoot;
            return r ? r.querySelector(sel) : null;
        };

        let selectedCase = null;
        // Most recent Foundry response id — follow-up chat turns chain off it.
        let previousResponseId = null;
        let engaged = false;
        const referenceMap = new Map(); // url||title -> { title, url, kind }

        function escapeHtml(s) {
            return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        }

        function setText(id, value) {
            const el = $('#' + id);
            if (el) el.textContent = value == null || value === '' ? '—' : value;
        }

        function show(id, visible) {
            const el = $('#' + id);
            if (el) el.hidden = !visible;
        }

        function money(v) {
            const n = Number(v);
            if (!isFinite(n)) return '—';
            const whole = Math.abs(n - Math.round(n)) < 0.005;
            return n.toLocaleString('en-AU', {
                style: 'currency', currency: 'AUD',
                minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2
            });
        }

        // Watch the panel for markdown that contains Mermaid blocks (agent
        // narrative and chat replies) and upgrade them to SVG charts.
        if (window.__invMermaidObserver) window.__invMermaidObserver.disconnect();
        let mermaidTimer = null;
        const observer = new MutationObserver(() => {
            clearTimeout(mermaidTimer);
            mermaidTimer = setTimeout(() => upgradeMermaidBlocks(document.querySelector('.inv-panel')), 150);
        });
        observer.observe(initialRoot, { childList: true, subtree: true });
        window.__invMermaidObserver = observer;

        // ── Step 1: cases ────────────────────────────────────────────────
        async function loadCases(preferred) {
            const sel = $('#inv-case-select');
            if (sel) sel.innerHTML = '<option value="">— Loading cases —</option>';
            show('inv-empty', false);
            resetCase();
            try {
                const res = await fetch('/investments/cases');
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const cases = await res.json();
                if (!cases.length) {
                    if (sel) sel.innerHTML = '<option value="">— No cases available —</option>';
                    show('inv-empty', true);
                    return;
                }
                if (sel) {
                    sel.innerHTML = '<option value="">— Select a case —</option>' + cases.map(c =>
                        `<option value="${escapeHtml(c.caseNumber)}">${escapeHtml(c.caseNumber)} — ${escapeHtml(c.clientName)} (${escapeHtml(c.requestType)})</option>`
                    ).join('');
                    if (preferred && cases.some(c => c.caseNumber === preferred)) {
                        sel.value = preferred;
                        selectCase(preferred);
                    }
                }
            } catch (err) {
                if (sel) sel.innerHTML = '<option value="">— Failed to load —</option>';
                const status = $('#inv-process-status');
                if (status) {
                    status.hidden = false;
                    status.className = 'inv-status error';
                    status.textContent = 'Failed to load cases: ' + err.message;
                }
            }
        }

        function resetCase() {
            selectedCase = null;
            show('inv-review-step', false);
            show('inv-process-step', false);
            const btn = $('#inv-process-btn');
            if (btn) btn.disabled = true;
            resetResults();
            resetChatAndRefs();
        }

        function resetResults() {
            engaged = false;
            show('inv-results', false);
            const status = $('#inv-process-status');
            if (status) status.hidden = true;
        }

        async function selectCase(caseNumber) {
            resetCase();
            if (!caseNumber) return;
            try {
                const res = await fetch('/investments/cases/' + encodeURIComponent(caseNumber));
                if (!res.ok) throw new Error('HTTP ' + res.status);
                selectedCase = await res.json();
                renderReview(selectedCase);
                show('inv-review-step', true);
                show('inv-process-step', true);
                const btn = $('#inv-process-btn');
                if (btn) btn.disabled = false;
            } catch (err) {
                const status = $('#inv-process-status');
                show('inv-process-step', true);
                if (status) {
                    status.hidden = false;
                    status.className = 'inv-status error';
                    status.textContent = 'Failed to load case: ' + err.message;
                }
            }
        }

        // ── Step 2: review ───────────────────────────────────────────────
        function renderReview(c) {
            const inv = c.investment || {};
            setText('inv-case-num', c.caseNumber);
            setText('inv-case-client', c.clientName);
            setText('inv-case-member', c.memberNumber);
            setText('inv-case-product', c.product);
            setText('inv-case-type', c.requestType);
            setText('inv-case-adviser', c.adviserPractice ? `${c.adviserName} (${c.adviserPractice})` : c.adviserName);
            setText('inv-case-received', c.receivedDate);
            setText('inv-case-balance', inv.balanceDisplay ? `${inv.balanceDisplay} — ${inv.balanceLabel}` : '');
            const note = $('#inv-case-balance-note');
            if (note) note.textContent = inv.balanceNote ? `(${inv.balanceNote})` : '';
            setText('inv-case-model', inv.currentModel);
            setText('inv-case-risk', inv.riskProfile);
            setText('inv-case-soa', inv.soa);
            setText('inv-case-analysis-title', inv.analysisTitle);
            setText('inv-case-analysis-summary', inv.analysisSummary);

            const holdings = Array.isArray(inv.holdings) ? inv.holdings : [];
            renderHoldingsTable('inv-review-holdings-table', holdings);
            show('inv-review-holdings', holdings.length > 0);

            const sheets = Array.isArray(inv.factSheets) ? inv.factSheets : [];
            const list = $('#inv-review-factsheet-list');
            if (list) {
                list.innerHTML = sheets.map(fs =>
                    '<div class="inv-fs-thumb" tabindex="0">' +
                        '<span class="inv-fs-icon" aria-hidden="true">📊</span>' +
                        `<span class="inv-fs-name">${escapeHtml(fs.shortName)}</span>` +
                        `<span class="inv-fs-meta">${escapeHtml(fs.icrPercent != null ? Number(fs.icrPercent).toFixed(2) + '%' : 'n/a')} ICR</span>` +
                        `<a class="inv-fs-ext" href="${escapeHtml(fs.url)}" target="_blank" rel="noopener" title="Open raw JSON" aria-label="Open the ${escapeHtml(fs.shortName)} fact sheet">↗</a>` +
                        '<div class="inv-fs-popover" role="tooltip">' +
                            '<div class="inv-fs-popover-head">' +
                                `<strong>${escapeHtml(fs.name)}</strong>` +
                                `<span>${escapeHtml(fs.code || '')} · ${escapeHtml(fs.growthDefensive)} growth/defensive</span>` +
                            '</div>' +
                            `<pre class="inv-fs-popover-pre">${escapeHtml(fs.preview)}</pre>` +
                        '</div>' +
                    '</div>'
                ).join('');
            }
            show('inv-review-factsheets', sheets.length > 0);
        }

        function renderHoldingsTable(tableId, holdings) {
            const table = $('#' + tableId);
            if (!table) return;
            if (!holdings.length) { table.innerHTML = ''; return; }
            const total = holdings.reduce((sum, h) => sum + Number(h.value || 0), 0);
            table.innerHTML =
                '<thead><tr><th>Holding</th><th class="num">Value</th><th class="num">Share</th></tr></thead><tbody>' +
                holdings.map(h =>
                    `<tr><td>${escapeHtml(h.holding)}</td><td class="num">${escapeHtml(h.valueDisplay || money(h.value))}</td>` +
                    `<td class="num">${escapeHtml(Number(h.percent).toFixed(1))}%</td></tr>`).join('') +
                `<tr class="total"><td>Total</td><td class="num">${escapeHtml(money(total))}</td><td class="num">100%</td></tr></tbody>`;
        }

        // ── Step 3: engage ───────────────────────────────────────────────
        async function processCase() {
            if (!selectedCase) return;
            const btn = $('#inv-process-btn');
            const status = $('#inv-process-status');
            const scope = $('.engage-tabs-scope');
            if (btn) btn.disabled = true;
            if (status) {
                status.hidden = false;
                status.className = 'inv-status';
                status.innerHTML = '<span class="spinner"></span>Engaging the Investment Analyst Agent…';
            }
            resetResults();
            resetChatAndRefs();

            try {
                const data = await window.zcAgentStream({
                    url: '/investments/process',
                    body: { caseNumber: selectedCase.caseNumber },
                    onDelta: (_chunk, fullText) => {
                        if (window.engageTabsStreamNarrative) window.engageTabsStreamNarrative(scope, fullText);
                    },
                    onError: (msg) => {
                        const s = $('#inv-process-status');
                        if (s) {
                            s.className = 'inv-status error';
                            s.textContent = 'Agent error: ' + msg + ' — showing the deterministic analysis.';
                        }
                    }
                });
                if (!data) throw new Error('No response from the agent');

                const s = $('#inv-process-status');
                if (s) {
                    if (data.agentError) {
                        s.className = 'inv-status error';
                        s.textContent = 'The live agent didn\'t complete (' + data.agentError + ') — showing the deterministic analysis.';
                    } else if (!data.agentConfigured) {
                        s.className = 'inv-status';
                        s.textContent = 'Processed with the deterministic analysis (Foundry agent not configured) — the same calculations the MCP tools run.';
                    } else {
                        s.className = 'inv-status';
                        s.textContent = 'The Investment Analyst Agent produced its portfolio review.';
                    }
                }

                if (window.engageTabsRender) window.engageTabsRender(scope, data);
                renderResults(data);
                engaged = true;

                if (data.previousResponseId) previousResponseId = data.previousResponseId;
                if (data.agentRawOutput && Array.isArray(data.agentRawOutput.citations)) {
                    mergeCitations(data.agentRawOutput.citations);
                    renderReferences();
                }
                show('inv-chat-step', true);
                setChatEnabled(true);
            } catch (err) {
                const s = $('#inv-process-status');
                if (s) {
                    s.className = 'inv-status error';
                    s.textContent = 'Failed to process: ' + err.message;
                }
            } finally {
                const b = $('#inv-process-btn');
                if (b) b.disabled = !selectedCase;
            }
        }

        function renderResults(data) {
            const a = data.analysis || {};
            setText('inv-results-title', a.title);
            setText('inv-results-summary', a.summary);

            const mode = $('#inv-results-mode');
            if (mode) {
                const live = data.agentConfigured && !data.agentError && data.agentRawOutput;
                mode.className = 'inv-mode-pill' + (live ? ' live' : '');
                mode.textContent = live
                    ? (data.mcpEnabled ? 'Live agent · MCP tools' : 'Live agent')
                    : 'Deterministic analysis';
            }

            const action = $('#inv-action-note');
            if (action) {
                action.hidden = !a.actionNote;
                action.textContent = a.actionNote || '';
            }
            const fit = $('#inv-fit');
            if (fit) fit.innerHTML = a.portfolioFit ? '<strong>Portfolio fit:</strong> ' + escapeHtml(a.portfolioFit) : '';

            renderComparison(a.comparison);

            const holdings = Array.isArray(a.holdings) ? a.holdings : [];
            renderHoldingsTable('inv-holdings-table', holdings);
            show('inv-holdings', holdings.length > 0 && !a.comparison);

            renderChart(a.chart);
            renderPlan(a.plan);

            const obs = $('#inv-observations');
            if (obs) obs.innerHTML = (a.observations || []).map(o => `<li>${escapeHtml(o)}</li>`).join('');
            const next = $('#inv-next-steps');
            if (next) next.innerHTML = (a.nextSteps || []).map(o => `<li>${escapeHtml(o)}</li>`).join('');

            const wb = data.workbook;
            const link = $('#inv-workbook-link');
            if (wb && wb.downloadUrl && link) {
                link.href = wb.downloadUrl;
                link.setAttribute('download', wb.fileName || 'client-workbook.xlsx');
                setText('inv-workbook-name', wb.fileName);
                setText('inv-workbook-sheets', (wb.sheets || []).join(' · '));
                show('inv-workbook', true);
            } else {
                show('inv-workbook', false);
            }
            const wbErr = $('#inv-workbook-error');
            if (wbErr) {
                wbErr.hidden = !data.workbookError;
                wbErr.textContent = data.workbookError ? 'The workbook could not be generated: ' + data.workbookError : '';
            }

            const approval = $('#inv-approval');
            if (approval) approval.className = 'inv-approval' + (a.humanApprovalRequired ? ' required' : '');
            setText('inv-approval-pill', a.humanApprovalRequired ? 'Human approval required' : 'No approval needed');
            setText('inv-approval-reason', a.humanApprovalReason);

            show('inv-results', true);
        }

        function renderComparison(cmp) {
            const table = $('#inv-comparison-table');
            if (!cmp || !Array.isArray(cmp.rows) || !table) {
                show('inv-comparison', false);
                return;
            }
            table.innerHTML =
                '<thead><tr><th>Option</th><th>Growth / defensive</th><th class="num">Investment fee (ICR)</th>' +
                '<th class="num">Investment fee p.a.</th><th class="num">Admin + account-keeping p.a.</th>' +
                '<th class="num">Total Caldova fees p.a.</th><th class="num">vs lowest</th></tr></thead><tbody>' +
                cmp.rows.map(r =>
                    `<tr class="${r.selected ? 'selected' : ''}">` +
                        `<td><strong>${escapeHtml(r.name)}</strong>${r.selected ? '<span class="inv-tag">Selected</span>' : ''}` +
                            (r.components ? `<div class="muted">${escapeHtml(r.components)}</div>` : '') + '</td>' +
                        `<td>${escapeHtml(r.growthDefensive)}</td>` +
                        `<td class="num">${escapeHtml(r.icrLabel)}</td>` +
                        `<td class="num">${escapeHtml(r.investmentFeeDisplay)}</td>` +
                        `<td class="num">${escapeHtml(r.adminAndAccountKeepingFeeDisplay)}</td>` +
                        `<td class="num"><strong>${escapeHtml(r.totalFeeDisplay)}</strong></td>` +
                        `<td class="num">${Number(r.differenceVsLowest) === 0 ? 'Lowest' : '+' + escapeHtml(r.differenceVsLowestDisplay)}</td>` +
                    '</tr>').join('') +
                '</tbody>';
            const basis = cmp.feeBasis || {};
            const note = $('#inv-comparison-note');
            if (note) {
                note.textContent = `Balance ${money(basis.balance)}. Admin fee: ${basis.adminFeeWorking || ''}, plus the $180 p.a. ` +
                    `account-keeping fee — the same for every option. Excludes any adviser fee and the ` +
                    `${basis.buySellSpreadPercent != null ? Number(basis.buySellSpreadPercent).toFixed(2) + '%' : '0.10%'} buy/sell spread.`;
            }
            show('inv-comparison', true);
        }

        function renderChart(chart) {
            if (!chart || !Array.isArray(chart.bars) || !chart.bars.length) {
                show('inv-chart', false);
                return;
            }
            setText('inv-chart-title', chart.title);
            const max = Math.max(...chart.bars.map(b => Number(b.value) || 0), 1);
            const bars = $('#inv-chart-bars');
            if (bars) {
                bars.hidden = false;
                bars.innerHTML = chart.bars.map(b =>
                    '<div class="inv-bar-row">' +
                        `<span class="inv-bar-label">${escapeHtml(b.label)}</span>` +
                        `<span class="inv-bar-track"><span class="inv-bar-fill${b.highlight ? ' highlight' : ''}" style="display:block;width:${Math.max(2, (Number(b.value) / max) * 100).toFixed(1)}%"></span></span>` +
                        `<span class="inv-bar-value">${escapeHtml(b.display || money(b.value))}</span>` +
                    '</div>').join('');
            }
            const source = $('#inv-chart-source');
            if (source) source.textContent = chart.mermaid || '';
            const host = $('#inv-chart-mermaid');
            if (host) {
                host.hidden = true;
                host.innerHTML = '';
                if (chart.mermaid) {
                    renderMermaidSvg(chart.mermaid).then(svg => {
                        const h = $('#inv-chart-mermaid');
                        if (!svg || !h) return;
                        h.innerHTML = svg;
                        h.hidden = false;
                        const b = $('#inv-chart-bars');
                        if (b) b.hidden = true;
                    }).catch(() => { /* keep the HTML bars */ });
                }
            }
            show('inv-chart', true);
        }

        function renderPlan(plan) {
            const table = $('#inv-plan-table');
            if (!plan || !Array.isArray(plan.rows) || !plan.rows.length || !table) {
                show('inv-plan', false);
                return;
            }
            setText('inv-plan-title', plan.title);
            table.innerHTML =
                '<thead><tr><th>Step</th><th>Item</th><th class="num">Amount</th><th>Timing / status</th><th>Note</th></tr></thead><tbody>' +
                plan.rows.map(r =>
                    `<tr><td>${escapeHtml(r.step)}</td><td>${escapeHtml(r.item)}</td>` +
                    `<td class="num">${escapeHtml(r.amountDisplay)}</td><td>${escapeHtml(r.timing)}</td>` +
                    `<td>${escapeHtml(r.note)}</td></tr>`).join('') +
                '</tbody>';
            const note = $('#inv-plan-note');
            if (note) {
                note.textContent = plan.note || '';
                note.hidden = !plan.note;
            }
            show('inv-plan', true);
        }

        // ── Step 4: chat + references ────────────────────────────────────
        function setChatEnabled(enabled) {
            const send = $('#inv-chat-send');
            const input = $('#inv-chat-input');
            if (send) send.disabled = !enabled;
            if (input) input.disabled = !enabled;
            const root = document.querySelector('.inv-panel') || initialRoot;
            root.querySelectorAll('.inv-chip').forEach(c => { c.disabled = !enabled; });
        }

        function resetChatAndRefs() {
            previousResponseId = null;
            referenceMap.clear();
            renderReferences();
            const messages = $('#inv-chat-messages');
            if (messages) messages.innerHTML = '<div class="inv-chat-empty">No follow-up messages yet. Ask a question below.</div>';
            show('inv-chat-step', false);
            setChatEnabled(false);
            const status = $('#inv-chat-status');
            if (status) status.hidden = true;
        }

        // Web-grounded citations carry an http(s) URL; Azure AI Search
        // document hits have no URL or a non-http identifier.
        function classifyCitation(c) {
            return /^https?:\/\//i.test(c && c.url ? String(c.url) : '') ? 'web' : 'doc';
        }

        function mergeCitations(citations) {
            if (!Array.isArray(citations)) return;
            for (const c of citations) {
                if (!c) continue;
                const key = c.url || c.title;
                if (!key || referenceMap.has(key)) continue;
                referenceMap.set(key, { title: c.title || '', url: c.url || '', kind: classifyCitation(c) });
            }
        }

        function renderReferences() {
            const list = $('#inv-refs-list');
            const count = $('#inv-refs-count');
            if (count) count.textContent = String(referenceMap.size);
            if (!list) return;
            if (referenceMap.size === 0) {
                list.innerHTML = '<div class="inv-refs-empty">References from the agent will appear here.</div>';
                return;
            }
            list.innerHTML = Array.from(referenceMap.values()).map((r, i) => {
                const label = r.kind === 'web' ? 'Web' : 'Document';
                const title = r.title || r.url || 'Reference ' + (i + 1);
                const titleHtml = r.url
                    ? `<a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">[${i + 1}] ${escapeHtml(title)}</a>`
                    : `<span>[${i + 1}] ${escapeHtml(title)}</span>`;
                const urlHtml = r.url && r.url !== title ? `<span class="inv-ref-url">${escapeHtml(r.url)}</span>` : '';
                return `<div class="inv-ref-card"><span class="inv-ref-kind inv-ref-kind-${r.kind}">${label}</span><div>${titleHtml}</div>${urlHtml}</div>`;
            }).join('');
        }

        function nowLabel() {
            return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        function appendChatMessage(role, text) {
            const messages = $('#inv-chat-messages');
            if (!messages) return null;
            const empty = messages.querySelector('.inv-chat-empty');
            if (empty) empty.remove();
            const wrap = document.createElement('div');
            wrap.className = 'inv-chat-msg inv-chat-msg-' + role;
            const bubble = document.createElement('div');
            bubble.className = 'inv-chat-bubble';
            if (role === 'assistant') {
                const md = document.createElement('div');
                md.className = 'agent-md';
                if (text && typeof window.zcRenderMarkdown === 'function') window.zcRenderMarkdown(md, text);
                else md.textContent = text || '';
                bubble.appendChild(md);
            } else {
                bubble.textContent = text || '';
            }
            wrap.appendChild(bubble);
            const meta = document.createElement('div');
            meta.className = 'inv-chat-meta';
            meta.textContent = (role === 'user' ? 'You' : 'Investment Analyst Agent') + ' · ' + nowLabel();
            wrap.appendChild(meta);
            messages.appendChild(wrap);
            messages.scrollTop = messages.scrollHeight;
            return bubble;
        }

        function streamIntoBubble(bubble, fullText, final) {
            if (!bubble) return;
            let md = bubble.querySelector('.agent-md');
            if (!md) {
                md = document.createElement('div');
                md.className = 'agent-md';
                bubble.innerHTML = '';
                bubble.appendChild(md);
            }
            if (final && typeof window.zcRenderMarkdown === 'function') window.zcRenderMarkdown(md, fullText || '');
            else md.textContent = fullText || '';
            const messages = $('#inv-chat-messages');
            if (messages) messages.scrollTop = messages.scrollHeight;
        }

        async function sendChatMessage(text) {
            if (!text || !engaged || !selectedCase) return;
            const status = $('#inv-chat-status');
            setChatEnabled(false);
            appendChatMessage('user', text);
            const bubble = appendChatMessage('assistant', '');
            if (status) {
                status.hidden = false;
                status.className = 'inv-status';
                status.innerHTML = '<span class="spinner"></span>The Investment Analyst Agent is thinking…';
            }

            try {
                const data = await window.zcAgentStream({
                    url: '/investments/chat',
                    body: { previousResponseId: previousResponseId, message: text, caseNumber: selectedCase.caseNumber },
                    onDelta: (_chunk, fullText) => streamIntoBubble(bubble, fullText, false),
                    onError: (msg) => {
                        if (status) {
                            status.className = 'inv-status error';
                            status.textContent = 'Agent error: ' + msg;
                        }
                    }
                });
                if (!data) throw new Error('No response from the agent');
                if (data.previousResponseId) previousResponseId = data.previousResponseId;
                streamIntoBubble(bubble, data.agentNotes || '', true);
                if (data.agentRawOutput && Array.isArray(data.agentRawOutput.citations)) {
                    mergeCitations(data.agentRawOutput.citations);
                    renderReferences();
                }
                if (status) {
                    if (data.agentError) {
                        status.className = 'inv-status error';
                        status.textContent = 'The live agent didn\'t reply (' + data.agentError + ') — answered from the deterministic analysis.';
                    } else {
                        status.hidden = true;
                    }
                }
            } catch (err) {
                if (status) {
                    status.className = 'inv-status error';
                    status.textContent = 'Failed to send: ' + err.message;
                }
            } finally {
                setChatEnabled(true);
                const input = $('#inv-chat-input');
                if (input) {
                    input.value = '';
                    input.focus();
                }
            }
        }

        // ── Wiring ───────────────────────────────────────────────────────
        const selectInit = $('#inv-case-select');
        const refreshInit = $('#inv-refresh-btn');
        const processInit = $('#inv-process-btn');
        const chatFormInit = $('#inv-chat-form');
        if (selectInit) selectInit.addEventListener('change', () => selectCase(selectInit.value));
        if (refreshInit) refreshInit.addEventListener('click', () => loadCases());
        if (processInit) processInit.addEventListener('click', processCase);
        if (chatFormInit) {
            chatFormInit.addEventListener('submit', (e) => {
                e.preventDefault();
                const input = $('#inv-chat-input');
                const text = (input && input.value || '').trim();
                if (text) sendChatMessage(text);
            });
        }
        initialRoot.querySelectorAll('.inv-chip').forEach(chip => {
            chip.addEventListener('click', () => sendChatMessage(chip.dataset.question || chip.textContent));
        });

        // Deep link: /agents/investment-analyst?caseNumber=REQ-… opens the
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

    if (!window.__invDemoEnhancedHook) {
        window.__invDemoEnhancedHook = true;
        const hook = () => init();
        if (typeof Blazor !== 'undefined' && typeof Blazor.addEventListener === 'function') {
            Blazor.addEventListener('enhancedload', hook);
        } else {
            document.addEventListener('enhancedload', hook);
        }
    }
})();
