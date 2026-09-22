/**
 * Headless smoke test of the built bundle: boots the real dist/ output in
 * Chromium and asserts the app renders and reaches the auth screen without
 * uncaught errors, then exercises the attachment/recording surfaces.
 */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(ROOT, 'index.html')));
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise((r) => server.listen(4173, r));
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 412, height: 915 },       // Pixel-ish portrait
    permissions: ['microphone', 'camera'],
  });
  const page = await ctx.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  let failures = 0;
  const check = (name, ok, detail = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
    if (!ok) failures++;
  };

  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });

  check('page has a root element', await page.locator('#root').count() === 1);
  check('no uncaught page errors on boot', pageErrors.length === 0, pageErrors.join(' | ').slice(0, 300));

  // Splash runs, then the auth landing appears.
  await page.waitForTimeout(4500);
  const bodyText = await page.locator('body').innerText();
  check('renders past the splash into a real screen', bodyText.trim().length > 20,
        JSON.stringify(bodyText.slice(0, 80)));

  // Secure-context APIs the app depends on.
  const caps = await page.evaluate(() => ({
    isSecureContext: window.isSecureContext,
    subtle: !!(window.crypto && window.crypto.subtle),
    rtc: typeof RTCPeerConnection !== 'undefined',
    gum: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    recorder: typeof MediaRecorder !== 'undefined',
    opus: typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus'),
  }));
  check('secure context (required for crypto.subtle + getUserMedia)', caps.isSecureContext);
  check('crypto.subtle available', caps.subtle);
  check('RTCPeerConnection available', caps.rtc);
  check('getUserMedia available', caps.gum);
  check('MediaRecorder available', caps.recorder);
  check('opus recording container supported', caps.opus);

  // Microphone capture + MediaRecorder actually produce bytes, using the same
  // negotiation order the app uses.
  const recording = await page.evaluate(async () => {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    const mimeType = candidates.find((c) => MediaRecorder.isTypeSupported(c));
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.start(200);
    await new Promise((r) => setTimeout(r, 1200));
    await new Promise((r) => { rec.onstop = r; rec.stop(); });
    stream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(chunks, { type: mimeType });
    return { mimeType, bytes: blob.size, chunks: chunks.length };
  });
  check('voice note capture produces audio bytes', recording.bytes > 0,
        `${recording.bytes} bytes, ${recording.chunks} chunks, ${recording.mimeType}`);

  // A full local WebRTC negotiation, mirroring lib/webrtc.ts's flow.
  const rtc = await page.evaluate(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const a = new RTCPeerConnection({ bundlePolicy: 'max-bundle', rtcpMuxPolicy: 'require' });
    const b = new RTCPeerConnection({ bundlePolicy: 'max-bundle', rtcpMuxPolicy: 'require' });
    stream.getTracks().forEach((t) => a.addTrack(t, stream));

    let remoteTracks = 0;
    b.ontrack = () => { remoteTracks++; };
    a.onicecandidate = (e) => e.candidate && b.addIceCandidate(e.candidate);
    b.onicecandidate = (e) => e.candidate && a.addIceCandidate(e.candidate);

    const offer = await a.createOffer({ offerToReceiveAudio: true });
    await a.setLocalDescription(offer);
    await b.setRemoteDescription(offer);
    const answer = await b.createAnswer();
    await b.setLocalDescription(answer);
    await a.setRemoteDescription(answer);

    const connected = await new Promise((resolve) => {
      const t = setTimeout(() => resolve(a.connectionState), 8000);
      a.onconnectionstatechange = () => {
        if (a.connectionState === 'connected' || a.connectionState === 'failed') {
          clearTimeout(t); resolve(a.connectionState);
        }
      };
    });
    const result = { connected, remoteTracks, hasDtls: !!a.sctp || a.getSenders().length > 0 };
    stream.getTracks().forEach((t) => t.stop());
    a.close(); b.close();
    return result;
  });
  check('WebRTC peer connection reaches "connected"', rtc.connected === 'connected', rtc.connected);
  check('remote media track is received by the callee', rtc.remoteTracks > 0, `${rtc.remoteTracks} track(s)`);

  // Console errors that are not the expected Supabase network failures
  // (no credentials / no network egress to the project in this sandbox).
  const realErrors = consoleErrors.filter(
    (e) => !/supabase|Failed to load resource|net::ERR|fetch|AuthRetryable|NetworkError/i.test(e)
  );
  check('no unexpected console errors', realErrors.length === 0, realErrors.join(' | ').slice(0, 300));

  await page.screenshot({ path: path.join(__dirname, 'smoke-auth-screen.png') });

  await browser.close();
  server.close();
  console.log(failures === 0 ? '\nALL SMOKE TESTS PASSED' : `\n${failures} SMOKE TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
