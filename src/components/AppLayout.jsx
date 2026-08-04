import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { BarChart3, BellRing, Bike, Download, History, Home, LogOut, Settings2, User, Volume2 } from 'lucide-react';
import { Link, NavLink, useLocation } from '../routing';
import { AuthContext } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import useRealtime from '../hooks/useRealtime';
import { deliveryAlertsReady, playNewOrderAlert, unlockDeliveryAlerts } from '../utils/orderAlert';
import useDeliveryLocation from '../hooks/useDeliveryLocation';
import DeliveryOnboarding from './DeliveryOnboarding';

const nav = [
  { to: '/', end: true, label: 'Pedidos', icon: Home },
  { to: '/historial', label: 'Historial', icon: History },
  { to: '/estadisticas', label: 'Estadísticas', icon: BarChart3 },
  { to: '/perfil', label: 'Perfil', icon: User },
];

function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export default function AppLayout({ children }) {
  const { profile, settings, logout } = useContext(AuthContext);
  const { pathname } = useLocation();
  const scrollRegion = useRef(null);
  const [installPrompt, setInstallPrompt] = useState(() => window.__distritoDeliveryInstallPrompt || null);
  const [pushState, setPushState] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const [soundReady, setSoundReady] = useState(deliveryAlertsReady);
  const [orderAlert, setOrderAlert] = useState(null);
  const [activeOrders, setActiveOrders] = useState([]);
  const [wakeLock, setWakeLock] = useState(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [installed, setInstalled] = useState(() => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
  const [gpsPermission, setGpsPermission] = useState('prompt');
  const [gpsError, setGpsError] = useState('');
  const alertTimer = useRef(null);
  const gps = useDeliveryLocation(activeOrders);

  const loadActiveOrders = useCallback(async () => {
    try {
      const data = await apiFetch('/delivery/orders/current');
      setActiveOrders(data.orders || []);
    } catch {}
  }, []);

  const triggerOrderAlert = useCallback(({ orderId = null, count = 1 } = {}) => {
    const played = playNewOrderAlert();
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
  }, []);

  useRealtime(true, ({ event, data }) => {
    window.dispatchEvent(new CustomEvent('distrito:realtime', { detail: { event, data } }));
    if (['order_assigned', 'order_updated', 'order_available'].includes(event)) void loadActiveOrders();
    const becameAvailable = event === 'order_available'
      || (event === 'order_updated' && data?.orderStatus === 'Listo');
    if (becameAvailable && pathname !== '/') triggerOrderAlert({ orderId: Number(data?.orderId) || null });
  });
  useEffect(() => { void loadActiveOrders(); }, [loadActiveOrders]);
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
    if (!navigator.geolocation) {
      setGpsPermission('unsupported');
      setGpsError('Este dispositivo no admite ubicación GPS.');
      return undefined;
    }
    if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
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
  }, []);

  // Abrir onboarding solo si falta algún permiso — después de que la API de permisos responda
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const gpsOk = gpsPermission === 'granted';
      const allReady = installed && soundReady && gpsOk;
      if (!allReady) setOnboardingOpen(true);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [installed, soundReady, gpsPermission]);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice.catch(() => null);
    if (choice?.outcome === 'accepted') setInstalled(true);
    window.__distritoDeliveryInstallPrompt = null;
    setInstallPrompt(null);
  };

  const enableGps = () => {
    setGpsError('');
    if (!navigator.geolocation) {
      setGpsPermission('unsupported');
      return setGpsError('Este dispositivo no admite ubicación GPS.');
    }
    if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
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
    if (enabled) playNewOrderAlert();
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><img src={settings?.logo || '/logo.png'} alt={settings?.restaurant_name || 'Distrito BG'} /><div><b>{settings?.restaurant_name || 'Distrito BG'}</b><span>Delivery</span></div></div>
        <nav>{nav.map(({ icon: Icon, ...item }) => <NavLink key={item.to} {...item}><Icon size={20} />{item.label}</NavLink>)}</nav>
        <div className="sidebar-actions">
          {installPrompt && <button onClick={install}><Download size={19} /> Instalar aplicación</button>}
          {pushState !== 'granted' && pushState !== 'unsupported' && <button onClick={enablePush}><BellRing size={19} /> Activar avisos</button>}
          {!soundReady && <button onClick={enableSound}><Volume2 size={19} /> Activar sonido</button>}
          <button onClick={() => setOnboardingOpen(true)}><Settings2 size={19} /> Configurar dispositivo</button>
          <button onClick={logout}><LogOut size={19} /> Cerrar sesión</button>
        </div>
      </aside>
      <main className="app-main">
        <header className="topbar">
          <div><span className="eyebrow">Operación en vivo</span><strong>{profile?.availability_status || 'Conectando…'}</strong></div>
          <div className="topbar-actions">
            {!soundReady && <button className="sound-enable-button" onClick={enableSound} aria-label="Activar alertas con sonido"><Volume2 size={19} /></button>}
            <div className="driver-chip"><span>{profile?.name?.[0] || profile?.username?.[0] || <Bike size={18} />}</span><div><b>{[profile?.name, profile?.last_name].filter(Boolean).join(' ') || profile?.username}</b><small>{profile?.vehicle_type || 'Domiciliario'}</small></div></div>
          </div>
        </header>
        <div className="page-scroll" ref={scrollRegion}>{React.isValidElement(children) ? React.cloneElement(children, { gps }) : children}</div>
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
        soundReady={soundReady}
        onEnableSound={enableSound}
        onClose={() => setOnboardingOpen(false)}
      />
    </div>
  );
}
