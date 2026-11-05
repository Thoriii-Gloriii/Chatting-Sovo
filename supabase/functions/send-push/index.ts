import { createClient } from 'npm:@supabase/supabase-js@2';

// Sends a Firebase Cloud Messaging push to the other members of a
// conversation when a row is inserted into public.messages. It is called by a
// Supabase Database Webhook (see supabase/PUSH_SETUP.md).
//
// Messages are end-to-end encrypted, so the notification never includes the
// message text: only who sent it and what kind of message it is.

const NL = String.fromCharCode(10);
const CR = String.fromCharCode(13);

function b64url(input: string | ArrayBuffer): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).split('+').join('-').split('/').join('_').split('=').join('');
}

function pemToBuffer(pem: string): ArrayBuffer {
  const body = pem.split('-----')[2].split(NL).join('').split(CR).join('');
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

let cached: { token: string; exp: number } | null = null;

async function getAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - 60 > now) return cached.token;

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  );
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(header + '.' + claims)
  );
  const jwt = header + '.' + claims + '.' + b64url(signature);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + jwt,
  });
  const json = await res.json();
  if (!json.access_token) throw new Error('Could not get an FCM access token');
  cached = { token: json.access_token, exp: now + (json.expires_in ?? 3600) };
  return json.access_token;
}

function kindOf(msg: { mediaType?: string | null }): string {
  switch (msg.mediaType) {
    case 'image':
      return 'Photo';
    case 'video':
      return 'Video';
    case 'voice_note':
      return 'Voice note';
    case 'audio':
      return 'Audio';
    case 'document':
    case 'encrypted_file':
      return 'Attachment';
    default:
      return 'New message';
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return new Response('unauthorized', { status: 401 });
  }

  const payload = await req.json();
  if (payload.type !== 'INSERT' || payload.table !== 'messages') {
    return new Response('ignored');
  }
  const msg = payload.record;
  if (!msg || !msg.conversationId || !msg.senderId) return new Response('ignored');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: conv } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', msg.conversationId)
    .maybeSingle();
  if (!conv || conv.isMuted) return new Response('nothing to send');

  const recipients = (conv.members as string[]).filter((m) => m !== msg.senderId);
  if (recipients.length === 0) return new Response('nothing to send');

  const { data: rows } = await supabase
    .from('device_tokens')
    .select('token')
    .in('user_id', recipients);
  const tokens = (rows ?? []).map((r: { token: string }) => r.token);
  if (tokens.length === 0) return new Response('no devices');

  const sa = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT')!);
  const bearer = await getAccessToken(sa);

  const sender = msg.senderName || "S'ovo user";
  const title = conv.type === 'group' ? conv.name || "S'ovo Chat" : sender;
  const body = conv.type === 'group' ? sender + ': ' + kindOf(msg) : kindOf(msg);

  const results = await Promise.all(
    tokens.map(async (token: string) => {
      const res = await fetch(
        'https://fcm.googleapis.com/v1/projects/' + sa.project_id + '/messages:send',
        {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              data: { conversationId: String(msg.conversationId), messageId: String(msg.id) },
              android: {
                priority: 'HIGH',
                notification: { channel_id: 'messages', tag: String(msg.conversationId) },
              },
            },
          }),
        }
      );
      if (res.ok) return 'sent';
      const text = await res.text();
      if (res.status === 404 || text.includes('UNREGISTERED')) {
        await supabase.from('device_tokens').delete().eq('token', token);
        return 'removed';
      }
      console.error('FCM error', res.status, text);
      return 'failed';
    })
  );

  return new Response(
    JSON.stringify({ sent: results.filter((r) => r === 'sent').length, total: results.length }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
