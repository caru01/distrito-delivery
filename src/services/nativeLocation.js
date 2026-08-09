import { Capacitor, registerPlugin } from '@capacitor/core';
import { API_URL } from '../config/api';
import { apiFetch, getDeviceIdentity } from './api';

const DeliveryLocation = registerPlugin('DeliveryLocation');

export function isNativeDeliveryApp() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function requestNativeLocationPermissions() {
  if (!isNativeDeliveryApp()) return 'unsupported';
  const permissions = await DeliveryLocation.requestPermissions();
  return permissions.location;
}

export async function checkNativeLocationPermissions() {
  if (!isNativeDeliveryApp()) return 'unsupported';
  const permissions = await DeliveryLocation.checkPermissions();
  return permissions.location;
}

export async function startNativeLocation({ mode = 'FREE', operation = {} } = {}) {
  if (!isNativeDeliveryApp()) return null;
  const permissions = await DeliveryLocation.requestPermissions();
  if (permissions.location !== 'granted') {
    const error = new Error('Android necesita permiso de ubicación para iniciar el turno.');
    error.code = 'LOCATION_PERMISSION_REQUIRED';
    throw error;
  }
  const authorization = await apiFetch('/delivery/native/bootstrap', {
    method: 'POST', body: JSON.stringify({}),
  });
  return DeliveryLocation.start({
    apiUrl: API_URL,
    bootstrapCode: authorization.bootstrapCode,
    deviceId: getDeviceIdentity().deviceId,
    mode,
    deliveryIntervalSeconds: Number(operation.gps_delivery_interval_seconds || 7),
    freeIntervalSeconds: Number(operation.gps_free_interval_seconds || 45),
    queueLimit: Number(operation.offline_location_queue_limit || 2000),
  });
}

export async function setNativeLocationMode(mode) {
  if (!isNativeDeliveryApp()) return null;
  return DeliveryLocation.setMode({ mode });
}

export async function getNativeLocationStatus() {
  if (!isNativeDeliveryApp()) return null;
  return DeliveryLocation.getStatus();
}

export async function stopNativeLocation() {
  if (!isNativeDeliveryApp()) return;
  await DeliveryLocation.stop();
}
