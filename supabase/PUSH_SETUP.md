# Push notifications setup

Do these once, in order. The app code is already in this branch.

1. Database
   Supabase Dashboard, SQL Editor, New query. Paste supabase/push.sql and Run.

2. Firebase service account
   Firebase Console, Project settings, Service accounts, Generate new private key.
   This must be the same Firebase project that google-services.json in android/app belongs to.
   Keep the downloaded JSON file private. Never commit it to GitHub.

3. Supabase secrets
   Dashboard, Edge Functions, Secrets. Add two secrets:
   FCM_SERVICE_ACCOUNT = the entire contents of the JSON file from step 2
   PUSH_WEBHOOK_SECRET = a long random string you make up (30+ characters)

4. Edge Function
   Dashboard, Edge Functions, Deploy a new function, name it send-push.
   Paste supabase/functions/send-push/index.ts as the code.
   Turn OFF Verify JWT for this function. The webhook proves itself with the secret header instead.

5. Database Webhook
   Dashboard, Database, Webhooks, Create a new hook.
   Table: messages. Events: Insert only.
   Type: Supabase Edge Functions, function: send-push, method POST.
   Add an HTTP header named x-webhook-secret with the same value as PUSH_WEBHOOK_SECRET.

6. Build and test
   Merge this pull request and let the APK build finish. Install the new APK on two phones
   (or one phone and the web app), sign in on both, and allow notifications when asked.
   Fully close the app on one phone, then send it a message from the other.

What the notification shows
   Only the sender name and the kind of message (New message, Photo, Voice note and so on).
   Never the message text, because direct chats are end-to-end encrypted.

Known limits
   Tapping a notification opens the app. It also fires a browser event named
   sovo:open-conversation with the conversation id, so App.tsx can be made to open that
   chat directly in a follow-up change.
   Push works in the Android app only, not in the web version.
