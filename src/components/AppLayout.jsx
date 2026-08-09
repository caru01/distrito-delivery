import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { BarChart3, BellRing, Bike, Download, History, Home, LogOut, Power, Settings2, User, Volume2, Wifi, WifiOff } from 'lucide-react';
import { Link, NavLink, useLocation } from '../routing';
import { AuthContext } from '../context/AuthContext';
import { isSecureDeliveryContext } from '../config/api';
import { apiFetch } from '../services/api';
import useRealtime from '../hooks/useRealtime';
import { deliveryAlertsReady, playNewOrderAlert, unlockDeliveryAlerts } from '../utils/orderAlert';
import useDeliveryLocation from '../hooks/useDeliveryLocation';
import useNativeDeliveryLocation from '../hooks/useNativeDeliveryLocation';
import {
  checkNativeLocationPermissions,
  isNativeDeliveryApp,
  requestNativeLocationPermissions,
  stopNativeLocation,
} from '../services/nativeLocation';
import DeliveryOnboarding from './DeliveryOnboarding';

const nav = [
  { to: '/', end: true, label: 'Pedidos', icon: Home },
  { to: '/historial', label: 'Historial', icon: History },
  { to: '/estadisticas', label: 'Estadísticas', icon: BarChart3 },
  { to: '/perfil', label: 'Perfil', icon: User },
];

const SETUP_DONE_KEY = 'distrito_delivery_setup_done';
const SOUND_CONFIGURED_KEY = 'distrito_delivery_sound_enabled';
const READY_SEEN_KEY = 'distrito_delivery_ready_seen';

