import { Capacitor, registerPlugin } from '@capacitor/core';

const isNative = () => typeof Capacitor !== 'undefined' && Boolean(Capacitor.isNativePlatform?.());

// Obtenemos o registramos el plugin nativo solo si estamos en entorno nativo
const NativeNavigation = isNative() ? registerPlugin('Navigation') : null;

/**
 * Verifica si Google Maps está disponible en el dispositivo.
 */
export async function isGoogleMapsAvailable() {
  if (!isNative() || !NativeNavigation) {
    return { available: false, platform: 'web' };
  }
  try {
    const result = await NativeNavigation.isGoogleMapsAvailable();
    return { available: Boolean(result?.available), platform: 'android' };
  } catch (err) {
    console.warn('Error al verificar Google Maps nativo:', err);
    return { available: false, platform: 'android', error: err.message };
  }
}

/**
 * Verifica si Waze está disponible en el dispositivo.
 */
export async function isWazeAvailable() {
  if (!isNative() || !NativeNavigation) {
    return { available: false, platform: 'web' };
  }
  try {
    const result = await NativeNavigation.isWazeAvailable();
    return { available: Boolean(result?.available), platform: 'android' };
  } catch (err) {
    console.warn('Error al verificar Waze nativo:', err);
    return { available: false, platform: 'android', error: err.message };
  }
}

/**
 * Abre la navegación con Google Maps.
 * En Android nativo: Utiliza el intent nativo google.navigation o fallback web integrado.
 * En Web / PWA / Desktop: Abre directamente la URL oficial en una nueva pestaña.
 */
export async function openGoogleMaps({ latitude = null, longitude = null, address = '' } = {}) {
  const hasCoords = latitude != null && longitude != null;
  const target = hasCoords
    ? `${latitude},${longitude}`
    : encodeURIComponent(address || 'Bucaramanga');

  if (isNative() && NativeNavigation) {
    try {
      const result = await NativeNavigation.openGoogleMaps({
        latitude: hasCoords ? Number(latitude) : null,
        longitude: hasCoords ? Number(longitude) : null,
        address: address || '',
      });
      return result;
    } catch (err) {
      console.warn('Fallo en invocación nativa de Google Maps, ejecutando fallback web:', err);
    }
  }

  // Fallback para Web / PWA / Desktop o si falló el plugin
  try {
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${target}&travelmode=driving`;
    window.open(webUrl, '_blank', 'noopener,noreferrer');
    return { success: true, opened: 'browser', fallback: true };
  } catch (error) {
    return { success: false, error: error.message || 'No fue posible abrir el navegador' };
  }
}

/**
 * Abre la navegación con Waze.
 * En Android nativo: Utiliza el intent nativo waze:// o fallback web integrado.
 * En Web / PWA / Desktop: Abre directamente la URL oficial en una nueva pestaña.
 */
export async function openWaze({ latitude = null, longitude = null, address = '' } = {}) {
  const hasCoords = latitude != null && longitude != null;
  const targetQuery = encodeURIComponent(address || 'Bucaramanga');

  if (isNative() && NativeNavigation) {
    try {
      const result = await NativeNavigation.openWaze({
        latitude: hasCoords ? Number(latitude) : null,
        longitude: hasCoords ? Number(longitude) : null,
        address: address || '',
      });
      return result;
    } catch (err) {
      console.warn('Fallo en invocación nativa de Waze, ejecutando fallback web:', err);
    }
  }

  // Fallback para Web / PWA / Desktop o si falló el plugin
  try {
    const webUrl = hasCoords
      ? `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`
      : `https://waze.com/ul?q=${targetQuery}&navigate=yes`;
    window.open(webUrl, '_blank', 'noopener,noreferrer');
    return { success: true, opened: 'browser', fallback: true };
  } catch (error) {
    return { success: false, error: error.message || 'No fue posible abrir el navegador' };
  }
}
