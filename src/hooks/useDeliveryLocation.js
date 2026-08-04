import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../services/api';

export default function useDeliveryLocation(orders = []) {
  const [gps, setGps] = useState({
    status: 'idle', accuracy: null, latitude: null, longitude: null, updatedAt: null, arrivals: {}, error: '',
  });
  const lastSent = useRef(0);
  const activeOrderIds = useMemo(() => (Array.isArray(orders) ? orders : [orders])
    .filter((order) => String(order?.deliveryStatus || '').trim().toLowerCase() === 'en camino')
    .map((order) => Number(order.id))
    .filter(Number.isInteger)
    .sort((a, b) => a - b), [orders]);
  const activeOrderKey = activeOrderIds.join(',');

  useEffect(() => {
    if (!activeOrderIds.length) {
      setGps({ status: 'idle', accuracy: null, latitude: null, longitude: null, updatedAt: null, arrivals: {}, error: '' });
      return undefined;
    }
    if (!window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setGps((current) => ({ ...current, status: 'error', error: 'El GPS y la validación de llegada requieren abrir Delivery mediante HTTPS.' }));
      return undefined;
    }
    if (!navigator.geolocation) {
      setGps((current) => ({ ...current, status: 'error', error: 'Este dispositivo no permite ubicación GPS' }));
      return undefined;
    }
    let active = true;
    let wakeLock;
    const requestWakeLock = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.wakeLock?.request('screen').then((lock) => { wakeLock = lock; }).catch(() => {});
    };
    requestWakeLock();
    const restoreWakeLock = () => { if (!wakeLock || wakeLock.released) requestWakeLock(); };
    document.addEventListener('visibilitychange', restoreWakeLock);
    setGps((current) => ({ ...current, status: 'requesting', error: '' }));
    const watchId = navigator.geolocation.watchPosition(async (position) => {
      if (!active) return;
      const { latitude, longitude, accuracy, speed, heading } = position.coords;
      setGps((current) => ({
        ...current,
        status: 'sharing',
        accuracy: Math.round(accuracy),
        latitude,
        longitude,
        updatedAt: new Date(position.timestamp || Date.now()).toISOString(),
        error: '',
      }));
      if (Date.now() - lastSent.current < 7000) return;
      lastSent.current = Date.now();
      const results = await Promise.allSettled(activeOrderIds.map((orderId) => apiFetch(`/delivery/orders/${orderId}/location`, {
          method: 'POST',
          body: JSON.stringify({ latitude, longitude, accuracy, speed, heading }),
        })));
      const successCount = results.filter((result) => result.status === 'fulfilled').length;
      if (successCount > 0) {
        const arrivals = results.reduce((current, result, index) => {
          if (result.status === 'fulfilled' && result.value?.arrival) current[activeOrderIds[index]] = result.value.arrival;
          return current;
        }, {});
        setGps((current) => ({
          ...current,
          status: 'sharing',
          accuracy: Math.round(accuracy),
          latitude,
          longitude,
          updatedAt: new Date().toISOString(),
          arrivals: { ...current.arrivals, ...arrivals },
          error: '',
          activeOrders: successCount,
        }));
        window.dispatchEvent(new Event('distrito:activity'));
      } else {
        const firstError = results.find((result) => result.status === 'rejected')?.reason;
        setGps((current) => ({ ...current, error: firstError?.message || 'No fue posible compartir la ubicación' }));
      }
    }, (error) => setGps((current) => ({ ...current, status: 'error', error: error.message || 'Activa la ubicación para continuar' })), {
      enableHighAccuracy: true, maximumAge: 4000, timeout: 15000,
    });
    return () => {
      active = false;
      navigator.geolocation.clearWatch(watchId);
      document.removeEventListener('visibilitychange', restoreWakeLock);
      wakeLock?.release?.().catch(() => {});
    };
  }, [activeOrderKey]);

  return gps;
}
