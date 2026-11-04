'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');

loadEnvFile();

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const INQUIRIES_FILE = path.join(DATA_DIR, 'inquiries.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const HOST = process.env.HOST || '0.0.0.0';
const PORT = parsePort(process.env.PORT || '8080');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const SESSION_SECRET = process.env.SESSION_SECRET || (process.env.NODE_ENV === 'production' ? '' : crypto.randomBytes(32).toString('hex'));
const PRODUCT_VERSION = process.env.PRODUCT_VERSION || '0.2.0';
const RADAR_DOWNLOAD_FILE = process.env.RADAR_DOWNLOAD_FILE || '';
const MAX_BODY_BYTES = 16 * 1024;
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 8;
const PRODUCT_PRICE = '4.99';
const PRODUCT_CURRENCY = 'USD';
const hitsByIp = new Map();
let writeQueue = Promise.resolve();
const scryptAsync = promisify(crypto.scrypt);
let pgPool = null;
function databasePool() {
  if (!process.env.DATABASE_URL) return null;
  if (!pgPool) {
    const { Pool } = require('pg');
    pgPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }, max: 5, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 });
  }
  return pgPool;
}
async function initDatabase() {
  const pool = databasePool();
  if (!pool) { if (process.env.NODE_ENV === 'production') throw new Error('DATABASE_URL es obligatorio en producción para conservar cuentas y compras.'); return; }
  await pool.query('CREATE TABLE IF NOT EXISTS sae_radar_state (state_key TEXT PRIMARY KEY, state_value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  for (const [key, value, legacyFile] of [['users', {users:[]}, USERS_FILE], ['orders', [], ORDERS_FILE], ['inquiries', [], INQUIRIES_FILE]]) {
    let initial=value;
    try { const raw=JSON.parse(await fs.readFile(legacyFile,'utf8')); if(key==='users' && Array.isArray(raw.users)) initial=raw; else if(Array.isArray(raw)) initial=raw; } catch {}
    await pool.query('INSERT INTO sae_radar_state(state_key,state_value) VALUES($1,$2::jsonb) ON CONFLICT(state_key) DO NOTHING', [key, JSON.stringify(initial)]);
  }
}
async function dbRead(key, fallback) { const pool=databasePool(); if(!pool) return fallback; const r=await pool.query('SELECT state_value FROM sae_radar_state WHERE state_key=$1',[key]); return r.rows[0]?.state_value ?? fallback; }
async function dbMutate(key, fallback, mutator) {
  const pool=databasePool(); if(!pool) return null;
  const client=await pool.connect();
  try { await client.query('BEGIN'); await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`sae-radar:${key}`]); const r=await client.query('SELECT state_value FROM sae_radar_state WHERE state_key=$1 FOR UPDATE',[key]); const value=r.rows[0]?.state_value ?? fallback; const result=await mutator(value); await client.query('INSERT INTO sae_radar_state(state_key,state_value,updated_at) VALUES($1,$2::jsonb,NOW()) ON CONFLICT(state_key) DO UPDATE SET state_value=EXCLUDED.state_value,updated_at=NOW()',[key,JSON.stringify(value)]); await client.query('COMMIT'); return result; } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

function loadEnvFile() {
  const envPath = path.join(__dirname, '.env');
  try {
    const content = require('node:fs').readFileSync(envPath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i <= 0) continue;
      const key = line.slice(0, i).trim();
      let value = line.slice(i + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT debe estar entre 0 y 65535.');
  return port;
}

function cleanString(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeEmail(value) {
  return cleanString(value, 254).toLowerCase();
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
}

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 10 && password.length <= 128;
}

function validateInquiry(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Formato de consulta inválido.' };
  const name = cleanString(body.name, 80);
  const contact = cleanString(body.contact, 120);
  const requestType = ['beta', 'license'].includes(body.requestType) ? body.requestType : '';
  const message = cleanString(body.message || '', 1500);
  const consent = body.consent === true || body.consent === 'on' || body.consent === 'true';
  if (name.length < 2) return { ok: false, error: 'Escribí un nombre o alias de al menos 2 caracteres.' };
  if (contact.length < 3) return { ok: false, error: 'Escribí un contacto válido.' };
  if (!requestType) return { ok: false, error: 'Seleccioná una opción de consulta.' };
  if (!consent) return { ok: false, error: 'Necesitamos tu consentimiento para guardar la consulta y responderte.' };
  return { ok: true, value: { name, contact, requestType, message } };
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
    '.exe': 'application/vnd.microsoft.portable-executable', '.zip': 'application/zip'
  })[ext] || 'application/octet-stream';
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const data = Buffer.from(JSON.stringify(payload));
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': data.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders
  });
  res.end(data);
}

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
}

