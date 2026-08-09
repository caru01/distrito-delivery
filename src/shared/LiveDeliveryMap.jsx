import React, { useEffect, useMemo, useRef, useState } from 'react';
import { loadGoogleMaps } from './googleMaps.js';
import './live-map.css';

const DEFAULT_STORE = {
  latitude: 10.4631,
  longitude: -73.2532,
  name: 'Distrito BG',
  address: 'Valledupar, Colombia',
};

function validCoordinate(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function pointFrom(value) {
  const latitude = validCoordinate(value?.latitude, -90, 90);
  const longitude = validCoordinate(value?.longitude, -180, 180);
  return latitude == null || longitude == null ? null : { lat: latitude, lng: longitude };
}

function markerContent(kind, label, detail = '', selected = false, status = '') {
  const root = document.createElement('div');
  root.className = `live-map-marker live-map-marker--${kind}${selected ? ' is-selected' : ''}${status ? ` is-${String(status).toLowerCase()}` : ''}`;

  const copy = document.createElement('span');
  copy.className = 'live-map-marker__copy';
  const name = document.createElement('strong');
  name.textContent = label;
  copy.appendChild(name);
  if (detail) {
    const secondary = document.createElement('small');
    secondary.textContent = detail;
    copy.appendChild(secondary);
  }

  const icon = document.createElement('span');
  icon.className = 'live-map-marker__icon';
  icon.textContent = kind === 'driver' ? '🛵' : kind === 'store' ? '🏪' : '📍';
  root.append(copy, icon);
  return root;
}

export default function LiveDeliveryMap({
  apiKey = '',
  mapId = 'DEMO_MAP_ID',
  store,
  destinations = [], // Array of destinations
  drivers = [],
  trail = [],
  selectedDriverId = null,
  onDriverSelect,
  showJourney = false,
  className = '',
  ariaLabel = 'Mapa de domicilios en vivo',
}) {
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const mapsLibraryRef = useRef(null);
  const markerLibraryRef = useRef(null);
  const coreLibraryRef = useRef(null);
  const routesLibraryRef = useRef(null);
  const directionsServiceRef = useRef(null);
  const directionsRendererRef = useRef(null);

  const staticMarkersRef = useRef([]);
  const driverMarkersRef = useRef(new Map());
  const linesRef = useRef([]);
  const fitSignatureRef = useRef('');
  const routeSignatureRef = useRef('');
  const onDriverSelectRef = useRef(onDriverSelect);
  const [status, setStatus] = useState(apiKey ? 'loading' : 'unavailable');

  useEffect(() => { onDriverSelectRef.current = onDriverSelect; }, [onDriverSelect]);

  const normalizedStore = useMemo(() => ({ ...DEFAULT_STORE, ...(store || {}) }), [store]);
  const storePoint = pointFrom(normalizedStore) || pointFrom(DEFAULT_STORE);
  const destinationPoints = useMemo(() => destinations.map(d => ({ ...d, point: pointFrom(d) })).filter(d => d.point), [destinations]);
  const visibleDrivers = useMemo(() => drivers
    .map((driver) => ({ ...driver, point: pointFrom(driver) }))
    .filter((driver) => driver.point), [drivers]);
  const trailPoints = useMemo(() => trail.map(pointFrom).filter(Boolean), [trail]);
  const currentDriver = useMemo(() => visibleDrivers.find((driver) => selectedDriverId == null || String(driver.id) === String(selectedDriverId)) || visibleDrivers[0], [visibleDrivers, selectedDriverId]);

  useEffect(() => {
    if (!apiKey || !hostRef.current) {
      setStatus('unavailable');
      return undefined;
    }
    let disposed = false;
    loadGoogleMaps(apiKey)
      .then(([places, mapsLibrary, markerLibrary, coreLibrary, routesLibrary]) => {
        if (disposed || !hostRef.current) return;
        mapsLibraryRef.current = mapsLibrary;
        markerLibraryRef.current = markerLibrary;
        coreLibraryRef.current = coreLibrary;
        routesLibraryRef.current = routesLibrary;

        mapRef.current = new mapsLibrary.Map(hostRef.current, {
          center: storePoint,
          zoom: 14,
          mapId,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          gestureHandling: 'greedy',
        });

        directionsServiceRef.current = new routesLibrary.DirectionsService();
        directionsRendererRef.current = new routesLibrary.DirectionsRenderer({
          map: mapRef.current,
          suppressMarkers: true,
          polylineOptions: {
            strokeColor: '#3B82F6',
            strokeOpacity: 0.8,
            strokeWeight: 5,
          }
        });

        setStatus('ready');
      })
      .catch((error) => {
        console.error('No fue posible cargar el mapa de domicilios:', error);
        if (!disposed) setStatus('error');
      });

    return () => {
      disposed = true;
      staticMarkersRef.current.forEach((marker) => { marker.map = null; });
      staticMarkersRef.current = [];
      driverMarkersRef.current.forEach((entry) => { entry.marker.map = null; entry.listener?.remove?.(); });
      driverMarkersRef.current.clear();
      linesRef.current.forEach((line) => line.setMap(null));
      linesRef.current = [];
      if (directionsRendererRef.current) directionsRendererRef.current.setMap(null);
      mapRef.current = null;
      mapsLibraryRef.current = null;
      markerLibraryRef.current = null;
      coreLibraryRef.current = null;
      routesLibraryRef.current = null;
      directionsServiceRef.current = null;
      directionsRendererRef.current = null;
    };
  }, [apiKey, mapId]);

  // Update Route
  useEffect(() => {
    if (status !== 'ready' || !directionsServiceRef.current || !directionsRendererRef.current) return;

    if (showJourney && destinationPoints.length > 0) {
      const routeStart = currentDriver?.point || trailPoints.at(-1) || storePoint;

      const sig = `${routeStart.lat},${routeStart.lng}|${destinationPoints.map(d => d.point.lat+','+d.point.lng).join('|')}`;
      if (routeSignatureRef.current === sig) return; // Prevent spamming API
      routeSignatureRef.current = sig;

      const origin = routeStart;
      const destination = destinationPoints[destinationPoints.length - 1].point;
      const waypoints = destinationPoints.slice(0, -1).map(d => ({ location: d.point, stopover: true }));

      directionsServiceRef.current.route({
        origin,
        destination,
        waypoints,
        optimizeWaypoints: true,
        travelMode: 'DRIVING'
      }, (result, status) => {
        if (status === 'OK' && directionsRendererRef.current) {
          directionsRendererRef.current.setDirections(result);
        }
      });
    } else if (directionsRendererRef.current) {
      directionsRendererRef.current.setDirections({ routes: [] });
      routeSignatureRef.current = '';
    }
  }, [status, showJourney, destinationPoints, currentDriver, trailPoints, storePoint]);

  useEffect(() => {
    if (status !== 'ready' || !mapRef.current || !markerLibraryRef.current || !mapsLibraryRef.current || !coreLibraryRef.current) return;
    const { AdvancedMarkerElement } = markerLibraryRef.current;

    staticMarkersRef.current.forEach((marker) => { marker.map = null; });
    staticMarkersRef.current = [new AdvancedMarkerElement({
      map: mapRef.current,
      position: storePoint,
      title: normalizedStore.name || 'Restaurante',
      content: markerContent('store', normalizedStore.name || 'Distrito BG', normalizedStore.address || 'Punto de salida'),
      zIndex: 20,
    })];

    destinationPoints.forEach((dest, i) => {
      staticMarkersRef.current.push(new AdvancedMarkerElement({
        map: mapRef.current,
        position: dest.point,
        title: dest.address || 'Dirección de entrega',
        content: markerContent('destination', 'Destino', dest.address || 'Dirección del cliente'),
        zIndex: 18,
      }));
    });

    const visibleIds = new Set(visibleDrivers.map((driver) => String(driver.id)));
    driverMarkersRef.current.forEach((entry, id) => {
      if (!visibleIds.has(id)) {
        entry.marker.map = null;
        entry.listener?.remove?.();
        driverMarkersRef.current.delete(id);
      }
    });
    visibleDrivers.forEach((driver) => {
      const id = String(driver.id);
      const selected = selectedDriverId != null && String(selectedDriverId) === id;
      const content = markerContent(
        'driver',
        driver.name || driver.username || 'Domiciliario',
        driver.orderId ? `Pedido #${driver.orderId}` : (driver.detail || 'Ubicación en vivo'),
        selected,
        driver.status || driver.liveStatus || '',
      );
      let entry = driverMarkersRef.current.get(id);
      if (!entry) {
        const marker = new AdvancedMarkerElement({
          map: mapRef.current,
          position: driver.point,
          title: driver.name || driver.username || 'Domiciliario',
          content,
          gmpClickable: true,
          zIndex: selected ? 45 : 35,
        });
        const listener = marker.addListener('click', () => onDriverSelectRef.current?.(driver.id));
        entry = { marker, listener };
        driverMarkersRef.current.set(id, entry);
      } else {
        entry.marker.position = driver.point;
        entry.marker.content = content;
        entry.marker.zIndex = selected ? 45 : 35;
      }
    });

    linesRef.current.forEach((line) => line.setMap(null));
    linesRef.current = [];


    const signature = `${visibleDrivers.map((driver) => driver.id).sort().join(',')}|${selectedDriverId || ''}|${destinationPoints.length}`;
    if (fitSignatureRef.current !== signature) {
      const bounds = new coreLibraryRef.current.LatLngBounds();
      bounds.extend(storePoint);
      visibleDrivers.forEach((driver) => bounds.extend(driver.point));
      destinationPoints.forEach((d) => bounds.extend(d.point));
      trailPoints.forEach((point) => bounds.extend(point));
      mapRef.current.fitBounds(bounds, 64);
      if (!visibleDrivers.length && !destinationPoints.length) mapRef.current.setZoom(15);
      fitSignatureRef.current = signature;
    }
  }, [destinationPoints, normalizedStore, selectedDriverId, showJourney, status, storePoint, trailPoints, visibleDrivers, currentDriver]);

  return (
    <div className={`live-delivery-map-shell ${className}`.trim()} data-status={status}>
      <div ref={hostRef} className="live-delivery-map-canvas" aria-label={ariaLabel} />
      {status === 'loading' && <div className="live-delivery-map-state">Cargando mapa en vivo...</div>}
      {(status === 'error' || status === 'unavailable') && (
        <div className="live-delivery-map-state is-error">
          Google Maps no está disponible para este origen. La ubicación seguirá actualizándose al habilitar la clave web.
        </div>
      )}
    </div>
  );
}
