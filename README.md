# S'ovo Chat

A privacy-first, end-to-end-encrypted chat app. React + Vite web app, wrapped with
Capacitor for a native Android build, backed by Supabase (Auth, Postgres, Realtime,
Storage).

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, `motion`, `lucide-react`
- **Backend:** Supabase — Auth, Postgres + Row Level Security, Realtime, Storage
- **Calling:** WebRTC peer-to-peer, signalled over Supabase Realtime broadcast
- **Encryption:** RSA-OAEP 2048 key wrapping + AES-GCM 256 per message (`src/crypto/e2ee.ts`)
- **Mobile:** Capacitor 8 (Android)
- **CI/CD:** GitHub Actions — debug APK on every push to `main`, plus GitHub Pages

## Local development

```bash
npm install --legacy-peer-deps
npm run dev          # Vite dev server on http://localhost:3000
npm run lint         # tsc --noEmit
npm run build        # production web build into dist/
```

## Tests

```bash
npm run test:e2ee    # E2EE encrypt/decrypt round trip, incl. third-party isolation
npm run test:smoke   # boots dist/ in headless Chromium: secure context,
                     # getUserMedia, MediaRecorder, full WebRTC negotiation
```

`test:smoke` needs a Chromium binary; set `PLAYWRIGHT_BROWSERS_PATH` or install
Playwright's browsers first.

## Android build

```bash
npm run build:apk
# → android/app/build/outputs/apk/debug/app-debug.apk
```

Requires JDK 21 and an Android SDK with platform 35 + build-tools 35.

## Supabase setup

Config lives in `supabase-config.json` (URL + publishable anon key — safe to ship;
access control is enforced by RLS, not by hiding this key).

**Run `supabase/schema.sql` in the Supabase SQL editor.** It is idempotent and
creates the tables, RLS policies, RPCs (`toggle_status_like`, `mark_status_viewed`,
`get_my_invite_code`, `resolve_invite`, `start_direct_chat`) and the `avatars` /
`chat-media` storage buckets. Re-run it after pulling: the 1.2 release adds policies
and functions that earlier builds referenced but never had.

## Android permissions — why each one is needed

Capacitor's `BridgeWebChromeClient` translates WebView media requests into Android
runtime permissions. A permission that is **not declared in the manifest can never be
granted**, so the entire request is denied and `getUserMedia()` rejects:

| WebView request | Android permissions required |
|---|---|
| `AUDIO_CAPTURE` (voice notes, calls) | `RECORD_AUDIO` **and** `MODIFY_AUDIO_SETTINGS` |
| `VIDEO_CAPTURE` (video calls, camera) | `CAMERA` |

Picking existing media additionally needs `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO` /
`READ_MEDIA_AUDIO` on Android 13+, or `READ_EXTERNAL_STORAGE` below that.

## Calling

Calls are real WebRTC: DTLS-SRTP encrypted media directly between devices, with SDP
and ICE exchanged over Supabase Realtime broadcast (`sovo-user-<uid>` for the ring,
`sovo-call-<callId>` for negotiation). No media server is involved.

**STUN only by default.** Devices behind carrier-grade NAT or symmetric NAT need a
TURN relay, or ICE will fail after the call rings. To add one, run this once on the
device (from the browser console or a settings hook):

```js
import { setTurnServers } from './src/lib/webrtc';
setTurnServers([{ urls: 'turn:turn.example.com:3478', username: 'u', credential: 'p' }]);
```

Group calls are not supported — they need an SFU. The UI says so rather than
pretending to place one.

## End-to-end encryption — scope

- **Encrypted:** text in **direct** chats. A per-message AES-GCM key is wrapped with
  RSA-OAEP for both the recipient and the sender.
- **Not encrypted:** group chat text (wrapping a key for up to 500 members per message
  is not viable), media and voice notes (stored in Supabase Storage), and status posts.
  Messages carry `isEncrypted` reflecting what actually happened, not a constant `true`.
- Keys live in `localStorage`. Clearing app data or switching devices means older
  messages can no longer be decrypted on that device.

## CI/CD

- **`.github/workflows/build-apk.yml`** — builds the web app, syncs Capacitor, builds a
  debug APK, uploads it as an artifact, and updates the rolling `latest` release. Needs
  `permissions: contents: write`. A manual dispatch can also publish a named/tagged release.
- **`.github/workflows/deploy-pages.yml`** — deploys the web build to GitHub Pages.
  Requires Settings → Pages → Source → GitHub Actions.

Every build is signed with the committed `android/keystore/debug.keystore`, giving a
stable SHA-1 (`44:F2:0B:04:94:14:B5:82:E1:03:A6:C8:A8:04:BF:8C:94:99:26:01`) for
Google Sign-In.

## Known limitations

- Apple, Phone and Biometric sign-in buttons are UI placeholders; email/password and
  Google sign-in are the wired paths.
- Read receipts show `sent` on delivery — there is no per-recipient read tracking yet.
- Calls need TURN on restrictive mobile networks (see above).
- Group calling, and encryption of media/voice notes, are not implemented.