async function readJsonBody(req) {
  const contentType = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json') throw Object.assign(new Error('El contenido debe ser JSON.'), { statusCode: 415 });
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > MAX_BODY_BYTES) throw Object.assign(new Error('La solicitud supera el tamaño máximo permitido.'), { statusCode: 413 });
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('La solicitud supera el tamaño máximo permitido.'), { statusCode: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('JSON inválido.'), { statusCode: 400 }); }
}

function requestIp(req) {
  return req.socket.remoteAddress || 'unknown';
}

function isRateLimited(key, max = RATE_LIMIT_MAX) {
  const now = Date.now();
  const previous = hitsByIp.get(key) || [];
  const recent = previous.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= max) {
    hitsByIp.set(key, recent);
    return true;
  }
  recent.push(now);
  hitsByIp.set(key, recent);
  if (hitsByIp.size > 2000) {
    for (const [entryKey, times] of hitsByIp) {
      if (times.every(timestamp => now - timestamp >= RATE_LIMIT_WINDOW_MS)) hitsByIp.delete(entryKey);
    }
  }
  return false;
}

function assertSameOrigin(req) {
  const fetchSite = req.headers['sec-fetch-site'];
  if (fetchSite === 'cross-site') throw Object.assign(new Error('Solicitud de otro sitio bloqueada.'), { statusCode: 403 });
  const origin = req.headers.origin;
  if (!origin) return;
  let parsed;
  try { parsed = new URL(origin); }
  catch { throw Object.assign(new Error('Origen inválido.'), { statusCode: 403 }); }
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!host || parsed.host.toLowerCase() !== String(host).toLowerCase()) {
    throw Object.assign(new Error('Origen no permitido.'), { statusCode: 403 });
  }
}

function cookies(req) {
  const output = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    try { output[key] = decodeURIComponent(value); } catch { output[key] = ''; }
  }
  return output;
}

