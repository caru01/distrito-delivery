import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isSecureDeliveryContext } from '../config/api';
import { apiFetch } from '../services/api';
import {
  countQueuedLocations,
  enqueueLocation,
  listQueuedLocations,
  removeQueuedLocations,
} from '../services/locationQueue';

const initialGps = {
  status: 'idle', mode: 'OFF', accuracy: null, latitude: null, longitude: null,
  updatedAt: null, lastSyncedAt: null, arrivals: {}, pending: 0, error: '',
};

export default function useDeliveryLocation(orders = [], options = {}) {
  const { shiftActive = false, operation = {}, disabled = false } = options;
  const [gps, setGps] = useState(initialGps);
  const lastCaptured = useRef(0);
  const flushing = useRef(false);
  const activeOrderIds = useMemo(() => (Array.isArray(orders) ? orders : [orders])
    .filter((order) => ['recogido', 'en camino'].includes(String(order?.deliveryStatus || '').trim().toLowerCase()))
    .map((order) => Number(order.id))
    .filter(Number.isInteger)
    .sort((a, b) => a - b), [orders]);
  const activeOrderKey = activeOrderIds.join(',');
  const mode = !shiftActive ? 'OFF' : activeOrderIds.length ? 'DELIVERY' : 'FREE';
  const intervalMs = (mode === 'DELIVERY'
    ? Number(operation.gps_delivery_interval_seconds || 7)
    : Number(operation.gps_free_interval_seconds || 45)) * 1000;
  const queueLimit = Number(operation.offline_location_queue_limit || 2000);

  const refreshPending = useCallback(async () => {
    const pending = await countQueuedLocations().catch(() => 0);
    setGps((current) => ({ ...current, pending }));
    return pending;
  }, []);

  const flush = useCallback(async () => {
    if (disabled || flushing.current || !navigator.onLine || !shiftActive) return;
    flushing.current = true;
    try {
      let batch = await listQueuedLocations(100);
      while (batch.length) {
        const result = await apiFetch('/delivery/location/batch', {
          method: 'POST',
          body: JSON.stringify({ points: batch }),
        });
        await removeQueuedLocations(batch.map((point) => point.id));
        setGps((current) => ({
          ...current,
          status: 'sharing',
          mode: result.mode || mode,
          arrivals: { ...current.arrivals, ...(result.arrivals || {}) },
          lastSyncedAt: new Date().toISOString(),
          error: '',
        }));
        batch = await listQueuedLocations(100);
      }
    } catch (error) {
      setGps((current) => ({
        ...current,
        status: navigator.onLine ? 'sync-error' : 'offline',
        error: navigator.onLine ? error.message : 'Sin Internet: el recorrido continúa guardándose en este dispositivo.',
      }));
    } finally {
      flushing.current = false;
      await refreshPending();
    }
  }, [disabled, mode, refreshPending, shiftActive]);

  useEffect(() => {
    if (disabled) return undefined;
    void refreshPending();
    const online = () => { void flush(); };
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [disabled, flush, refreshPending]);

  useEffect(() => {
    if (disabled || !shiftActive) {
      setGps((current) => ({ ...current, status: 'idle', mode: 'OFF', error: '' }));
      return undefined;
    }
    if (!isSecureDeliveryContext()) {
      setGps((current) => ({ ...current, status: 'error', mode, error: 'El GPS requiere abrir Delivery mediante HTTPS.' }));
      return undefined;
    }
    if (!navigator.geolocation) {
      setGps((current) => ({ ...current, status: 'error', mode, error: 'Este dispositivo no permite ubicación GPS.' }));
      return undefined;
    }
    let active = true;
    let wakeLock;
    const requestWakeLock = () => {
      if (mode !== 'DELIVERY' || document.visibilityState !== 'visible') return;
      navigator.wakeLock?.request('screen').then((lock) => { wakeLock = lock; }).catch(() => {});
    };
    const restoreWakeLock = () => { if (!wakeLock || wakeLock.released) requestWakeLock(); };
    requestWakeLock();
    document.addEventListener('visibilitychange', restoreWakeLock);
    setGps((current) => ({ ...current, status: 'requesting', mode, error: '' }));
    const watchId = navigator.geolocation.watchPosition(async (position) => {
      if (!active) return;
      const now = Date.now();
      const { latitude, longitude, accuracy, speed, heading, altitude } = position.coords;
      setGps((current) => ({
        ...current, status: navigator.onLine ? 'capturing' : 'offline', mode,
        accuracy: Math.round(accuracy), latitude, longitude,
        updatedAt: new Date(position.timestamp || now).toISOString(),
        error: navigator.onLine ? '' : 'Sin Internet: el recorrido sigue guardándose.',
      }));
      if (now - lastCaptured.current < intervalMs) return;
      lastCaptured.current = now;
      const point = {
        id: globalThis.crypto?.randomUUID?.() || `${now}-${Math.random().toString(36).slice(2)}`,
        latitude, longitude, accuracy, speed, bearing: heading, altitude,
        capturedAt: new Date(position.timestamp || now).toISOString(),
        mode, provider: 'web-geolocation',
      };
      try {
        await enqueueLocation(point, queueLimit);
        await refreshPending();
        if (navigator.onLine) await flush();
      } catch (error) {
        setGps((current) => ({ ...current, status: 'error', error: error.message || 'No fue posible conservar la ubicación.' }));
      }
    }, (error) => setGps((current) => ({
      ...current, status: 'error', mode,
      error: error.code === 1 ? 'Permiso GPS denegado.' : (error.message || 'Activa la ubicación para continuar.'),
    })), {
      enableHighAccuracy: mode === 'DELIVERY',
      maximumAge: mode === 'DELIVERY' ? 4000 : Math.min(intervalMs, 30_000),
      timeout: mode === 'DELIVERY' ? 15_000 : 30_000,
    });
    return () => {
      active = false;
      navigator.geolocation.clearWatch(watchId);
      document.removeEventListener('visibilitychange', restoreWakeLock);
      wakeLock?.release?.().catch(() => {});
    };
  }, [activeOrderKey, disabled, flush, intervalMs, mode, queueLimit, refreshPending, shiftActive]);

  return gps;
}
