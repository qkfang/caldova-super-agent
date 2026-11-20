// Client Communications page — Voice chat tab (talk to Cara).
// Loaded as a permanent script from App.razor so init runs reliably on full
// page load AND on Blazor enhanced navigation.

    // Two ways to talk to Cara:
    //  1. Real-time speech-to-speech via the Azure AI Foundry Voice Live API.
    //     The backend at /communications/voice-live proxies a
    //     bearer-authenticated WebSocket to Cara's voice agent
    //     (client-communications-voice-agent). The browser captures 24 kHz
    //     mono PCM16 from the mic and plays returned PCM16 audio chunks back
    //     through the Web Audio API. Server-side VAD on the Voice Live side
    //     decides when Cara replies, so the caller can talk naturally and
    //     even barge in.
    //  2. Typed chat (and the suggested opening lines) whenever no Voice Live
    //     call is connected: POST /communications/voice returns a short
    //     spoken-style reply — from the live voice agent when Foundry is
    //     configured, otherwise a deterministic case-aware reply — which the
    //     browser reads aloud with the Web Speech API.
    (function () {
        function initVoice() {
            const root = document.querySelector('.voice-panel');
            if (!root || root.dataset.wired === '1') return;
            root.dataset.wired = '1';

            const $ = sel => root.querySelector(sel);
            const caseSelect = $('#voice-case-select');
            const refreshBtn = $('#voice-refresh-btn');
            const micBtn = $('#voice-mic-btn');
            const micLabel = micBtn.querySelector('.voice-mic-label');
            const wave = $('#voice-wave');
            const statusEl = $('#voice-status');
            const textInput = $('#voice-text-input');
            const sendBtn = $('#voice-text-send');
            const ttsToggle = $('#voice-tts-toggle');
            const transcriptEl = $('#voice-transcript');
            const promptChips = Array.from(root.querySelectorAll('.voice-chip'));

            const SAMPLE_RATE = 24000;
            const FRAME_MS = 50;
            const FRAME_SAMPLES = (SAMPLE_RATE * FRAME_MS) / 1000;
            // Azure neural voice used for Cara on Voice Live calls.
            const VOICE_LIVE_VOICE = 'en-US-Ava:DragonHDLatestNeural';

            const waveBars = Array.from(wave.querySelectorAll('span'));

            let ws = null;
            let connected = false;
            let connecting = false;
            let voiceEnabled = false;
            let micStream = null;
            let micCtx = null;
            let scriptNode = null;
            let analyserIn = null;
            let analyserOut = null;
            let waveRaf = 0;
            let playbackCtx = null;
            let playbackTime = 0;
            let activeSources = [];
            let userTranscriptEl = null;
            let caraTranscriptEl = null;
            let caraSpeaking = false;
            let greetingSent = false;
            // Typed-chat state: the live voice agent chains turns via the
            // previous Foundry response id; reset whenever the caller changes.
            let previousResponseId = null;
            let typedBusy = false;

            function setStatus(text, isError) {
                statusEl.textContent = text;
                statusEl.classList.toggle('error', !!isError);
            }
            function idleStatus() {
                setStatus(voiceEnabled
                    ? 'Idle. Press the mic to start a live call with Cara — or type below.'
                    : 'Voice Live isn\'t configured on this server (set AZURE_AI_PROJECT_ENDPOINT for real-time voice). You can still talk to Cara by typing or tapping an opening line — replies are read aloud when Speak replies is on.',
                    false);
            }
            function clearEmpty() {
                const empty = transcriptEl.querySelector('.voice-empty');
                if (empty) empty.remove();
            }
            function appendMessage(role, text) {
                clearEmpty();
                const div = document.createElement('div');
                div.className = 'voice-msg ' + (role === 'user' ? 'user' : role === 'system' ? 'system' : 'cara');
                if (role !== 'system') {
                    const roleSpan = document.createElement('span');
                    roleSpan.className = 'voice-msg-role';
                    roleSpan.textContent = role === 'user' ? 'You' : 'Cara';
                    div.appendChild(roleSpan);
                }
                const textSpan = document.createElement('span');
                textSpan.className = 'voice-msg-text';
                textSpan.textContent = text;
                div.appendChild(textSpan);
                transcriptEl.appendChild(div);
                transcriptEl.scrollTop = transcriptEl.scrollHeight;
                return div;
            }
            function appendOrUpdate(role, text, currentRef) {
                if (currentRef && currentRef.parentNode) {
                    currentRef.querySelector('.voice-msg-text').textContent = text;
                    transcriptEl.scrollTop = transcriptEl.scrollHeight;
                    return currentRef;
                }
                return appendMessage(role, text);
            }

            function startWaveLoop() {
                if (waveRaf) return;
                const bufIn = analyserIn ? new Uint8Array(analyserIn.frequencyBinCount) : null;
                const bufOut = analyserOut ? new Uint8Array(analyserOut.frequencyBinCount) : null;
                const tick = () => {
                    let useOut = caraSpeaking && analyserOut;
                    let buf;
                    if (useOut) { analyserOut.getByteFrequencyData(bufOut); buf = bufOut; }
                    else if (analyserIn) { analyserIn.getByteFrequencyData(bufIn); buf = bufIn; }
                    if (buf) {
                        for (let i = 0; i < waveBars.length; i++) {
                            const v = buf[i % buf.length] / 255;
                            const h = Math.max(8, Math.min(46, 8 + v * 60));
                            waveBars[i].style.height = h + 'px';
                        }
                    }
                    wave.classList.toggle('speaking', caraSpeaking);
                    waveRaf = requestAnimationFrame(tick);
                };
                wave.classList.add('active');
                waveRaf = requestAnimationFrame(tick);
            }
            function stopWaveLoop() {
                if (waveRaf) cancelAnimationFrame(waveRaf);
                waveRaf = 0;
                wave.classList.remove('active', 'speaking');
                waveBars.forEach(b => { b.style.height = ''; });
            }

            async function probeConfig() {
                try {
                    const res = await fetch('/communications/voice-live/config');
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    const cfg = await res.json();
                    voiceEnabled = !!cfg.enabled;
                } catch (_) {
                    voiceEnabled = false;
                }
                if (!voiceEnabled) {
                    micBtn.classList.add('disabled');
                    micBtn.disabled = true;
                    micLabel.textContent = 'Mic unavailable';
                }
                idleStatus();
            }

            async function loadCases() {
                caseSelect.disabled = true;
                caseSelect.innerHTML = '<option value="">Loading cases…</option>';
                const noContext = '<option value="">No case — a new caller</option>';
                try {
                    const res = await fetch('/communications/cases');
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    const cases = await res.json();
                    caseSelect.innerHTML = [noContext]
                        .concat(cases.map(c => '<option value="' + escapeHtml(c.caseNumber) + '">' +
                            escapeHtml(c.clientName) + ' · ' + escapeHtml(c.caseNumber) + ' · ' + escapeHtml(c.requestType) +
                            '</option>'))
                        .join('');
                } catch (_) {
                    caseSelect.innerHTML = noContext;
                }
                caseSelect.disabled = false;
            }

            async function loadCaseDetail(caseNumber) {
                if (!caseNumber) return null;
                try {
                    const res = await fetch('/communications/cases/' + encodeURIComponent(caseNumber));
                    if (!res.ok) return null;
                    return await res.json();
                } catch (_) { return null; }
            }

            function escapeHtml(s) {
                return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
            }

            function floatToPcm16(f32) {
                const out = new Int16Array(f32.length);
                for (let i = 0; i < f32.length; i++) {
                    let s = Math.max(-1, Math.min(1, f32[i]));
                    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
                }
                return out;
            }
            function pcm16ToFloat(int16) {
                const out = new Float32Array(int16.length);
                for (let i = 0; i < int16.length; i++) out[i] = int16[i] / 0x8000;
                return out;
            }
            function arrayBufferToBase64(buf) {
                let bin = '';
                const bytes = new Uint8Array(buf);
                const chunk = 0x8000;
                for (let i = 0; i < bytes.length; i += chunk) {
                    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
                }
                return btoa(bin);
            }
            function base64ToArrayBuffer(b64) {
                const bin = atob(b64);
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                return bytes.buffer;
            }
            function downsample(buf, srcRate, dstRate) {
                if (dstRate === srcRate) return buf;
                const ratio = srcRate / dstRate;
                const newLen = Math.round(buf.length / ratio);
                const out = new Float32Array(newLen);
                let pos = 0, idx = 0;
                while (pos < newLen) {
                    const next = Math.round((pos + 1) * ratio);
                    let sum = 0, count = 0;
                    for (; idx < next && idx < buf.length; idx++) { sum += buf[idx]; count++; }
                    out[pos++] = count ? sum / count : 0;
                }
                return out;
            }

            async function startCapture() {
                micStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
                try {
                    micCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
                } catch (_) {
                    micCtx = new (window.AudioContext || window.webkitAudioContext)();
                }
                if (micCtx.state === 'suspended') await micCtx.resume();

                const source = micCtx.createMediaStreamSource(micStream);
                analyserIn = micCtx.createAnalyser();
                analyserIn.fftSize = 64;
                source.connect(analyserIn);

                const bufferSize = 2048;
                scriptNode = micCtx.createScriptProcessor(bufferSize, 1, 1);
                let pending = [];

                scriptNode.onaudioprocess = (e) => {
                    if (!ws || ws.readyState !== WebSocket.OPEN) return;
                    let f32 = e.inputBuffer.getChannelData(0);
                    if (Math.abs(micCtx.sampleRate - SAMPLE_RATE) > 1) {
                        f32 = downsample(f32, micCtx.sampleRate, SAMPLE_RATE);
                    }
                    pending.push(new Float32Array(f32));
                    let total = pending.reduce((s, a) => s + a.length, 0);
                    while (total >= FRAME_SAMPLES) {
                        const frame = new Float32Array(FRAME_SAMPLES);
                        let written = 0;
                        while (written < FRAME_SAMPLES && pending.length) {
                            const chunk = pending[0];
                            const need = FRAME_SAMPLES - written;
                            if (chunk.length <= need) {
                                frame.set(chunk, written);
                                written += chunk.length;
                                pending.shift();
                            } else {
                                frame.set(chunk.subarray(0, need), written);
                                pending[0] = chunk.subarray(need);
                                written = FRAME_SAMPLES;
                            }
                        }
                        const pcm = floatToPcm16(frame);
                        const b64 = arrayBufferToBase64(pcm.buffer);
                        try {
                            ws.send(JSON.stringify({
                                type: 'input_audio_buffer.append',
                                audio: b64
                            }));
                        } catch (_) {}
                        total -= FRAME_SAMPLES;
                    }
                };
                source.connect(scriptNode);
                // ScriptProcessor only fires onaudioprocess while it's
                // connected to the audio graph's destination. Route
                // through a muted GainNode so we don't feed the mic back
                // into the speakers (Cara's own voice is handled by the
                // playback context).
                const muteSink = micCtx.createGain();
                muteSink.gain.value = 0;
                scriptNode.connect(muteSink);
                muteSink.connect(micCtx.destination);
            }

            function stopCapture() {
                try { if (scriptNode) scriptNode.disconnect(); } catch (_) {}
                scriptNode = null;
                if (micStream) {
                    micStream.getTracks().forEach(t => t.stop());
                    micStream = null;
                }
                if (micCtx) {
                    try { micCtx.close(); } catch (_) {}
                    micCtx = null;
                }
                analyserIn = null;
            }

            function ensurePlayback() {
                if (playbackCtx) return playbackCtx;
                try {
                    playbackCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
                } catch (_) {
                    playbackCtx = new (window.AudioContext || window.webkitAudioContext)();
                }
                analyserOut = playbackCtx.createAnalyser();
                analyserOut.fftSize = 64;
                analyserOut.connect(playbackCtx.destination);
                playbackTime = playbackCtx.currentTime;
                return playbackCtx;
            }
            function enqueuePcm16(int16) {
                const ctx = ensurePlayback();
                if (ctx.state === 'suspended') ctx.resume();
                const f32 = pcm16ToFloat(int16);
                const buf = ctx.createBuffer(1, f32.length, SAMPLE_RATE);
                buf.getChannelData(0).set(f32);
                const src = ctx.createBufferSource();
                src.buffer = buf;
                src.connect(analyserOut);
                const startAt = Math.max(playbackTime, ctx.currentTime + 0.02);
                src.start(startAt);
                playbackTime = startAt + buf.duration;
                src.onended = () => {
                    activeSources = activeSources.filter(s => s !== src);
                    if (!activeSources.length) {
                        caraSpeaking = false;
                        micBtn.classList.remove('speaking');
                    }
                };
                activeSources.push(src);
                if (!caraSpeaking) {
                    caraSpeaking = true;
                    micBtn.classList.add('speaking');
                }
            }
            function flushPlayback() {
                activeSources.forEach(s => { try { s.stop(); } catch (_) {} });
                activeSources = [];
                if (playbackCtx) playbackTime = playbackCtx.currentTime;
                caraSpeaking = false;
                micBtn.classList.remove('speaking');
            }

            function onServerEvent(evt) {
                try { console.debug('Voice Live event', evt.type, evt); } catch (_) {}
                switch (evt.type) {
                    case 'session.created':
                    case 'session.updated':
                        setStatus('Connected. Speak naturally — Cara is listening.');
                        // Trigger a proactive greeting on the first
                        // session.updated so the caller immediately hears
                        // Cara and we get end-to-end audio confirmation
                        // even if local VAD has trouble detecting their
                        // first utterance. Mirrors the official agent
                        // quickstart pattern.
                        if (!greetingSent && ws && ws.readyState === WebSocket.OPEN) {
                            greetingSent = true;
                            try {
                                // Prime the conversation with a virtual
                                // user prompt so Cara has something to
                                // respond to. response.create on its own
                                // (with no conversation items) returns a
                                // completed response with zero audio.
                                ws.send(JSON.stringify({
                                    type: 'conversation.item.create',
                                    item: {
                                        type: 'message',
                                        role: 'user',
                                        content: [{ type: 'input_text', text: 'Please greet me as Cara from the Caldova Wealth client communications team and ask how you can help today. Keep it short and warm.' }]
                                    }
                                }));
                                ws.send(JSON.stringify({ type: 'response.create' }));
                            } catch (_) {}
                        }
                        break;
                    case 'input_audio_buffer.speech_started':
                        flushPlayback();
                        caraTranscriptEl = null;
                        setStatus('Listening…');
                        break;
                    case 'input_audio_buffer.speech_stopped':
                        setStatus('Cara is thinking…');
                        break;
                    case 'conversation.item.input_audio_transcription.delta': {
                        const prev = userTranscriptEl ? userTranscriptEl.querySelector('.voice-msg-text').textContent : '';
                        userTranscriptEl = appendOrUpdate('user', prev + (evt.delta || ''), userTranscriptEl);
                        break;
                    }
                    case 'conversation.item.input_audio_transcription.completed':
                        if (evt.transcript) {
                            userTranscriptEl = appendOrUpdate('user', evt.transcript, userTranscriptEl);
                        }
                        userTranscriptEl = null;
                        break;
                    case 'response.audio_transcript.delta': {
                        const prev = caraTranscriptEl ? caraTranscriptEl.querySelector('.voice-msg-text').textContent : '';
                        caraTranscriptEl = appendOrUpdate('cara', prev + (evt.delta || ''), caraTranscriptEl);
                        break;
                    }
                    case 'response.audio_transcript.done':
                        if (evt.transcript) {
                            caraTranscriptEl = appendOrUpdate('cara', evt.transcript, caraTranscriptEl);
                        }
                        caraTranscriptEl = null;
                        break;
                    case 'response.audio.delta':
                        if (evt.delta && ttsToggle.checked) {
                            const buf = base64ToArrayBuffer(evt.delta);
                            const i16 = new Int16Array(buf);
                            enqueuePcm16(i16);
                        }
                        break;
                    case 'response.done':
                        setStatus('Ready. Keep talking, or press the mic to end the call.');
                        break;
                    case 'error': {
                        const err = evt.error || {};
                        const msg = err.message || err.code || 'Voice Live error';
                        try { console.error('Voice Live error event', evt); } catch (_) {}
                        setStatus('Voice Live error: ' + msg, true);
                        break;
                    }
                }
            }

            function caseContextText(c) {
                const adviser = (!c.adviserName || /^\s*none/i.test(c.adviserName))
                    ? 'None (direct member)'
                    : c.adviserName + (c.adviserPractice ? ' (' + c.adviserPractice + ')' : '');
                return 'Context for this call (do not read this aloud unless asked). The caller has already been verified.\n' +
                    'Case number: ' + (c.caseNumber || '') + '\n' +
                    'Caller: ' + (c.clientName || '') + '\n' +
                    'Member number: ' + (c.memberNumber || '') + '\n' +
                    'Product: ' + (c.product || '') + '\n' +
                    'Request type: ' + (c.requestType || '') + '\n' +
                    'Received: ' + (c.receivedDate || '') + '\n' +
                    'Adviser: ' + adviser + '\n' +
                    'Request: ' + (c.requestSummary || '') + '\n' +
                    'Amount: ' + (c.amount || '') + '\n' +
                    'Priority: ' + (c.priority || '') + (c.priorityReason ? ' — ' + c.priorityReason : '');
            }

            async function connect() {
                if (connected || connecting) return;
                connecting = true;
                stopSpeaking();
                setStatus('Connecting to Voice Live…');

                const memberCase = await loadCaseDetail(caseSelect.value);

                const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
                const url = proto + '//' + location.host + '/communications/voice-live';

                ws = new WebSocket(url);
                ws.binaryType = 'arraybuffer';

                ws.onopen = async () => {
                    connected = true;
                    connecting = false;
                    micBtn.classList.add('listening');
                    micBtn.setAttribute('aria-pressed', 'true');
                    micLabel.textContent = 'End call';
                    ensurePlayback();

                    // Configure the Voice Live session — PCM16 24 kHz both
                    // ways, server VAD, noise suppression / echo
                    // cancellation. The "instructions" property is
                    // intentionally omitted: Cara's Foundry voice agent
                    // already has its own instructions configured
                    // server-side. We also do NOT set
                    // input_audio_transcription here — the Foundry agent
                    // runs its own transcription pipeline and adding one
                    // client-side can cause the agent to silently drop
                    // turns.
                    const sessionUpdate = {
                        type: 'session.update',
                        session: {
                            modalities: ['audio', 'text'],
                            input_audio_format: 'pcm16',
                            output_audio_format: 'pcm16',
                            input_audio_sampling_rate: SAMPLE_RATE,
                            input_audio_noise_reduction: { type: 'azure_deep_noise_suppression' },
                            input_audio_echo_cancellation: { type: 'server_echo_cancellation' },
                            turn_detection: {
                                type: 'server_vad',
                                threshold: 0.5,
                                prefix_padding_ms: 300,
                                silence_duration_ms: 500
                            },
                            voice: {
                                name: VOICE_LIVE_VOICE,
                                type: 'azure-standard'
                            }
                        }
                    };
                    try { ws.send(JSON.stringify(sessionUpdate)); } catch (_) {}

                    if (memberCase) {
                        try {
                            ws.send(JSON.stringify({
                                type: 'conversation.item.create',
                                item: {
                                    type: 'message',
                                    role: 'user',
                                    content: [{ type: 'input_text', text: caseContextText(memberCase) }]
                                }
                            }));
                        } catch (_) {}
                    }

                    try {
                        await startCapture();
                        startWaveLoop();
                        setStatus('Connected. Say hello — Cara can hear you.');
                    } catch (err) {
                        setStatus('Could not access the microphone: ' + (err.message || err) + '. You can still type below.', true);
                    }
                };

                ws.onmessage = (e) => {
                    if (typeof e.data !== 'string') return;
                    try {
                        const evt = JSON.parse(e.data);
                        onServerEvent(evt);
                    } catch (_) { /* ignore */ }
                };

                ws.onerror = (e) => {
                    try { console.error('Voice Live WebSocket error', e); } catch (_) {}
                    setStatus('Voice Live connection error. Please retry — or type to Cara below.', true);
                };

                ws.onclose = (e) => {
                    try { console.warn('Voice Live WebSocket closed', { code: e && e.code, reason: e && e.reason, wasClean: e && e.wasClean }); } catch (_) {}
                    teardown();
                    const code = e && e.code;
                    const reason = (e && e.reason) ? (' — ' + e.reason) : '';
                    if (code && code !== 1000 && code !== 1005) {
                        setStatus('Call ended (code ' + code + ')' + reason, true);
                    } else {
                        setStatus('Call ended.');
                    }
                };
            }

            function teardown() {
                connected = false;
                connecting = false;
                stopCapture();
                stopWaveLoop();
                flushPlayback();
                micBtn.classList.remove('listening', 'speaking');
                micBtn.setAttribute('aria-pressed', 'false');
                micLabel.textContent = 'Press to talk';
                userTranscriptEl = null;
                caraTranscriptEl = null;
                greetingSent = false;
                if (ws) {
                    try { ws.close(); } catch (_) {}
                    ws = null;
                }
            }

            async function toggleMic() {
                if (connected || connecting) {
                    teardown();
                    setStatus('Call ended.');
                    return;
                }
                if (!voiceEnabled) {
                    idleStatus();
                    return;
                }
                try {
                    await connect();
                } catch (err) {
                    setStatus('Could not start the call: ' + (err.message || err), true);
                    teardown();
                }
            }

            // ── Typed chat fallback (and opening-line chips) ──────────────
            function pickVoice() {
                if (!('speechSynthesis' in window)) return null;
                const voices = window.speechSynthesis.getVoices() || [];
                return voices.find(v => /en-AU/i.test(v.lang) && /female|natasha|karen|catherine/i.test(v.name))
                    || voices.find(v => /en-AU/i.test(v.lang))
                    || voices.find(v => /^en/i.test(v.lang))
                    || null;
            }
            function stopSpeaking() {
                if ('speechSynthesis' in window) {
                    try { window.speechSynthesis.cancel(); } catch (_) {}
                }
                micBtn.classList.remove('speaking');
                if (!connected) wave.classList.remove('active', 'speaking');
            }
            function speak(text) {
                if (!ttsToggle.checked || !('speechSynthesis' in window) || !text) return;
                stopSpeaking();
                const utterance = new SpeechSynthesisUtterance(text);
                const voice = pickVoice();
                if (voice) utterance.voice = voice;
                utterance.lang = voice ? voice.lang : 'en-AU';
                utterance.rate = 1.0;
                utterance.onstart = () => {
                    micBtn.classList.add('speaking');
                    wave.classList.add('active', 'speaking');
                };
                const done = () => {
                    micBtn.classList.remove('speaking');
                    if (!connected) wave.classList.remove('active', 'speaking');
                };
                utterance.onend = done;
                utterance.onerror = done;
                window.speechSynthesis.speak(utterance);
            }
            function setTypedBusy(busy) {
                typedBusy = busy;
                sendBtn.disabled = busy;
                promptChips.forEach(c => { c.disabled = busy; });
            }

            async function sendTyped(text) {
                if (typedBusy) return;
                appendMessage('user', text);
                setTypedBusy(true);
                setStatus('Cara is thinking…');
                try {
                    const res = await fetch('/communications/voice', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            message: text,
                            caseNumber: caseSelect.value || null,
                            previousResponseId: previousResponseId
                        })
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
                    previousResponseId = data.responseId || previousResponseId;
                    appendMessage('cara', data.reply || '');
                    speak(data.reply || '');
                    setStatus(data.agentUsed
                        ? 'Cara (live Foundry voice agent) replied. Keep chatting, or start a live call with the mic.'
                        : voiceEnabled
                            ? 'Cara replied (scripted reply). Press the mic for a live Voice Live call.'
                            : 'Cara replied (scripted reply — Foundry not configured). Keep chatting.');
                } catch (err) {
                    setStatus('Could not reach Cara: ' + (err.message || err), true);
                } finally {
                    setTypedBusy(false);
                }
            }

            function sendText(text) {
                if (!text) return;
                if (ws && ws.readyState === WebSocket.OPEN) {
                    appendMessage('user', text);
                    try {
                        ws.send(JSON.stringify({
                            type: 'conversation.item.create',
                            item: {
                                type: 'message',
                                role: 'user',
                                content: [{ type: 'input_text', text }]
                            }
                        }));
                        ws.send(JSON.stringify({ type: 'response.create' }));
                        setStatus('Cara is thinking…');
                    } catch (_) {}
                    return;
                }
                sendTyped(text);
            }

            micBtn.addEventListener('click', toggleMic);
            refreshBtn.addEventListener('click', loadCases);
            caseSelect.addEventListener('change', () => {
                previousResponseId = null;
                stopSpeaking();
                const label = caseSelect.value
                    ? 'Now speaking with ' + caseSelect.options[caseSelect.selectedIndex].text + ' (verified caller).'
                    : 'Now speaking with a new caller (no case selected).';
                appendMessage('system', label + (connected ? ' End and restart the call so Cara picks up the new context.' : ''));
            });
            sendBtn.addEventListener('click', () => {
                const v = textInput.value.trim();
                if (!v) return;
                textInput.value = '';
                sendText(v);
            });
            textInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    sendBtn.click();
                }
            });
            ttsToggle.addEventListener('change', () => { if (!ttsToggle.checked) stopSpeaking(); });
            promptChips.forEach(chip => {
                chip.addEventListener('click', () => sendText(chip.dataset.prompt || chip.textContent.trim()));
            });
            // Some browsers load speech voices lazily — ask once up front.
            if ('speechSynthesis' in window) {
                try { window.speechSynthesis.getVoices(); } catch (_) {}
            }

            probeConfig();
            loadCases();
        }

        initVoice();

        if (!window.__commsVoiceEnhancedHook) {
            window.__commsVoiceEnhancedHook = true;
            const hook = () => initVoice();
            if (typeof Blazor !== 'undefined' && typeof Blazor.addEventListener === 'function') {
                Blazor.addEventListener('enhancedload', hook);
            } else {
                document.addEventListener('enhancedload', hook);
            }
        }
    })();
