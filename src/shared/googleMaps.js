import { importLibrary, setOptions } from '@googlemaps/js-api-loader';

const libraryPromises = new Map();

export function loadGoogleMaps(apiKey) {
  if (!apiKey) return Promise.reject(new Error('Google Maps no está configurado.'));
  if (!libraryPromises.has(apiKey)) {
    setOptions({
      key: apiKey,
      v: 'weekly',
      language: 'es',
      region: 'CO',
      authReferrerPolicy: 'origin',
    });
    libraryPromises.set(apiKey, Promise.all([
      importLibrary('places'),
      importLibrary('maps'),
      importLibrary('marker'),
      importLibrary('core'),
      importLibrary('routes'),
    ]));
  }
  return libraryPromises.get(apiKey);
}
