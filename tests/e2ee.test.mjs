// Round-trip test for the E2EE module, run against Node's WebCrypto with a
// localStorage shim (the module persists keys there).
import { webcrypto } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as esbuild from 'esbuild';

if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
const stores = {};
let active = 'A';
globalThis.localStorage = {
  getItem: (k) => (stores[active]?.[k] ?? null),
  setItem: (k, v) => { (stores[active] ||= {})[k] = v; },
  removeItem: (k) => { delete stores[active]?.[k]; },
};
globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');

const dir = mkdtempSync(join(tmpdir(), 'e2ee-'));
const out = join(dir, 'e2ee.mjs');
await esbuild.build({
  entryPoints: [new URL('../src/crypto/e2ee.ts', import.meta.url).pathname],
  bundle: true, format: 'esm', platform: 'neutral', outfile: out,
});
const e2ee = await import('file://' + out);

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
};

// Alice and Bob each have their own device key store.
active = 'A';
const aliceKey = await e2ee.getPublicKeyB64();
const aliceFp = await e2ee.getKeyFingerprint();
active = 'B';
const bobKey = await e2ee.getPublicKeyB64();
const bobFp = await e2ee.getKeyFingerprint();

check('distinct devices produce distinct keys', aliceKey !== bobKey);
check('fingerprints differ', aliceFp !== bobFp);
check('public key looks like base64 SPKI (>100 chars)', aliceKey.length > 100, `${aliceKey.length} chars`);

// Alice encrypts for Bob.
active = 'A';
const plaintext = "Sharp left at the robots — S'ovo test ✅ 日本語";
const payload = await e2ee.encryptMessage(plaintext, bobKey);
const wire = JSON.stringify(payload);

check('ciphertext does not leak plaintext', !wire.includes('robots'));
check('parseEncryptedText recognises the payload', e2ee.parseEncryptedText(wire) !== null);
check('parseEncryptedText rejects plain text', e2ee.parseEncryptedText('hello there') === null);

// Bob decrypts as recipient.
active = 'B';
const asBob = await e2ee.decryptMessage(e2ee.parseEncryptedText(wire), false);
check('recipient decrypts correctly', asBob === plaintext, JSON.stringify(asBob));

// Alice can re-read her own sent message.
active = 'A';
const asAlice = await e2ee.decryptMessage(e2ee.parseEncryptedText(wire), true);
check('sender can read their own sent message', asAlice === plaintext);

// A third device must not be able to read it.
active = 'C';
const asMallory = await e2ee.decryptMessage(e2ee.parseEncryptedText(wire), false);
check('uninvolved device cannot decrypt', asMallory === null);

// Key persistence across "app restarts".
active = 'A';
const aliceKeyAgain = await e2ee.getPublicKeyB64();
check('key persists across restarts', aliceKeyAgain === aliceKey);

console.log(failures === 0 ? '\nALL E2EE TESTS PASSED' : `\n${failures} E2EE TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