function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export default function AppLayout({ children }) {
  const { profile, operation, settings, logout, refreshProfile } = useContext(AuthContext);
  const { pathname } = useLocation();
  const scrollRegion = useRef(null);
  const [installPrompt, setInstallPrompt] = useState(() => window.__distritoDeliveryInstallPrompt || null);
  const [pushState, setPushState] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const [soundReady, setSoundReady] = useState(deliveryAlertsReady);
  const [soundConfigured, setSoundConfigured] = useState(() => localStorage.getItem(SOUND_CONFIGURED_KEY) === 'true');
  const [orderAlert, setOrderAlert] = useState(null);
  const [activeOrders, setActiveOrders] = useState([]);
  const [wakeLock, setWakeLock] = useState(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const nativeApp = isNativeDeliveryApp();
  const [installed, setInstalled] = useState(() => nativeApp || window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
  const [gpsPermission, setGpsPermission] = useState('prompt');
  const [gpsError, setGpsError] = useState('');
  const [shiftBusy, setShiftBusy] = useState(false);
  const [shiftError, setShiftError] = useState('');
  const alertTimer = useRef(null);
  const gpsStatusRef = useRef('unknown');
  const webGps = useDeliveryLocation(activeOrders, { shiftActive: Boolean(profile?.shift_active), operation, disabled: nativeApp });
  const nativeGps = useNativeDeliveryLocation(activeOrders, { shiftActive: Boolean(profile?.shift_active), operation });
  const gps = nativeApp ? nativeGps : webGps;
  useEffect(() => {
    gpsStatusRef.current = ['error', 'sync-error'].includes(gps.status) ? 'unavailable'
      : gps.status === 'idle' ? 'unknown' : 'active';
  }, [gps.status]);

  const loadActiveOrders = useCallback(async () => {
    try {
      const data = await apiFetch('/delivery/orders/current');
      setActiveOrders(data.orders || []);
    } catch {}
  }, []);

  const triggerOrderAlert = useCallback(({ orderId = null, count = 1 } = {}) => {
    const played = playNewOrderAlert(settings || {});
    setSoundReady(played);
    setOrderAlert({ orderId, count });
    window.clearTimeout(alertTimer.current);
    alertTimer.current = window.setTimeout(() => setOrderAlert(null), 9000);
    if (document.visibilityState !== 'visible' && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('Nuevo pedido disponible', {
        body: orderId ? `El pedido #${orderId} está listo para entregar` : `${count} pedidos están listos para entregar`,
        icon: '/icon-192.png',
        tag: orderId ? `pedido-${orderId}` : 'pedidos-disponibles',
      });
    }
  }, [settings]);

  const realtime = useRealtime(true, ({ event, data }) => {
    window.dispatchEvent(new CustomEvent('distrito:realtime', { detail: { event, data } }));
    if (['order_assigned', 'order_updated', 'order_available'].includes(event)) void loadActiveOrders();
    const becameAvailable = event === 'order_available'
      || (event === 'order_updated' && data?.orderStatus === 'Listo');
    if (becameAvailable && pathname !== '/') triggerOrderAlert({ orderId: Number(data?.orderId) || null });
  }, {
    initialReconnectMs: operation?.sse_reconnect_initial_ms,
    maxReconnectMs: operation?.sse_reconnect_max_ms,
  });
  useEffect(() => { void loadActiveOrders(); }, [loadActiveOrders]);
  useEffect(() => {
    if (!profile?.shift_active) return undefined;
    let stopped = false;
    const heartbeat = async () => {
      try {
        await apiFetch('/delivery/shift/heartbeat', {
          method: 'POST', body: JSON.stringify({ gpsStatus: gpsStatusRef.current }),
        });
        if (!stopped) setShiftError('');
      } catch (error) {
        if (!stopped) setShiftError(error.message);
      }
    };
    void heartbeat();
    const interval = Math.min(Math.max(Number(operation?.presence_heartbeat_interval_seconds || 30), 10), 120) * 1000;
    const timer = window.setInterval(heartbeat, interval);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [operation?.presence_heartbeat_interval_seconds, profile?.shift_active]);
  useEffect(() => {
    const refreshActiveOrders = () => { void loadActiveOrders(); };
    window.addEventListener('distrito:active-orders-changed', refreshActiveOrders);
    return () => window.removeEventListener('distrito:active-orders-changed', refreshActiveOrders);
  }, [loadActiveOrders]);
  useEffect(() => { scrollRegion.current?.scrollTo({ top: 0, behavior: 'auto' }); }, [pathname]);

  // Wake Lock API: Keep screen on when there are active orders
  useEffect(() => {
    let currentLock = null;
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && document.visibilityState === 'visible' && activeOrders.length > 0) {
        try {
          currentLock = await navigator.wakeLock.request('screen');
          setWakeLock(currentLock);
        } catch (err) { console.error('Wake Lock error:', err); }
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') requestWakeLock();
    };

    if (activeOrders.length > 0) {
      requestWakeLock();
      document.addEventListener('visibilitychange', handleVisibilityChange);
    } else if (wakeLock) {
      wakeLock.release().catch(() => {}).finally(() => setWakeLock(null));
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (currentLock) currentLock.release().catch(() => {});
    };
  }, [activeOrders.length]);

  useEffect(() => {
    const alertHandler = (event) => triggerOrderAlert(event.detail || {});
    const unlock = () => unlockDeliveryAlerts().then(setSoundReady).catch(() => setSoundReady(false));
    window.addEventListener('distrito:new-order-alert', alertHandler);
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });
    return () => {
      window.removeEventListener('distrito:new-order-alert', alertHandler);
      window.removeEventListener('pointerdown', unlock);
      window.clearTimeout(alertTimer.current);
    };
  }, [triggerOrderAlert]);

  useEffect(() => {
    const handler = () => setInstallPrompt(window.__distritoDeliveryInstallPrompt || null);
    const installedHandler = () => { setInstalled(true); setInstallPrompt(null); window.__distritoDeliveryInstallPrompt = null; };
    window.addEventListener('distrito:install-ready', handler);
    window.addEventListener('appinstalled', installedHandler);
    return () => {
      window.removeEventListener('distrito:install-ready', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  useEffect(() => {
    if (nativeApp) {
      checkNativeLocationPermissions().then(setGpsPermission).catch(() => setGpsPermission('prompt'));
      return undefined;
    }
    if (!navigator.geolocation) {
      setGpsPermission('unsupported');
      setGpsError('Este dispositivo no admite ubicación GPS.');
      return undefined;
    }
    if (!isSecureDeliveryContext()) {
      setGpsPermission('insecure');
      setGpsError('Abre Delivery mediante HTTPS para que el navegador permita compartir ubicación.');
      return undefined;
    }
    let permissionStatus;
    let permissionChangeHandler;
    navigator.permissions?.query?.({ name: 'geolocation' }).then((status) => {
      permissionStatus = status;
      permissionChangeHandler = () => setGpsPermission(status.state);
      permissionChangeHandler();
      status.addEventListener?.('change', permissionChangeHandler);
    }).catch(() => {});
    return () => { permissionStatus?.removeEventListener?.('change', permissionChangeHandler); };
  }, [nativeApp]);

  // La autorización pertenece al navegador; guardamos que este dispositivo ya fue preparado.
  // En cada arranque en frío se muestra una sola confirmación y el toque en "Continuar"
  // vuelve a desbloquear el audio, como exigen iOS y Android.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (gpsPermission === 'requesting') return;
      const setupDone = localStorage.getItem(SETUP_DONE_KEY) === 'true';
      const readySeen = sessionStorage.getItem(READY_SEEN_KEY) === 'true';
      const allReady = installed && soundConfigured && gpsPermission === 'granted';
      if (allReady) {
        localStorage.setItem(SETUP_DONE_KEY, 'true');
      }
      setOnboardingOpen(!(setupDone && readySeen));
    }, 600);
    return () => window.clearTimeout(timer);
  }, [installed, soundConfigured, gpsPermission]);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice.catch(() => null);
    if (choice?.outcome === 'accepted') setInstalled(true);
    window.__distritoDeliveryInstallPrompt = null;
    setInstallPrompt(null);
  };

  const enableGps = async () => {
    setGpsError('');
    if (nativeApp) {
      setGpsPermission('requesting');
      try {
        const permission = await requestNativeLocationPermissions();
        setGpsPermission(permission);
        if (permission !== 'granted') setGpsError('Habilita la ubicación precisa en los ajustes de Android.');
      } catch (error) {
        setGpsPermission('denied');
        setGpsError(error.message || 'Android no concedió la ubicación.');
      }
      return;
    }
    if (!navigator.geolocation) {
      setGpsPermission('unsupported');
      return setGpsError('Este dispositivo no admite ubicación GPS.');
    }
    if (!isSecureDeliveryContext()) {
      setGpsPermission('insecure');
      return setGpsError('Abre Delivery mediante HTTPS para activar la ubicación en vivo.');
    }
    setGpsPermission('requesting');
    navigator.geolocation.getCurrentPosition(() => {
      setGpsPermission('granted');
      setGpsError('');
    }, (error) => {
      setGpsPermission(error.code === 1 ? 'denied' : 'prompt');
      setGpsError(error.code === 1 ? 'Permiso rechazado. Habilita Ubicación para este sitio en los ajustes del navegador.' : (error.message || 'No fue posible obtener la ubicación.'));
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  };

  const enablePush = async () => {
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Este navegador no admite notificaciones push');
      const permission = await Notification.requestPermission();
      setPushState(permission);
      if (permission !== 'granted') return;
      const registration = await navigator.serviceWorker.ready;
      const key = await apiFetch('/push/public-key');
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key.publicKey) });
      await apiFetch('/delivery/push/subscribe', { method: 'POST', body: JSON.stringify({ subscription }) });
    } catch (error) { window.alert(error.message); }
  };

  const enableSound = async () => {
    const enabled = await unlockDeliveryAlerts();
    setSoundReady(enabled);
    if (enabled) {
      localStorage.setItem(SOUND_CONFIGURED_KEY, 'true');
      setSoundConfigured(true);
      playNewOrderAlert(settings || {});
    }
  };

  const finishOnboarding = async () => {
    const unlocked = await unlockDeliveryAlerts().catch(() => false);
    if (unlocked) setSoundReady(true);
    const allReady = installed && (soundConfigured || unlocked) && gpsPermission === 'granted';
    if (unlocked) {
      localStorage.setItem(SOUND_CONFIGURED_KEY, 'true');
      setSoundConfigured(true);
    }
    if (allReady) localStorage.setItem(SETUP_DONE_KEY, 'true');
    sessionStorage.setItem(READY_SEEN_KEY, 'true');
    setOnboardingOpen(false);
  };

  const startShift = async () => {
    setShiftBusy(true); setShiftError('');
    try {
      if (!nativeApp && gpsPermission !== 'granted') {
        setOnboardingOpen(true);
        throw new Error('Permite la ubicación antes de iniciar el turno.');
      }
      try {
        await apiFetch('/delivery/shift/start', { method: 'POST', body: JSON.stringify({}) });
      } catch (error) {
        if (error.code !== 'TRACKING_ACTIVE_ON_ANOTHER_DEVICE') throw error;
        const transfer = window.confirm('Otro dispositivo controla el GPS de este turno. ¿Quieres transferir el seguimiento a este dispositivo?');
        if (!transfer) throw error;
        await apiFetch('/delivery/shift/transfer-device', {
          method: 'POST', body: JSON.stringify({ confirm: true }),
        });
      }
      await refreshProfile();
      await loadActiveOrders();
    } catch (error) {
      setShiftError(error.message);
    } finally {
      setShiftBusy(false);
    }
  };

  const endShift = async () => {
    setShiftBusy(true); setShiftError('');
    try {
      await apiFetch('/delivery/shift/end', { method: 'POST', body: JSON.stringify({}) });
      await stopNativeLocation();
      await refreshProfile();
    } catch (error) {
      setShiftError(error.message);
    } finally {
      setShiftBusy(false);
    }
  };

  const handleLogout = async () => {
    await stopNativeLocation().catch(() => {});
    await logout();
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><img src={settings?.delivery_logo || settings?.logo || '/logo.png'} alt={settings?.restaurant_name || 'Distrito BG'} /><div><b>{settings?.delivery_page_title || settings?.restaurant_name || 'Distrito BG'}</b><span>Delivery</span></div></div>
        <nav>{nav.map(({ icon: Icon, ...item }) => <NavLink key={item.to} {...item}><Icon size={20} />{item.label}</NavLink>)}</nav>
        <div className="sidebar-actions">
          <button className={profile?.shift_active ? 'shift-action is-active' : 'shift-action'} disabled={shiftBusy} onClick={profile?.shift_active ? endShift : startShift}><Power size={19} /> {shiftBusy ? 'Actualizando turno…' : profile?.shift_active ? 'Finalizar turno' : 'Iniciar turno'}</button>
          {installPrompt && <button onClick={install}><Download size={19} /> Instalar aplicación</button>}
          {pushState !== 'granted' && pushState !== 'unsupported' && <button onClick={enablePush}><BellRing size={19} /> Activar avisos</button>}
          {!soundConfigured && <button onClick={enableSound}><Volume2 size={19} /> Activar sonido</button>}
          <button onClick={() => setOnboardingOpen(true)}><Settings2 size={19} /> Configurar dispositivo</button>
          <button onClick={handleLogout}><LogOut size={19} /> Cerrar sesión</button>
        </div>
      </aside>
      <main className="app-main">
        <header className="topbar">
          <div><span className="eyebrow">Operación en vivo</span><strong>{profile?.shift_active ? profile?.availability_status || 'Turno activo' : 'Fuera de turno'}</strong></div>
          <div className="topbar-actions">
            {!soundConfigured && <button className="sound-enable-button" onClick={enableSound} aria-label="Activar alertas con sonido"><Volume2 size={19} /></button>}
            <div className="driver-chip"><span>{profile?.name?.[0] || profile?.username?.[0] || <Bike size={18} />}</span><div><b>{[profile?.name, profile?.last_name].filter(Boolean).join(' ') || profile?.username}</b><small>{profile?.vehicle_type || 'Domiciliario'}</small></div></div>
          </div>
        </header>
        <div className="operation-strip" role="status">
          <span className={profile?.shift_active ? 'is-ok' : 'is-muted'}><Power size={15} /> {profile?.shift_active ? 'Turno activo' : 'Turno cerrado'}</span>
          <span className={gps.status === 'error' ? 'is-danger' : gps.mode === 'OFF' ? 'is-muted' : 'is-ok'}>📍 GPS {gps.mode}{gps.pending ? ` · ${gps.pending} pendiente${gps.pending === 1 ? '' : 's'}` : ''}</span>
          <span className={realtime.status === 'connected' ? 'is-ok' : 'is-warning'}>{realtime.status === 'connected' ? <Wifi size={15} /> : <WifiOff size={15} />} {realtime.status === 'connected' ? 'En línea' : 'Reconectando'}</span>
          <span>Capacidad {Number(profile?.committed_orders || 0)} / {Number(profile?.max_active_orders || 1)}</span>
          <button type="button" disabled={shiftBusy} onClick={profile?.shift_active ? endShift : startShift}>{profile?.shift_active ? 'Finalizar turno' : 'Iniciar turno'}</button>
        </div>
        {shiftError && <div className="shell-alert alert alert-error">{shiftError}</div>}
        <div className="page-scroll" ref={scrollRegion}>{React.isValidElement(children) ? React.cloneElement(children, { gps, realtime }) : children}</div>
      </main>
      {orderAlert && <div className="order-alert-toast" role="status" aria-live="assertive">
        <span><BellRing size={22} /></span>
        <div><b>{orderAlert.count > 1 ? `${orderAlert.count} pedidos disponibles` : 'Nuevo pedido disponible'}</b><small>{orderAlert.orderId ? `Pedido #${orderAlert.orderId} listo para aceptar` : 'Revisa la cola del restaurante'}</small></div>
        <Link to="/" onClick={() => setOrderAlert(null)}>Ver</Link>
      </div>}
      <nav className="bottom-nav">{nav.map(({ icon: Icon, ...item }) => <NavLink key={item.to} {...item}><Icon size={21} /><span>{item.label}</span></NavLink>)}</nav>
      <DeliveryOnboarding
        open={onboardingOpen}
        installed={installed}
        installPrompt={installPrompt}
        onInstall={install}
        gpsPermission={gpsPermission}
        gpsError={gpsError}
        onEnableGps={enableGps}
        soundReady={soundConfigured}
        onEnableSound={enableSound}
        setupComplete={installed && soundConfigured && gpsPermission === 'granted'}
        onClose={finishOnboarding}
      />
    </div>
  );
}
