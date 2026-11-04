'use strict';

const $ = id => document.getElementById(id);
const menuToggle = $('menuToggle');
const nav = $('nav');
const authModal = $('authModal');
const authClose = $('authClose');
const authForm = $('authForm');
const authStatus = $('authStatus');
const authSubmit = $('authSubmit');
const authTitle = $('authTitle');
const authIntro = $('authIntro');
const authTabs = $('authTabs');
const confirmPasswordWrap = $('confirmPasswordWrap');
const authPasswordConfirm = $('authPasswordConfirm');
const accountPanel = $('accountPanel');
const downloadButton = $('downloadButton');
const toast = $('toast');
let authMode = 'login';
let currentUser = null;
let downloadAvailable = false;
let toastTimer = null;

document.getElementById('year').textContent = new Date().getFullYear();

menuToggle.addEventListener('click', () => {
  const opened = nav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(opened));
});
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
}));

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle('error', isError);
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 5200);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: { ...(options.headers || {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}) }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || result.error || `Error ${response.status}`);
  return result;
}

function openAuthModal(mode = 'login') {
  authMode = mode;
  setAuthMode(mode);
  authStatus.textContent = '';
  authStatus.classList.remove('error');
  authModal.classList.add('open');
  authModal.setAttribute('aria-hidden', 'false');
  if (currentUser) showAccountPanel();
  else $('authEmail').focus();
}

function closeAuthModal() {
  authModal.classList.remove('open');
  authModal.setAttribute('aria-hidden', 'true');
}

authClose.addEventListener('click', closeAuthModal);
authModal.addEventListener('click', event => {
  if (event.target === authModal) closeAuthModal();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeAuthModal();
});

function setAuthMode(mode) {
  authMode = mode;
  authForm.hidden = Boolean(currentUser);
  accountPanel.hidden = !currentUser;
  authTabs.hidden = Boolean(currentUser);
  confirmPasswordWrap.hidden = mode !== 'register';
  authPasswordConfirm.required = mode === 'register';
  $('authPassword').autocomplete = mode === 'register' ? 'new-password' : 'current-password';
  authTitle.textContent = mode === 'register' ? 'Crear tu cuenta' : 'Iniciá sesión';
  authIntro.textContent = mode === 'register'
    ? 'Creá tu cuenta para que la compra y las actualizaciones queden vinculadas a vos.'
    : 'Iniciá sesión para comprar SAE RADAR o descargar las actualizaciones de tu cuenta.';
  authSubmit.innerHTML = mode === 'register' ? 'Crear cuenta <span>↗</span>' : 'Iniciar sesión <span>↗</span>';
  authTabs.querySelectorAll('button').forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
}

authTabs.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
  authStatus.textContent = '';
  authStatus.classList.remove('error');
  setAuthMode(button.dataset.mode);
}));

function showAccountPanel() {
  authForm.hidden = true;
  authTabs.hidden = true;
  accountPanel.hidden = false;
  authTitle.textContent = 'Tu cuenta SAE RADAR';
  authIntro.textContent = 'Tu compra y las actualizaciones disponibles se administran desde esta cuenta.';
  $('accountEmail').textContent = currentUser.email;
  const state = $('entitlementState');
  if (currentUser.hasAccess) {
    state.className = 'entitlement-state owned';
    state.textContent = downloadAvailable
      ? '✓ SAE RADAR comprado · Actualizaciones incluidas'
      : '✓ SAE RADAR comprado. El archivo de actualización todavía no está publicado.';
    downloadButton.hidden = !downloadAvailable;
    downloadButton.disabled = false;
  } else {
    state.className = 'entitlement-state not-owned';
    state.textContent = 'Tu cuenta todavía no tiene una compra registrada.';
    downloadButton.hidden = true;
  }
}

function updateAccountUI() {
  const button = $('accountButton');
  button.textContent = currentUser ? 'Mi cuenta ✓' : 'Mi cuenta ↗';
  const planStatus = $('planStatus');
  if (!currentUser) {
    planStatus.textContent = 'Necesitás crear una cuenta e iniciar sesión antes de comprar.';
  } else if (currentUser.hasAccess) {
    planStatus.textContent = 'Esta cuenta ya tiene SAE RADAR. Las actualizaciones se descargan desde Mi cuenta.';
    $('buyButton').innerHTML = 'SAE RADAR comprado <span>✓</span>';
  } else {
    planStatus.textContent = `Sesión iniciada como ${currentUser.email}. Ya podés continuar con la compra.`;
    $('buyButton').textContent = 'Comprar SAE RADAR';
  }
}

async function refreshSession() {
  try {
    const result = await api('/api/auth/me');
    currentUser = result.authenticated ? result.user : null;
    downloadAvailable = Boolean(result.product?.downloadAvailable);
  } catch {
    currentUser = null;
  }
  updateAccountUI();
}

$('accountButton').addEventListener('click', () => openAuthModal('login'));
$('buyButton').addEventListener('click', async () => {
  if (!currentUser) {
    openAuthModal('login');
    authStatus.textContent = 'Para comprar, iniciá sesión o creá una cuenta primero.';
    return;
  }
  if (currentUser.hasAccess) {
    openAuthModal('login');
    return;
  }
  const button = $('buyButton');
  button.disabled = true;
  try {
    await api('/api/checkout', { method: 'POST', body: '{}' });
  } catch (error) {
    showToast(error.message || 'El checkout todavía no está disponible.', true);
  } finally {
    button.disabled = false;
  }
});

authForm.addEventListener('submit', async event => {
  event.preventDefault();
  authStatus.textContent = authMode === 'register' ? 'Creando cuenta…' : 'Iniciando sesión…';
  authStatus.classList.remove('error');
  authSubmit.disabled = true;
  const email = $('authEmail').value.trim();
  const password = $('authPassword').value;
  if (authMode === 'register' && password !== authPasswordConfirm.value) {
    authStatus.textContent = 'Las contraseñas no coinciden.';
    authStatus.classList.add('error');
    authSubmit.disabled = false;
    return;
  }
  try {
    const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const result = await api(endpoint, { method: 'POST', body: JSON.stringify({ email, password }) });
    currentUser = result.user;
    await refreshSession();
    authForm.reset();
    updateAccountUI();
    showAccountPanel();
    authStatus.textContent = '';
    showToast(authMode === 'register' ? 'Cuenta creada. Ya podés volver a Planes para comprar.' : 'Sesión iniciada correctamente.');
  } catch (error) {
    authStatus.textContent = error.message;
    authStatus.classList.add('error');
  } finally {
    authSubmit.disabled = false;
  }
});

$('logoutButton').addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST', body: '{}' }); }
  catch (error) { showToast(error.message, true); return; }
  currentUser = null;
  setAuthMode('login');
  updateAccountUI();
  closeAuthModal();
  showToast('Sesión cerrada.');
});

downloadButton.addEventListener('click', async () => {
  downloadButton.disabled = true;
  downloadButton.textContent = 'Preparando descarga…';
  try {
    const response = await fetch('/api/download/latest', { credentials: 'same-origin' });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message || result.error || 'No se pudo iniciar la descarga.');
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = 'SAE-RADAR-Update';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  } catch (error) {
    showToast(error.message, true);
  } finally {
    downloadButton.disabled = false;
    downloadButton.innerHTML = 'Descargar actualización <span>↓</span>';
  }
});

refreshSession();
