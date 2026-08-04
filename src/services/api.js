import { API_URL } from '../config/api';

export const ACCESS_KEY = 'distrito_delivery_token';
export const REFRESH_KEY = 'distrito_delivery_refresh';
export const PROFILE_KEY = 'distrito_delivery_profile';
let refreshPromise = null;

export function accessToken() {
  return sessionStorage.getItem(ACCESS_KEY);
}

export function refreshToken() {
  return sessionStorage.getItem(REFRESH_KEY) || localStorage.getItem(REFRESH_KEY);
}

export function clearCredentials(notice = '') {
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(PROFILE_KEY);
  if (notice) sessionStorage.setItem('distrito_delivery_notice', notice);
}

export function storeCredentials(data, remember = null) {
  if (data.token) sessionStorage.setItem(ACCESS_KEY, data.token);
  if (data.refreshToken) {
    sessionStorage.setItem(REFRESH_KEY, data.refreshToken);
    if (remember === true) localStorage.setItem(REFRESH_KEY, data.refreshToken);
    if (remember === false) localStorage.removeItem(REFRESH_KEY);
  }
  if (data.user) localStorage.setItem(PROFILE_KEY, JSON.stringify(data.user));
}

export async function renewAccessToken() {
  if (refreshPromise) return refreshPromise;
  const stored = refreshToken();
  if (!stored) throw new Error('Tu sesión finalizó');
  refreshPromise = fetch(`${API_URL}/admin/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: stored }),
  }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.token) throw new Error(data.error || 'Tu sesión caducó por inactividad');
    storeCredentials(data);
    return data.token;
  }).catch((error) => {
    clearCredentials(error.message);
    window.dispatchEvent(new CustomEvent('distrito:session-expired', { detail: error.message }));
    throw error;
  }).finally(() => { refreshPromise = null; });
  return refreshPromise;
}

export async function apiFetch(path, options = {}, retry = true) {
  let token = accessToken();
  if (!token && refreshToken()) token = await renewAccessToken();
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (retry && (response.status === 401 || response.status === 403)) {
    const body = await response.clone().json().catch(() => ({}));
    if (response.status === 401 || body.code === 'SESSION_EXPIRED' || /token|sesión|sesion/i.test(body.error || '')) {
      await renewAccessToken();
      return apiFetch(path, options, false);
    }
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || data.message || 'No fue posible completar la operación');
    error.status = response.status;
    error.code = data.code;
    error.data = data;
    throw error;
  }
  return data;
}

export function getDeviceIdentity() {
  let deviceId = localStorage.getItem('distrito_device_id');
  if (!deviceId) {
    deviceId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('distrito_device_id', deviceId);
  }
  const platform = navigator.userAgentData?.platform || navigator.platform || 'Dispositivo';
  const browser = /Edg\//.test(navigator.userAgent) ? 'Edge' : /Firefox\//.test(navigator.userAgent) ? 'Firefox' : /Chrome\//.test(navigator.userAgent) ? 'Chrome' : /Safari\//.test(navigator.userAgent) ? 'Safari' : 'Navegador';
  return { deviceId, deviceName: `${browser} · ${platform}` };
}