function signSession(userId, expiresAt) {
  if (SESSION_SECRET.length < 32) throw Object.assign(new Error('Falta configurar SESSION_SECRET (mínimo 32 caracteres).'), { statusCode: 503 });
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: expiresAt })).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifySession(token) {
  if (!token || SESSION_SECRET.length < 32) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest();
  let actual;
  try { actual = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded.sub || !Number.isFinite(decoded.exp) || decoded.exp <= Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch { return null; }
}

function sessionCookie(req, token, maxAge = SESSION_MAX_AGE_SECONDS) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const secure = forwardedProto === 'https' || process.env.NODE_ENV === 'production';
  return `sae_radar_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

async function loadUsers() {
  if (databasePool()) return dbRead('users', { users: [] });
  await fs.mkdir(DATA_DIR, { recursive: true });
  try { const raw=await fs.readFile(USERS_FILE,'utf8'); const parsed=JSON.parse(raw); return Array.isArray(parsed.users)?parsed:{users:[]}; }
  catch(error) { if(error.code==='ENOENT') return {users:[]}; throw new Error('No se pudo leer el registro de cuentas.'); }
}
function saveUsers(store) {
  if (databasePool()) return dbMutate('users', {users:[]}, current => { current.users=store.users; return true; });
  writeQueue=writeQueue.then(async()=>{ await fs.mkdir(DATA_DIR,{recursive:true}); const tmp=`${USERS_FILE}.${process.pid}.tmp`; await fs.writeFile(tmp,JSON.stringify(store,null,2),{encoding:'utf8',mode:0o600}); await fs.rename(tmp,USERS_FILE); }); return writeQueue;
}
async function mutateUsers(mutator) {
  if (databasePool()) return dbMutate('users',{users:[]},mutator);
  let result; writeQueue=writeQueue.then(async()=>{ const store=await loadUsers(); result=await mutator(store); await fs.mkdir(DATA_DIR,{recursive:true}); const tmp=`${USERS_FILE}.${process.pid}.tmp`; await fs.writeFile(tmp,JSON.stringify(store,null,2),{encoding:'utf8',mode:0o600}); await fs.rename(tmp,USERS_FILE); }); await writeQueue; return result;
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scryptAsync(password, salt, 64);
  return `scrypt$${salt}$${Buffer.from(derived).toString('hex')}`;
}

async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [algorithm, salt, hash] = stored.split('$');
  if (algorithm !== 'scrypt' || !salt || !/^[a-f0-9]{128}$/i.test(hash || '')) return false;
  const derived = Buffer.from(await scryptAsync(password, salt, 64));
  const expected = Buffer.from(hash, 'hex');
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    hasAccess: user.hasAccess === true,
    purchasedAt: user.purchasedAt || null,
    createdAt: user.createdAt
  };
}

async function getCurrentUser(req) {
  const token = cookies(req).sae_radar_session;
  const session = verifySession(token);
  if (!session) return null;
  const store = await loadUsers();
  return store.users.find(user => user.id === session.sub) || null;
}

function adminAuthorized(req) {
  if (ADMIN_TOKEN.length < 32 || ADMIN_TOKEN.startsWith('replace_this') || !req.headers.authorization) return false;
  const provided = req.headers.authorization.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
  const a = Buffer.from(provided);
  const b = Buffer.from(ADMIN_TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function loadInquiries() {
  if (databasePool()) return dbRead('inquiries', []);
  await fs.mkdir(DATA_DIR,{recursive:true}); try { const raw=await fs.readFile(INQUIRIES_FILE,'utf8'); const parsed=JSON.parse(raw); return Array.isArray(parsed)?parsed:[]; } catch(error) { if(error.code==='ENOENT') return []; throw new Error('No se pudo leer el registro de consultas.'); }
}
async function appendInquiry(item) {
  if (databasePool()) return dbMutate('inquiries',[],items=>{items.push(item); return true;});
  writeQueue=writeQueue.then(async()=>{ const items=await loadInquiries(); items.push(item); await fs.mkdir(DATA_DIR,{recursive:true}); const tmp=`${INQUIRIES_FILE}.${process.pid}.tmp`; await fs.writeFile(tmp,JSON.stringify(items,null,2),{encoding:'utf8',mode:0o600}); await fs.rename(tmp,INQUIRIES_FILE); }); return writeQueue;
}

async function loadOrders() {
  if (databasePool()) return dbRead('orders', []);
  await fs.mkdir(DATA_DIR,{recursive:true}); try { const parsed=JSON.parse(await fs.readFile(ORDERS_FILE,'utf8')); return Array.isArray(parsed)?parsed:[]; } catch(error) { if(error.code==='ENOENT') return []; throw new Error('No se pudo leer el registro de pedidos.'); }
}
function mutateOrders(mutator) {
  if (databasePool()) return dbMutate('orders',[],mutator);
  let result; writeQueue=writeQueue.then(async()=>{ const orders=await loadOrders(); result=await mutator(orders); await fs.mkdir(DATA_DIR,{recursive:true}); const tmp=`${ORDERS_FILE}.${process.pid}.tmp`; await fs.writeFile(tmp,JSON.stringify(orders,null,2),{encoding:'utf8',mode:0o600}); await fs.rename(tmp,ORDERS_FILE); }); return writeQueue.then(()=>result);
}

function mercadoPagoConfigured() {
  return Boolean(process.env.MP_ACCESS_TOKEN && process.env.MP_PRICE_UYU && /^\d+(\.\d{1,2})?$/.test(process.env.MP_PRICE_UYU) && process.env.SITE_URL && /^https:\/\//i.test(process.env.SITE_URL));
}
function mpPrice() { return Number(process.env.MP_PRICE_UYU || 0).toFixed(2); }
async function mercadoPagoRequest(method, endpoint, body, idempotencyKey) {
  if (!mercadoPagoConfigured()) throw Object.assign(new Error('Mercado Pago todavía no está configurado por el administrador.'),{statusCode:503});
  const headers={ Authorization:`Bearer ${process.env.MP_ACCESS_TOKEN}`, Accept:'application/json', 'Content-Type':'application/json' };
  if(idempotencyKey) headers['X-Idempotency-Key']=idempotencyKey;
  const response=await fetch(`https://api.mercadopago.com${endpoint}`,{method,headers,...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok){ console.error(`[mercadopago] ${method} ${endpoint} respondió ${response.status}: ${String(data.message||data.error||'error').slice(0,180)}`); throw Object.assign(new Error('Mercado Pago no pudo procesar la operación. Revisá la configuración del comercio o intentá más tarde.'),{statusCode:response.status>=500?502:400}); }
  return data;
}
async function createMercadoPagoCheckout(user) {
  const site=new URL(process.env.SITE_URL);
  const localOrderId=crypto.randomUUID();
  const amount=mpPrice();
  const order=await mercadoPagoRequest('POST','/v1/orders',{
    type:'online', processing_mode:'manual', capture_mode:'automatic', total_amount:amount,
    external_reference:localOrderId, description:'SAE RADAR — licencia de compra única y actualizaciones',
    payer:{email:user.email}, items:[{title:'SAE RADAR — licencia y actualizaciones',quantity:1,unit_price:amount}],
    config:{online:{success_url:new URL('/?mp=return',site).toString(),failure_url:new URL('/?mp=failure',site).toString(),pending_url:new URL('/?mp=pending',site).toString(),auto_return:'approved'}}
  },crypto.randomUUID());
  if(!order.id || !order.checkout_url || !/^https:\/\//i.test(order.checkout_url) || Number(order.total_amount).toFixed(2)!==amount || order.currency!=='UYU') {
    console.error('[mercadopago] La orden devuelta no coincide con importe/divisa/URL esperados.');
    throw Object.assign(new Error('No pudimos validar la orden de Mercado Pago. No continúes con el pago.'),{statusCode:502});
  }
  await mutateOrders(items=>{items.push({id:order.id,externalReference:localOrderId,userId:user.id,status:'created',amount,currency:'UYU',provider:'mercadopago',createdAt:new Date().toISOString()});});
  return {orderID:order.id,checkoutUrl:order.checkout_url};
}
async function verifyAndGrantMercadoPagoOrder(user, orderId) {
  if(typeof orderId!=='string' || !/^ORD[A-Z0-9]{10,60}$/i.test(orderId)) throw Object.assign(new Error('Identificador de orden inválido.'),{statusCode:400});
  const localOrders=await loadOrders(); const local=localOrders.find(x=>x.id===orderId && x.userId===user.id && x.provider==='mercadopago');
  if(!local) throw Object.assign(new Error('La orden no pertenece a esta cuenta SAE RADAR.'),{statusCode:404});
  const order=await mercadoPagoRequest('GET',`/v1/orders/${encodeURIComponent(orderId)}`);
  if(order.external_reference!==local.externalReference || Number(order.total_amount).toFixed(2)!==local.amount || Number(order.total_paid_amount).toFixed(2)!==local.amount || order.currency!=='UYU') throw Object.assign(new Error('Mercado Pago todavía no confirmó el importe completo. No se habilitó el acceso.'),{statusCode:409});
  if(order.status!=='processed' || order.status_detail!=='accredited') throw Object.assign(new Error('El pago todavía no está acreditado. No se habilitó el acceso.'),{statusCode:409});
  const updated=await mutateUsers(store=>{const account=store.users.find(x=>x.id===user.id); if(!account)return null; if(!account.hasAccess){account.hasAccess=true;account.purchasedAt=new Date().toISOString();account.purchaseProvider='mercadopago';account.mercadoPagoOrderId=orderId;account.purchaseAmount=local.amount;account.purchaseCurrency='UYU';} return account;});
  if(!updated) throw Object.assign(new Error('El pago fue acreditado, pero no pudimos actualizar la cuenta. Contactá soporte.'),{statusCode:500});
  await mutateOrders(items=>{const saved=items.find(x=>x.id===orderId);if(saved){saved.status='processed';saved.statusDetail='accredited';saved.completedAt=new Date().toISOString();}});
  return {ok:true,user:publicUser(updated),message:'Pago acreditado. SAE RADAR ya está vinculado a tu cuenta.'};
}
function verifyMercadoPagoWebhookSignature(req, dataId) {
  const secret=process.env.MP_WEBHOOK_SECRET; if(!secret) return false;
  const signature=String(req.headers['x-signature']||''); const requestId=String(req.headers['x-request-id']||'');
  const parts=Object.fromEntries(signature.split(',').map(x=>x.trim().split('=')));
  if(!parts.ts || !parts.v1 || !dataId || !requestId) return false;
  const manifest=`id:${String(dataId).toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected=crypto.createHmac('sha256',secret).update(manifest).digest();
  let received; try{received=Buffer.from(parts.v1,'hex')}catch{return false}
  return received.length===expected.length && crypto.timingSafeEqual(received,expected);
}
async function processMercadoPagoWebhook(req, dataId) {
  const order=await mercadoPagoRequest('GET',`/v1/orders/${encodeURIComponent(dataId)}`);
  const localOrders=await loadOrders(); const local=localOrders.find(x=>x.id===order.id && x.provider==='mercadopago');
  if(!local || order.external_reference!==local.externalReference || Number(order.total_amount).toFixed(2)!==local.amount || Number(order.total_paid_amount).toFixed(2)!==local.amount || order.currency!=='UYU') return false;
  if(order.status!=='processed' || order.status_detail!=='accredited') return true;
  const updated=await mutateUsers(store=>{const account=store.users.find(x=>x.id===local.userId);if(!account)return null;if(!account.hasAccess){account.hasAccess=true;account.purchasedAt=new Date().toISOString();account.purchaseProvider='mercadopago';account.mercadoPagoOrderId=order.id;account.purchaseAmount=local.amount;account.purchaseCurrency='UYU';}return account;});
  if(!updated) return false;
  await mutateOrders(items=>{const saved=items.find(x=>x.id===order.id);if(saved){saved.status='processed';saved.statusDetail='accredited';saved.completedAt=new Date().toISOString();}});
  return true;
}

function downloadLatest(req, res, user) {
  if (!user || user.hasAccess !== true) return sendJson(res, 403, { error: 'purchase_required', message: 'Esta cuenta todavía no tiene SAE RADAR comprado.' });
  if (!RADAR_DOWNLOAD_FILE) return sendJson(res, 503, { error: 'download_not_configured', message: 'Tu acceso está reconocido, pero todavía no se configuró el archivo de descarga.' });
  const filePath = path.resolve(RADAR_DOWNLOAD_FILE);
  fs.stat(filePath).then(stat => {
    if (!stat.isFile()) return sendJson(res, 404, { error: 'download_not_found', message: 'El instalador todavía no está disponible.' });
    const fileName = path.basename(filePath);
    res.writeHead(200, {
      'Content-Type': getMimeType(filePath),
      'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename="${fileName.replace(/["\r\n]/g, '')}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    const stream = require('node:fs').createReadStream(filePath);
    stream.on('error', () => { if (!res.headersSent) sendJson(res, 500, { error: 'download_failed' }); else res.destroy(); });
    stream.pipe(res);
  }).catch(error => {
    if (error.code === 'ENOENT') return sendJson(res, 404, { error: 'download_not_found', message: 'El instalador todavía no está disponible.' });
    console.error(`[download] ${error.message}`);
    sendJson(res, 500, { error: 'download_failed' });
  });
}

async function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Método no permitido.' }, { Allow: 'GET, HEAD' });
  let decoded;
  try { decoded = decodeURIComponent(pathname); }
  catch { return sendJson(res, 400, { error: 'Ruta inválida.' }); }
  if (decoded.includes('\0') || decoded.includes('\\')) return sendJson(res, 400, { error: 'Ruta inválida.' });
  if (decoded === '/') decoded = '/index.html';
  const filePath = path.resolve(PUBLIC_DIR, `.${decoded}`);
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) return sendJson(res, 403, { error: 'Acceso denegado.' });
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return sendJson(res, 404, { error: 'No encontrado.' });
    const content = await fs.readFile(filePath);
    res.writeHead(200, {
      'Content-Type': getMimeType(filePath),
      'Content-Length': content.length,
      'Cache-Control': filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return sendJson(res, 404, { error: 'No encontrado.' });
    throw error;
  }
}

function createServer() {
  return http.createServer(async (req, res) => {
    securityHeaders(res);
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;
    try {
      if (pathname === '/api/health' && req.method === 'GET') {
        return sendJson(res, 200, { ok: true, service: 'SAE LIVE RADAR website', accountsEnabled: true, paymentsEnabled: mercadoPagoConfigured(), productVersion: PRODUCT_VERSION });
      }
      if (pathname === '/api/auth/me' && req.method === 'GET') {
        const user = await getCurrentUser(req);
        return sendJson(res, 200, { authenticated: Boolean(user), user: user ? publicUser(user) : null, product: { name: 'SAE RADAR', price: 4.99, currency: 'UYU', version: PRODUCT_VERSION, downloadAvailable: Boolean(RADAR_DOWNLOAD_FILE), paymentsEnabled: mercadoPagoConfigured() } });
      }
      if (pathname === '/api/auth/register' && req.method === 'POST') {
        assertSameOrigin(req);
        if (isRateLimited(`register:${requestIp(req)}`, 5)) return sendJson(res, 429, { error: 'Demasiados intentos de registro. Probá más tarde.' }, { 'Retry-After': '3600' });
        const body = await readJsonBody(req);
        const email = normalizeEmail(body.email);
        const password = body.password;
        if (!validateEmail(email)) return sendJson(res, 400, { error: 'Ingresá un email válido.' });
        if (!validatePassword(password)) return sendJson(res, 400, { error: 'La contraseña de SAE RADAR debe tener entre 10 y 128 caracteres.' });
        if (SESSION_SECRET.length < 32) return sendJson(res, 503, { error: 'El servicio de cuentas no está configurado. Falta SESSION_SECRET.' });
        const passwordHash = await hashPassword(password);
        const user = await mutateUsers(store => {
          if (store.users.some(item => item.email === email)) return null;
          const created = { id: crypto.randomUUID(), email, passwordHash, hasAccess: false, purchasedAt: null, createdAt: new Date().toISOString() };
          store.users.push(created);
          return created;
        });
        if (!user) return sendJson(res, 409, { error: 'Ya existe una cuenta con ese email. Iniciá sesión.' });
        const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
        const token = signSession(user.id, exp);
        return sendJson(res, 201, { ok: true, user: publicUser(user), message: 'Cuenta creada. Para comprar SAE RADAR, continuá desde Planes.' }, { 'Set-Cookie': sessionCookie(req, token) });
      }
      if (pathname === '/api/auth/login' && req.method === 'POST') {
        assertSameOrigin(req);
        if (isRateLimited(`login:${requestIp(req)}`, 10)) return sendJson(res, 429, { error: 'Demasiados intentos de inicio de sesión. Probá más tarde.' }, { 'Retry-After': '3600' });
        const body = await readJsonBody(req);
        const email = normalizeEmail(body.email);
        const password = body.password;
        if (!validateEmail(email) || typeof password !== 'string' || password.length > 128) return sendJson(res, 400, { error: 'Email o contraseña incorrectos.' });
        const store = await loadUsers();
        const user = store.users.find(item => item.email === email);
        const valid = user ? await verifyPassword(password, user.passwordHash) : false;
        if (!valid) return sendJson(res, 401, { error: 'Email o contraseña incorrectos.' });
        const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
        const token = signSession(user.id, exp);
        return sendJson(res, 200, { ok: true, user: publicUser(user) }, { 'Set-Cookie': sessionCookie(req, token) });
      }
      if (pathname === '/api/auth/logout' && req.method === 'POST') {
        assertSameOrigin(req);
        return sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(req, '', 0) });
      }
      if (pathname === '/api/checkout' && req.method === 'POST') {
        assertSameOrigin(req);
        const user = await getCurrentUser(req);
        if (!user) return sendJson(res, 401, { error: 'login_required', message: 'Iniciá sesión o creá una cuenta antes de comprar.' });
        if (user.hasAccess) return sendJson(res, 409, { error: 'already_owned', message: 'Esta cuenta ya tiene SAE RADAR. Podés descargar las actualizaciones desde tu cuenta.' });
        if (!mercadoPagoConfigured()) return sendJson(res, 503, { error: 'checkout_not_configured', message: 'Mercado Pago todavía no está configurado. No se realizó ningún cobro.' });
        if (isRateLimited(`checkout:${user.id}:${requestIp(req)}`, 8)) return sendJson(res, 429, { error: 'checkout_rate_limited', message: 'Demasiados intentos de compra. Probá más tarde.' }, { 'Retry-After': '3600' });
        const checkout = await createMercadoPagoCheckout(user);
        return sendJson(res, 200, { ok: true, ...checkout });
      }
      if (pathname === '/api/checkout/confirm' && req.method === 'POST') {
        assertSameOrigin(req);
        const user = await getCurrentUser(req);
        if (!user) return sendJson(res, 401, { error: 'login_required', message: 'Iniciá sesión para confirmar la compra.' });
        if (!mercadoPagoConfigured()) return sendJson(res, 503, { error: 'checkout_not_configured', message: 'Mercado Pago todavía no está configurado.' });
        if (isRateLimited(`capture:${user.id}:${requestIp(req)}`, 12)) return sendJson(res, 429, { error: 'capture_rate_limited', message: 'Demasiados intentos de verificación. Probá más tarde.' }, { 'Retry-After': '3600' });
        const body = await readJsonBody(req);
        const result = await verifyAndGrantMercadoPagoOrder(user, body.orderID);
        return sendJson(res, 200, result);
      }
      if (pathname === '/api/mercadopago/webhook' && req.method === 'POST') {
        const dataId = url.searchParams.get('data.id') || '';
        if (url.searchParams.get('type') !== 'order' || !verifyMercadoPagoWebhookSignature(req, dataId)) return sendJson(res, 401, { error: 'invalid_signature' });
        const accepted = await processMercadoPagoWebhook(req, dataId);
        return sendJson(res, accepted ? 200 : 404, { ok: accepted });
      }
      if (pathname === '/api/download/latest' && req.method === 'GET') {
        const user = await getCurrentUser(req);
        return downloadLatest(req, res, user);
      }
      if (pathname === '/api/admin/grant-access' && req.method === 'POST') {
        if (!adminAuthorized(req)) return sendJson(res, 401, { error: 'No autorizado.' });
        const body = await readJsonBody(req);
        const email = normalizeEmail(body.email);
        if (!validateEmail(email)) return sendJson(res, 400, { error: 'Email inválido.' });
        const updated = await mutateUsers(store => {
          const user = store.users.find(item => item.email === email);
          if (!user) return null;
          if (!user.hasAccess) {
            user.hasAccess = true;
            user.purchasedAt = new Date().toISOString();
          }
          return user;
        });
        if (!updated) return sendJson(res, 404, { error: 'No existe una cuenta con ese email.' });
        return sendJson(res, 200, { ok: true, user: publicUser(updated), message: 'Acceso vitalicio activado para la cuenta.' });
      }
      if (pathname === '/api/inquiries' && req.method === 'POST') {
        assertSameOrigin(req);
        const ip = requestIp(req);
        if (isRateLimited(`inquiry:${ip}`)) return sendJson(res, 429, { error: 'Demasiadas consultas desde esta conexión. Intentá más tarde.' }, { 'Retry-After': '3600' });
        const body = await readJsonBody(req);
        const validation = validateInquiry(body);
        if (!validation.ok) return sendJson(res, 400, { error: validation.error });
        const item = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: 'new', ...validation.value };
        await appendInquiry(item);
        return sendJson(res, 201, { ok: true, id: item.id, message: 'Consulta recibida.' });
      }
      if (pathname === '/api/admin/inquiries' && req.method === 'GET') {
        if (!adminAuthorized(req)) return sendJson(res, 401, { error: 'No autorizado.' });
        const items = await loadInquiries();
        return sendJson(res, 200, { inquiries: items.slice().reverse() });
      }
      if (pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'Endpoint no encontrado.' });
      return await serveStatic(req, res, pathname);
    } catch (error) {
      const status = Number.isInteger(error.statusCode) ? error.statusCode : 500;
      if (status >= 500) console.error(`[server] ${error.message}`);
      if (!res.headersSent) sendJson(res, status, { error: status >= 500 ? 'Error interno del servidor.' : error.message });
      else res.destroy();
    }
  });
}

if (require.main === module) {
  if (process.env.NODE_ENV === 'production' && SESSION_SECRET.length < 32) {
    console.error('ERROR: configurá SESSION_SECRET con al menos 32 caracteres antes de usar cuentas en producción.');
    process.exit(1);
  }
  initDatabase().then(() => {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(`SAE LIVE RADAR website listening on ${HOST}:${PORT}`);
    console.log('Accounts enabled: yes');
    console.log(`Database: ${databasePool() ? 'PostgreSQL connected' : 'local JSON (development only)'}`);
    console.log(`Payments enabled: ${mercadoPagoConfigured() ? 'yes (Mercado Pago Orders)' : 'no (Mercado Pago variables missing)'}`);
    if (!databasePool()) console.warn('WARNING: DATABASE_URL no está definido; no uses este modo en hosting efímero ni vendas.');
    if (process.env.NODE_ENV !== 'production' && !process.env.SESSION_SECRET) console.warn('WARNING: SESSION_SECRET temporal de desarrollo; las sesiones se invalidan al reiniciar.');
  });
  }).catch(error => { console.error('[startup] ' + error.message); process.exit(1); });
}

module.exports = { validateInquiry, cleanString, getMimeType, parsePort, validateEmail, validatePassword, verifySession, createServer, mercadoPagoConfigured, verifyMercadoPagoWebhookSignature };
