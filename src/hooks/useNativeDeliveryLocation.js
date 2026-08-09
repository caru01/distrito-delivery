import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getNativeLocationStatus,
  isNativeDeliveryApp,
  setNativeLocationMode,
  startNativeLocation,
  stopNativeLocation,
} from '../services/nativeLocation';

const initial = {
  status: 'idle', mode: 'OFF', accuracy: null, latitude: null, longitude: null,
  updatedAt: null, lastSyncedAt: null, pending: 0, error: '', native: true,
};

export default function useNativeDeliveryLocation(orders = [], { shiftActive = false, operation = {} } = {}) {
  const [gps, setGps] = useState(initial);
  const started = useRef(false);
  const activeDelivery = useMemo(() => (Array.isArray(orders) ? orders : [orders]).some((order) => (
    ['recogido', 'en camino'].includes(String(order?.deliveryStatus || '').trim().toLowerCase())
  )), [orders]);
  const mode = shiftActive ? (activeDelivery ? 'DELIVERY' : 'FREE') : 'OFF';

  useEffect(() => {
    if (!isNativeDeliveryApp()) return undefined;
    let active = true;
    const read = async () => {
      try {
        const status = await getNativeLocationStatus();
        if (!active || !status) return;
        setGps({
          status: status.error ? (/GPS DESACTIVADO|PERMISO GPS/i.test(status.error) ? 'error' : 'sync-error') : status.running ? 'sharing' : 'idle',
          mode: status.mode || mode,
          accuracy: Number(status.accuracy) >= 0 ? Math.round(Number(status.accuracy)) : null,
          latitude: status.latitude ?? null,
          longitude: status.longitude ?? null,
          updatedAt: status.lastCaptureAt ? new Date(status.lastCaptureAt).toISOString() : null,
          lastSyncedAt: status.lastSyncedAt ? new Date(status.lastSyncedAt).toISOString() : null,
          pending: Number(status.pending || 0),
          error: status.error || '',
          native: true,
        });
      } catch (error) {
        if (active) setGps((current) => ({ ...current, status: 'error', error: error.message }));
      }
    };
    void read();
    const timer = window.setInterval(read, 10_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [mode]);

  useEffect(() => {
    if (!isNativeDeliveryApp()) return;
    if (!shiftActive) {
      started.current = false;
      void stopNativeLocation().finally(() => setGps((current) => ({ ...current, status: 'idle', mode: 'OFF' })));
      return;
    }
    const activate = async () => {
      try {
        setGps((current) => ({ ...current, status: 'requesting', mode, error: '' }));
        if (!started.current) {
          await startNativeLocation({ mode, operation });
          started.current = true;
        } else {
          await setNativeLocationMode(mode);
        }
        const status = await getNativeLocationStatus();
        setGps((current) => ({
          ...current,
          status: status?.error ? 'sync-error' : 'sharing',
          mode: status?.mode || mode,
          pending: Number(status?.pending || 0),
          error: status?.error || '',
        }));
      } catch (error) {
        started.current = false;
        setGps((current) => ({ ...current, status: 'error', mode, error: error.message }));
      }
    };
    void activate();
  }, [mode, operation, shiftActive]);

  return gps;
}
