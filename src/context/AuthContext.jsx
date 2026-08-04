import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_URL } from '../config/api';
import {
  PROFILE_KEY, accessToken, apiFetch, clearCredentials,
  getDeviceIdentity, refreshToken, renewAccessToken, storeCredentials,
} from '../services/api';

export const AuthContext = createContext(null);
const DELIVERY_ROLES = ['Domiciliario', 'Repartidor'];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState(null);
  const lastRefresh = useRef(Date.now());

  const applyUser = useCallback((data) => {
    if (!DELIVERY_ROLES.includes(data.user?.role)) throw new Error('Esta cuenta no tiene el rol Domiciliario');
    const nextUser = { ...data.user, must_change_password: Boolean(data.must_change_password) };
    storeCredentials({ ...data, user: nextUser });
    setUser(nextUser);
  }, []);

  const verify = useCallback(async () => {
    if (!accessToken() && !refreshToken()) {
      setUser(null);
      setProfile(null);
      setSettings(null);
      return false;
    }
    try {
      const data = await apiFetch('/admin/verify');
      applyUser(data);
      const [delivery, configuration] = await Promise.all([apiFetch('/delivery/me'), apiFetch('/admin/settings')]);
      setProfile(delivery.profile);
      setSettings(configuration.settings || null);
      if (configuration.settings?.web_primary_color) {
        document.documentElement.style.setProperty('--gold', configuration.settings.web_primary_color);
        document.documentElement.style.setProperty('--gold-light', configuration.settings.web_primary_color);
      }
      return true;
    } catch (error) {
      if (/rol|acceso a Distrito Delivery/i.test(error.message)) {
        await apiFetch('/admin/logout', { method: 'POST' }).catch(() => {});
      }
      clearCredentials(error.message);
      setUser(null);
      setProfile(null);
      setSettings(null);
      return false;
    }
  }, [applyUser]);

  useEffect(() => { verify().finally(() => setLoading(false)); }, [verify]);

  useEffect(() => {
    const expired = (event) => {
      setUser(null);
      setProfile(null);
      setSettings(null);
      setLoading(false);
      if (event.detail) sessionStorage.setItem('distrito_delivery_notice', event.detail);
    };
    const returnToApp = () => { if (document.visibilityState === 'visible') verify(); };
    window.addEventListener('distrito:session-expired', expired);
    window.addEventListener('focus', returnToApp);
    document.addEventListener('visibilitychange', returnToApp);
    return () => {
      window.removeEventListener('distrito:session-expired', expired);
      window.removeEventListener('focus', returnToApp);
      document.removeEventListener('visibilitychange', returnToApp);
    };
  }, [verify]);

  useEffect(() => {
    if (!user) return undefined;
    const timer = window.setInterval(() => {
      if (Date.now() - lastRefresh.current >= 5 * 60_000) {
        lastRefresh.current = Date.now(); renewAccessToken().catch(() => {});
      }
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [user]);

  const login = useCallback(async ({ username, password, remember }) => {
    const response = await fetch(`${API_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, ...getDeviceIdentity() }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || 'No fue posible iniciar sesión');
      error.data = data;
      throw error;
    }
    if (!DELIVERY_ROLES.includes(data.user?.role)) {
      await fetch(`${API_URL}/admin/logout`, { method: 'POST', headers: { Authorization: `Bearer ${data.token}` } }).catch(() => {});
      throw new Error('Esta cuenta no tiene acceso a Distrito Delivery');
    }
    const nextUser = { ...data.user, must_change_password: Boolean(data.must_change_password) };
    lastRefresh.current = Date.now();
    storeCredentials({ ...data, user: nextUser }, remember);
    setUser(nextUser);
    const delivery = await apiFetch('/delivery/me');
    setProfile(delivery.profile);
    const configuration = await apiFetch('/admin/settings');
    setSettings(configuration.settings || null);
    if (configuration.settings?.web_primary_color) {
      document.documentElement.style.setProperty('--gold', configuration.settings.web_primary_color);
      document.documentElement.style.setProperty('--gold-light', configuration.settings.web_primary_color);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker?.ready;
      const subscription = await registration?.pushManager?.getSubscription();
      if (subscription) {
        await apiFetch('/delivery/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint: subscription.endpoint }) });
        await subscription.unsubscribe();
      }
    } catch {}
    try { await apiFetch('/delivery/availability', { method: 'POST', body: JSON.stringify({ status: 'Desconectado' }) }); } catch {}
    try { await apiFetch('/admin/logout', { method: 'POST' }); } catch {}
    clearCredentials();
    setUser(null);
    setProfile(null);
    setSettings(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const data = await apiFetch('/delivery/me');
    setProfile(data.profile);
    return data.profile;
  }, []);

  const value = useMemo(() => ({ user, profile, settings, loading, isAuthenticated: Boolean(user), login, logout, verify, refreshProfile }), [user, profile, settings, loading, login, logout, verify, refreshProfile]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
