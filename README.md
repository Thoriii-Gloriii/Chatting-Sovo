# S'ovo Chat

A privacy-first, end-to-end-encrypted chat app. Built as a React + Vite web app, wrapped with Capacitor for a native Android build, and backed by Firebase (Auth + Firestore).

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, `motion` for animation, `lucide-react` for icons
- **Backend:** Firebase Authentication (email/password) and Firestore
- **Mobile:** Capacitor 8 (Android)
- **CI/CD:** GitHub Actions — builds a debug APK and deploys the web build to GitHub Pages on every push to `main`

## Local development

```bash
npm install
npm run dev        # starts the Vite dev server on http://localhost:3000
```

Type-check without emitting:

```bash
npm run lint
```

Production web build:

```bash
npm run build       # outputs to dist/
```

## Android build

The Android project lives in `android/`. To build locally:

```bash
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
```

The debug APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`.

## Firebase configuration

Firebase config lives in `firebase-applet-config.json` (web SDK) and `android/app/google-services.json` (Android SDK). Both point at the `fir-ovo` Firebase project. If you fork this repo for your own Firebase project, replace both files with your own project's config.

> Note: the current `google-services.json`/`apiKey` pair is scoped for the Android app (`com.sovo.chat`). If you see auth failures specifically on the web/Pages build but not in the Android app (or vice versa), check the API key's application restrictions in the Google Cloud Console — a key restricted to the Android package + SHA-1 fingerprint will reject requests from a browser origin.

## CI/CD

Two workflows run on every push to `main`:

- **`.github/workflows/build-apk.yml`** — builds the web app, syncs Capacitor, builds a debug APK, uploads it as a workflow artifact, and updates a rolling `latest` GitHub Release with the APK attached. This workflow needs `permissions: contents: write` since creating/updating a release is a write operation — without it, the `Update Latest Release` step fails with a 403 even though the build itself succeeds.
- **`.github/workflows/deploy-pages.yml`** — builds the web app and deploys it to GitHub Pages. Requires GitHub Pages to be enabled with **Settings → Pages → Build and deployment → Source → GitHub Actions**.

## Known limitations

- Google, Apple, Phone, and Biometric sign-in buttons on the auth screen are UI placeholders only (`handleSocial`) — only email/password auth is wired up to Firebase.
- If a user's Firestore profile document is missing after a successful Firebase Auth sign-in (e.g. an interrupted signup), the app now rebuilds a minimal profile from the Auth record on next sign-in rather than blocking access.
