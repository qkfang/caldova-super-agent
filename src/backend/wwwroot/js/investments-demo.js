// Auto-extracted from the matching razor page.
// Loaded as a permanent script from App.razor so init runs reliably on full
// page load AND on Blazor enhanced navigation. Inline <script> tags inside
// razor pages do NOT re-execute on enhanced nav, which left dropdowns stuck
// on the SSR fallback (e.g. "— Loading claims —") until manual refresh.
    (function () {
        function init() {
        const initialRoot = document.querySelector('.adjuster-panel');
        if (!initialRoot || initialRoot.dataset.wired === '1') return;
        initialRoot.dataset.wired = '1';

        // Always re-query against the live document at call time so that if
        // Blazor enhanced navigation replaces the panel between init() and
        // a later DOM access, we don't operate on a detached node. This
        // prevents `$('#adjuster-claim-num')` from returning null and
        // throwing "Cannot set properties of null (setting 'textContent')".
        const $ = sel => {
            const r = document.querySelector('.adjuster-panel') || initialRoot;
            return r ? r.querySelector(sel) : null;
        };

        let selectedClaim = null;
        // Tracks the most recent agent response id so follow-up chat turns
        // chain off the same Foundry conversation as the initial /process call.
        let previousResponseId = null;
        // Accumulated unique references (Bing search links + document
        // citations) rendered in the right-hand References panel.
        const referenceMap = new Map(); // key (url||title) -> { title, url, kind }

        // Quote document metadata keyed by claim type prefix.
        // Each entry maps to the set of sample quote files the agent will
        // call analyzeQuote on for that claim type.
        const QUOTE_SETS = {
            motor: [
                { name: 'premier-panel',   vendor: 'Premier Panel Works',   total: '$4,180',    ref: 'PPW-2026-0441', url: '/loss-adjuster/samples/quote-premier-panel.json',
                  preview: 'Rear-end collision repair (Toyota Corolla)\nAftermarket parts throughout.\n\nRear bumper cover (aftermarket) …… $780\nBoot lid respray …………………… $620\nTail lights ×2 (aftermarket) ……… $570\nParking sensors ×4 (pattern) ……… $340\nPanel straightening / weld check … $480\nLabour (8 hrs) ……………………… $880\nWheel alignment …………………… $95\n────────────────────────────────\nSubtotal   $3,800\nGST        $380\nTotal      $4,180\n\nWarranty: 12 months (workmanship only)' },
                { name: 'allstate-smash',  vendor: 'Allstate Smash Repairs', total: '$5,824',    ref: 'ASR-204771',   url: '/loss-adjuster/samples/quote-allstate-smash.json',
                  preview: 'Rear-end collision repair (Toyota Corolla)\nAll genuine Toyota parts. Preferred repairer.\n\nRear bumper cover (genuine) ……… $1,240\nBoot lid respray …………………… $720\nTail lights ×2 (genuine) …………… $970\nParking sensors ×4 (genuine) …… $620\nPanel / structural check …………… $580\nLabour (9 hrs) ……………………… $990\nWheel alignment ……………………… $110\n────────────────────────────────\nSubtotal   $5,295\nGST        $529.50\nTotal      $5,824.50\n\nWarranty: 24 months (genuine parts)' },
                { name: 'oem-motors',      vendor: 'OEM Collision Centre',   total: '$8,261',    ref: 'OEM-2026-1183', url: '/loss-adjuster/samples/quote-oem-motors.json',
                  preview: 'Full rear section repair (Toyota Corolla)\nOEM parts + ADAS calibration included.\n\nRear bumper cover (OEM) …………… $1,240\nBoot lid full replacement (OEM) … $1,850\nTail lights ×2 (OEM) ……………… $970\nParking sensors ×4 (OEM) ………… $620\nQuarter panel blend + refinish …… $680\nStructural scan + ADAS calibration $450\nLabour (12 hrs) …………………… $1,320\nWheel alignment ……………………… $185\nLoan vehicle (3 days) ……………… $195\n────────────────────────────────\nSubtotal   $7,510\nGST        $751\nTotal      $8,261\n\nWarranty: 36 months (all OEM)' }
            ],
            home: [
                { name: 'acme-restoration', vendor: 'Acme Restoration Services', total: '$18,755', ref: 'ACM-2026-0142', url: '/loss-adjuster/samples/quote-acme-restoration.json',
                  preview: 'Kitchen water-damage remediation\nBurst flexible hose. Like-for-like replacement.\n\nEmergency extraction ……………… $880\nStrip-out cabinetry ………………… $1,450\nStructural drying …………………… $1,980\nMould treatment …………………… $620\nReplace cabinetry …………………… $6,850\nReplace flooring (9 m²) …………… $2,780\nGyprock + repaint …………………… $1,420\nPlumbing rectification ……………… $690\nSite clean ……………………………… $380\n────────────────────────────────\nSubtotal   $17,050\nGST        $1,705\nTotal      $18,755\n\nWarranty: 12 months (workmanship)' },
                { name: 'bayside-build',    vendor: 'Bayside Build & Repair',     total: '$16,478', ref: 'BBR-04421',    url: '/loss-adjuster/samples/quote-bayside-build.json',
                  preview: 'Repair to kitchen following water escape.\nLike-for-like. Lowest quote.\n\nEmergency extraction ……………… $750\nStrip-out cabinetry ………………… $1,280\nStructural drying …………………… $1,750\nMould treatment …………………… $480\nReplace cabinetry …………………… $5,920\nReplace flooring (9 m²) …………… $2,150\nGyprock + repaint …………………… $1,180\nPlumbing rectification ……………… $680\nSite clean ……………………………… $790\n────────────────────────────────\nSubtotal   $14,980\nGST        $1,498\nTotal      $16,478\n\nWarranty: 6 months (workmanship)' },
                { name: 'sunrise-home',     vendor: 'Sunrise Home Solutions',     total: '$33,044', ref: 'SHS-77231',    url: '/loss-adjuster/samples/quote-sunrise-home.json',
                  preview: 'Full kitchen restoration after flood event.\nPremium finish upgrade on cabinetry.\n\nEmergency extraction ……………… $1,450\nStrip-out cabinetry ………………… $1,820\nStructural drying …………………… $2,400\nMould treatment …………………… $920\nReplace cabinetry (premium) ……… $11,500\nBenchtop (stone upgrade) ………… $4,800\nReplace flooring (9 m²) …………… $3,200\nGyprock + repaint …………………… $1,850\nPlumbing rectification ……………… $1,400\nAppliance reconnection …………… $700\n────────────────────────────────\nSubtotal   $30,040\nGST        $3,004\nTotal      $33,044\n\nWarranty: 12 months (workmanship)' }
            ]
        };

        function getQuoteSet(claimType) {
            if (claimType && claimType.toLowerCase().startsWith('motor')) return QUOTE_SETS.motor;
            return QUOTE_SETS.home;
        }

        function renderQuoteDocs(claimType) {
            const container = $('#adjuster-quote-docs');
            const list = $('#adjuster-quote-thumbs-list');
            if (!container || !list) return;
            const quotes = getQuoteSet(claimType);
            list.innerHTML = quotes.map(q =>
                '<div class="adjuster-quote-thumb" tabindex="0">' +
                    '<span class="adjuster-quote-icon">📄</span>' +
                    '<span class="adjuster-quote-name">' + escapeHtml(q.name) + '</span>' +
                    '<span class="adjuster-quote-meta">' + escapeHtml(q.total) + '</span>' +
                    '<a class="adjuster-quote-ext" href="' + escapeHtml(q.url) + '" target="_blank" rel="noopener" title="Open raw JSON" aria-label="Open ' + escapeHtml(q.name) + '.json">↗</a>' +
                    '<div class="adjuster-quote-popover" role="tooltip">' +
                        '<div class="adjuster-quote-popover-head">' +
                            '<strong>' + escapeHtml(q.vendor) + '</strong>' +
                            '<span>' + escapeHtml(q.ref) + ' · AUD ' + escapeHtml(q.total) + '</span>' +
                        '</div>' +
                        '<pre class="adjuster-quote-popover-pre">' + escapeHtml(q.preview) + '</pre>' +
                    '</div>' +
                '</div>'
            ).join('');
            container.hidden = false;
        }

        function escapeHtml(s) {
            return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
        }

        // Safe textContent setter: no-ops when the element isn't currently
        // in the live DOM (e.g. transient state during Blazor swaps).
        function setText(id, value) {
            const el = $('#' + id);
            if (el) el.textContent = value;
        }

        function setSelectedClaim(claim) {
            selectedClaim = claim;
            const cardStep = $('#adjuster-claim-card-step');
            const processStep = $('#adjuster-process-step');
            const btn = $('#adjuster-process-btn');
            const quoteDocs = $('#adjuster-quote-docs');
            if (!claim) {
                if (cardStep) cardStep.hidden = true;
                if (processStep) processStep.hidden = true;
                if (btn) btn.disabled = true;
                if (quoteDocs) quoteDocs.hidden = true;
                return;
            }
            setText('adjuster-claim-num',      claim.claimNumber || '—');
            setText('adjuster-claim-customer', claim.customerName || '—');
            setText('adjuster-claim-policy',   claim.policyNumber || '—');
            setText('adjuster-claim-type',     claim.claimType || '—');
            setText('adjuster-claim-date',     claim.incidentDate || '—');
            setText('adjuster-claim-location', claim.incidentLocation || '—');
            setText('adjuster-claim-desc',     claim.incidentDescription || '—');
            setText('adjuster-claim-loss',     claim.estimatedLoss || '—');
            setText('adjuster-claim-urgency',  claim.urgency || '—');
            // Reveal step 2 (review) and step 3 (engage) now that a claim is picked.
            if (cardStep) cardStep.hidden = false;
            if (processStep) processStep.hidden = false;
            if (btn) btn.disabled = false;
            // Show the quote documents relevant to this claim type.
            renderQuoteDocs(claim.claimType || '');
        }

        // Reset chat + references when starting a brand new agent run or
        // switching claims. Hides the chat step, clears messages, and empties
        // the references panel so the next /process call starts from scratch.
        function resetChatAndRefs() {
            previousResponseId = null;
            referenceMap.clear();
            renderReferences();
            const messages = $('#adjuster-chat-messages');
            if (messages) {
                messages.innerHTML =
                    '<div class="adjuster-chat-empty">No follow-up messages yet. Ask a question below.</div>';
            }
            const chatStep = $('#adjuster-chat-step');
            if (chatStep) chatStep.hidden = true;
            const sendBtn = $('#adjuster-chat-send');
            if (sendBtn) sendBtn.disabled = true;
            const status = $('#adjuster-chat-status');
            if (status) status.hidden = true;
        }

        // ----- References (Bing search + document citations) -------------
        // Heuristic: Bing-grounding citations have an http(s) URL; file
        // citations from Azure AI Search / Document Intelligence either
        // have no URL or use a non-http identifier (file id / filename).
        function classifyCitation(c) {
            const url = (c && c.url) ? String(c.url) : '';
            if (/^https?:\/\//i.test(url)) return 'bing';
            return 'doc';
        }

        function mergeCitations(citations) {
            if (!Array.isArray(citations)) return;
            for (const c of citations) {
                if (!c) continue;
                const title = c.title || '';
                const url = c.url || '';
                const key = url || title;
                if (!key) continue;
                if (!referenceMap.has(key)) {
                    referenceMap.set(key, { title: title, url: url, kind: classifyCitation(c) });
                }
            }
        }

        function renderReferences() {
            const list = $('#adjuster-refs-list');
            const count = $('#adjuster-refs-count');
            if (count) count.textContent = String(referenceMap.size);
            if (!list) return;
            if (referenceMap.size === 0) {
                list.innerHTML =
                    '<div class="adjuster-refs-empty">References from the agent will appear here.</div>';
                return;
            }
            const entries = Array.from(referenceMap.values());
            list.innerHTML = entries.map((r, i) => {
                const kindLabel = r.kind === 'bing' ? 'Bing' : 'Document';
                const kindClass = r.kind === 'bing' ? 'adjuster-ref-kind-bing' : 'adjuster-ref-kind-doc';
                const titleText = r.title || r.url || 'Reference ' + (i + 1);
                const titleHtml = r.url
                    ? '<a href="' + escapeHtml(r.url) + '" target="_blank" rel="noopener noreferrer">[' +
                      (i + 1) + '] ' + escapeHtml(titleText) + '</a>'
                    : '<span>[' + (i + 1) + '] ' + escapeHtml(titleText) + '</span>';
                const urlHtml = (r.url && r.url !== titleText)
                    ? '<span class="adjuster-ref-url">' + escapeHtml(r.url) + '</span>'
                    : '';
                return '<div class="adjuster-ref-card">' +
                    '<span class="adjuster-ref-kind ' + kindClass + '">' + kindLabel + '</span>' +
                    '<div>' + titleHtml + '</div>' +
                    urlHtml +
                    '</div>';
            }).join('');
        }

        // ----- Chat panel -------------------------------------------------
        function nowLabel() {
            return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        function clearChatEmptyState() {
            const messages = $('#adjuster-chat-messages');
            if (!messages) return;
            const empty = messages.querySelector('.adjuster-chat-empty');
            if (empty) empty.remove();
        }

        function appendChatMessage(role, text) {
            const messages = $('#adjuster-chat-messages');
            if (!messages) return null;
            clearChatEmptyState();
            const wrap = document.createElement('div');
            wrap.className = 'adjuster-chat-msg adjuster-chat-msg-' + role;
            const bubble = document.createElement('div');
            bubble.className = 'adjuster-chat-bubble';
            if (role === 'assistant') {
                const md = document.createElement('div');
                md.className = 'agent-md';
                if (text && typeof window.zcRenderMarkdown === 'function') {
                    window.zcRenderMarkdown(md, text);
                } else {
                    md.textContent = text || '';
                }
                bubble.appendChild(md);
            } else {
                bubble.textContent = text || '';
            }
            wrap.appendChild(bubble);
            const meta = document.createElement('div');
            meta.className = 'adjuster-chat-meta';
            meta.textContent = (role === 'user' ? 'You' : 'Loss Adjuster Agent') + ' · ' + nowLabel();
            wrap.appendChild(meta);
            messages.appendChild(wrap);
            messages.scrollTop = messages.scrollHeight;
            return bubble;
        }

        function streamIntoBubble(bubble, fullText) {
            if (!bubble) return;
            let md = bubble.querySelector('.agent-md');
            if (!md) {
                md = document.createElement('div');
                md.className = 'agent-md';
                bubble.innerHTML = '';
                bubble.appendChild(md);
            }
            if (typeof window.zcRenderMarkdown === 'function') {
                window.zcRenderMarkdown(md, fullText || '');
            } else {
                md.textContent = fullText || '';
            }
            const messages = $('#adjuster-chat-messages');
            if (messages) messages.scrollTop = messages.scrollHeight;
        }

        async function sendChatMessage(text) {
            if (!text || !previousResponseId) return;
            const sendBtn = $('#adjuster-chat-send');
            const input = $('#adjuster-chat-input');
            const status = $('#adjuster-chat-status');
            if (sendBtn) sendBtn.disabled = true;
            if (input) input.disabled = true;

            appendChatMessage('user', text);
            const assistantBubble = appendChatMessage('assistant', '');
            if (status) {
                status.hidden = false;
                status.className = 'adjuster-status';
                status.innerHTML = '<span class="spinner"></span>Loss Adjuster Agent is thinking…';
            }

            try {
                const data = await window.zcAgentStream({
                    url: '/loss-adjuster/chat',
                    body: { previousResponseId: previousResponseId, message: text },
                    onDelta: (_chunk, fullText) => streamIntoBubble(assistantBubble, fullText),
                    onError: (msg) => {
                        if (status) {
                            status.className = 'adjuster-status error';
                            status.textContent = 'Agent error: ' + msg;
                        }
                    }
                });

                if (data) {
                    if (data.previousResponseId) previousResponseId = data.previousResponseId;
                    if (data.agentNotes) streamIntoBubble(assistantBubble, data.agentNotes);
                    if (data.agentRawOutput && Array.isArray(data.agentRawOutput.citations)) {
                        mergeCitations(data.agentRawOutput.citations);
                        renderReferences();
                    }
                    if (status) {
                        if (data.agentError) {
                            status.className = 'adjuster-status error';
                            status.textContent = 'Agent error: ' + data.agentError;
                        } else if (!data.agentConfigured) {
                            status.className = 'adjuster-status error';
                            status.textContent =
                                'Loss Adjuster Foundry agent is not configured — chat is unavailable.';
                        } else {
                            status.hidden = true;
                        }
                    }
                } else if (status) {
                    status.className = 'adjuster-status error';
                    status.textContent = 'No response from agent.';
                }
            } catch (err) {
                if (status) {
                    status.className = 'adjuster-status error';
                    status.textContent = 'Failed to send: ' + err.message;
                }
            } finally {
                if (input) {
                    input.disabled = false;
                    input.value = '';
                    input.focus();
                }
                if (sendBtn) sendBtn.disabled = !previousResponseId;
            }
        }

        async function loadClaims() {
            const sel = $('#adjuster-claim-select');
            const empty = $('#adjuster-empty');
            const cardStep = $('#adjuster-claim-card-step');
            const processStep = $('#adjuster-process-step');
            const btn = $('#adjuster-process-btn');
            const status = $('#adjuster-process-status');
            if (sel) sel.innerHTML = '<option value="">— Loading… —</option>';
            if (empty) empty.hidden = true;
            if (cardStep) cardStep.hidden = true;
            if (processStep) processStep.hidden = true;
            if (btn) btn.disabled = true;
            if (status) status.hidden = true;

            try {
                const res = await fetch('/loss-adjuster/claims');
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const claims = await res.json();
                if (!claims.length) {
                    if (sel) sel.innerHTML = '<option value="">— No claims available —</option>';
                    if (empty) empty.hidden = false;
                    return;
                }
                if (sel) sel.innerHTML = '<option value="">— Select a claim —</option>' +
                    claims.map(c =>
                        `<option value="${escapeHtml(c.claimNumber)}">` +
                        `${escapeHtml(c.claimNumber)} — ${escapeHtml(c.customerName)} (${escapeHtml(c.claimType)})` +
                        `</option>`).join('');
            } catch (err) {
                if (sel) sel.innerHTML = '<option value="">— Failed to load —</option>';
                if (status) {
                    status.hidden = false;
                    status.className = 'adjuster-status error';
                    status.textContent = 'Failed to load claims: ' + err.message;
                }
            }
        }

        async function selectClaim(claimNumber) {
            const status = $('#adjuster-process-status');
            if (status) status.hidden = true;
            // Picking a different claim invalidates the previous chat session.
            resetChatAndRefs();
            if (!claimNumber) {
                setSelectedClaim(null);
                return;
            }
            try {
                const res = await fetch(`/loss-adjuster/claims/${encodeURIComponent(claimNumber)}`);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                const claim = await res.json();
                setSelectedClaim(claim);
            } catch (err) {
                setSelectedClaim(null);
                const s = $('#adjuster-process-status');
                if (s) {
                    s.hidden = false;
                    s.className = 'adjuster-status error';
                    s.textContent = 'Failed to load claim: ' + err.message;
                }
            }
        }

        async function processClaim() {
            if (!selectedClaim) return;
            const btn = $('#adjuster-process-btn');
            const status = $('#adjuster-process-status');
            const scope = $('.engage-tabs-scope');
            if (btn) btn.disabled = true;
            if (status) {
                status.hidden = false;
                status.className = 'adjuster-status';
                status.innerHTML = '<span class="spinner"></span>Engaging Loss Adjuster Agent…';
            }
            // Starting a new run resets the conversation thread.
            resetChatAndRefs();

            try {
                const data = await window.zcAgentStream({
                    url: '/loss-adjuster/process',
                    body: { claimNumber: selectedClaim.claimNumber },
                    onDelta: (_chunk, fullText) => {
                        if (window.engageTabsStreamNarrative) {
                            window.engageTabsStreamNarrative(scope, fullText);
                        }
                    },
                    onError: (msg) => {
                        const s = $('#adjuster-process-status');
                        if (s) {
                            s.className = 'adjuster-status error';
                            s.textContent = 'Agent error: ' + msg;
                        }
                    }
                });
                if (!data) throw new Error('No response from agent');

                const s = $('#adjuster-process-status');
                if (s) {
                    if (data.agentNotes) {
                        s.textContent = 'Loss Adjuster Agent produced a report.';
                    } else if (!data.agentConfigured) {
                        s.className = 'adjuster-status error';
                        s.textContent =
                            'Loss Adjuster Foundry agent is not configured. ' +
                            'Set AZURE_AI_PROJECT_ENDPOINT and AZURE_AI_MODEL_DEPLOYMENT_NAME to enable it.';
                    } else {
                        s.className = 'adjuster-status error';
                        s.textContent = data.agentError
                            ? 'Loss Adjuster Agent failed: ' + data.agentError
                            : 'Loss Adjuster Agent returned no narrative.';
                    }
                }

                // Surface input + raw output in the Engage Agent sub-tabs.
                if (window.engageTabsRender) {
                    window.engageTabsRender(scope, data);
                }

                // Capture the conversation thread + citations for follow-up chat.
                if (data.previousResponseId) previousResponseId = data.previousResponseId;
                if (data.agentRawOutput && Array.isArray(data.agentRawOutput.citations)) {
                    mergeCitations(data.agentRawOutput.citations);
                    renderReferences();
                }

                // Reveal the chat step once we have a conversation we can continue.
                if (previousResponseId && data.agentConfigured) {
                    const chatStep = $('#adjuster-chat-step');
                    if (chatStep) chatStep.hidden = false;
                    const sendBtn = $('#adjuster-chat-send');
                    if (sendBtn) sendBtn.disabled = false;
                    const input = $('#adjuster-chat-input');
                    if (input) input.disabled = false;
                }
            } catch (err) {
                const s = $('#adjuster-process-status');
                if (s) {
                    s.className = 'adjuster-status error';
                    s.textContent = 'Failed to process: ' + err.message;
                }
            } finally {
                const b = $('#adjuster-process-btn');
                if (b) b.disabled = !selectedClaim;
            }
        }

        const selectInit = $('#adjuster-claim-select');
        const refreshInit = $('#adjuster-refresh-btn');
        const processInit = $('#adjuster-process-btn');
        const chatFormInit = $('#adjuster-chat-form');
        const chatInputInit = $('#adjuster-chat-input');
        if (selectInit) selectInit.addEventListener('change', () => selectClaim(selectInit.value));
        if (refreshInit) refreshInit.addEventListener('click', loadClaims);
        if (processInit) processInit.addEventListener('click', processClaim);
        if (chatFormInit) {
            chatFormInit.addEventListener('submit', (e) => {
                e.preventDefault();
                const text = (chatInputInit && chatInputInit.value || '').trim();
                if (text) sendChatMessage(text);
            });
        }

        loadClaims();
        }

        init();

        if (!window.__adjusterDemoEnhancedHook) {
            window.__adjusterDemoEnhancedHook = true;
            const hook = () => init();
            if (typeof Blazor !== 'undefined' && typeof Blazor.addEventListener === 'function') {
                Blazor.addEventListener('enhancedload', hook);
            } else {
                document.addEventListener('enhancedload', hook);
            }
        }
    })();
