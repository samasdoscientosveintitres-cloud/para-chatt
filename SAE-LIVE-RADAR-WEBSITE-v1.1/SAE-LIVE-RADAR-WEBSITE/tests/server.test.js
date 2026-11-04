'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sae-radar-test-'));
process.env.SESSION_SECRET = 'test-session-secret-please-change-this-123456789';
process.env.ADMIN_TOKEN = 'test-admin-token-please-change-this-123456789';

const { validateInquiry, cleanString, getMimeType, parsePort, validateEmail, validatePassword, createServer, verifyMercadoPagoWebhookSignature } = require('../server');

test('valid inquiry is normalized', () => {
  const result = validateInquiry({ name: '  Sam  ', contact: 'sam@example.com', requestType: 'beta', message: '  Quiero probar  ', consent: 'on' });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, { name: 'Sam', contact: 'sam@example.com', requestType: 'beta', message: 'Quiero probar' });
});

test('inquiry requires valid contact and consent', () => {
  assert.equal(validateInquiry({ name: 'Sam', contact: 'ab', requestType: 'license', consent: true }).ok, false);
  assert.equal(validateInquiry({ name: 'Sam', contact: 'sam@example.com', requestType: 'license' }).ok, false);
});

test('string cleanup removes control characters and caps length', () => {
  assert.equal(cleanString('  a\n\tb  ', 20), 'a b');
  assert.equal(cleanString('abcdef', 3), 'abc');
});

test('email and password validation', () => {
  assert.equal(validateEmail('person@example.com'), true);
  assert.equal(validateEmail('not-an-email'), false);
  assert.equal(validatePassword('a-secure-test-password'), true);
  assert.equal(validatePassword('short'), false);
});

test('correct MIME types and port validation', () => {
  assert.equal(getMimeType('/app/index.html'), 'text/html; charset=utf-8');
  assert.equal(getMimeType('/app/style.css'), 'text/css; charset=utf-8');
  assert.equal(getMimeType('/app/setup.exe'), 'application/vnd.microsoft.portable-executable');
  assert.equal(parsePort('8080'), 8080);
  assert.equal(parsePort('0'), 0);
  assert.throws(() => parsePort('70000'));
  assert.throws(() => parsePort('abc'));
});

test('accounts require login, preserve purchase entitlement and protect downloads', async t => {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).accountsEnabled, true);

  const registration = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'buyer@example.com', password: 'secure-passphrase-123' })
  });
  assert.equal(registration.status, 201);
  const cookie = registration.headers.get('set-cookie').split(';')[0];
  const registered = await registration.json();
  assert.equal(registered.user.hasAccess, false);

  const me = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } });
  assert.equal((await me.json()).authenticated, true);

  const blockedDownload = await fetch(`${base}/api/download/latest`, { headers: { Cookie: cookie } });
  assert.equal(blockedDownload.status, 403);

  const blockedCheckoutWithoutProvider = await fetch(`${base}/api/checkout`, {
    method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '{}'
  });
  assert.equal(blockedCheckoutWithoutProvider.status, 503);

  const unauthorizedGrant = await fetch(`${base}/api/admin/grant-access`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'buyer@example.com' })
  });
  assert.equal(unauthorizedGrant.status, 401);

  const grant = await fetch(`${base}/api/admin/grant-access`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.ADMIN_TOKEN}` },
    body: JSON.stringify({ email: 'buyer@example.com' })
  });
  assert.equal(grant.status, 200);

  const ownedMe = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } });
  const owned = await ownedMe.json();
  assert.equal(owned.user.hasAccess, true);
  assert.equal(owned.user.email, 'buyer@example.com');

  const duplicate = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'buyer@example.com', password: 'secure-passphrase-123' })
  });
  assert.equal(duplicate.status, 409);

  const login = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'buyer@example.com', password: 'secure-passphrase-123' })
  });
  assert.equal(login.status, 200);
});


test('Mercado Pago webhook signatures are validated against the official manifest', () => {
  const crypto = require('node:crypto');
  const secret = 'test-webhook-secret';
  process.env.MP_WEBHOOK_SECRET = secret;
  const dataId = 'ORD01ABCDEF1234567890';
  const requestId = 'req-123';
  const ts = '1742505638683';
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const hash = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  const req = { headers: { 'x-signature': `ts=${ts},v1=${hash}`, 'x-request-id': requestId } };
  assert.equal(verifyMercadoPagoWebhookSignature(req, dataId), true);
  assert.equal(verifyMercadoPagoWebhookSignature(req, 'ORD01WRONG1234567890'), false);
  delete process.env.MP_WEBHOOK_SECRET;
});
