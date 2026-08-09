import React, { useEffect, useId, useRef, useState } from 'react';
import { CheckCircle2, Loader2, MapPin, Move, Search } from 'lucide-react';
import { loadGoogleMaps } from './googleMaps.js';

const DEFAULT_CENTER = { lat: 10.4631, lng: -73.2532 };
const MIN_QUERY_LENGTH = 3;
const SEARCH_DELAY_MS = 280;
const DEFAULT_LABELS = {
  title: 'Dirección de entrega',
  readyHelp: 'Escribe y selecciona una sugerencia de Google Maps.',
  manualHelp: 'Escribe la dirección completa.',
  placeholder: 'Ej. Cra 19 #15-34, Valledupar',
  inputAriaLabel: 'Dirección de entrega',
  mapAriaLabel: 'Mapa para confirmar la ubicación',
  markerTitle: 'Ubicación exacta de entrega',
  confirmed: 'Ubicación confirmada',
  confirm: 'Confirmar ubicación',
};

function coordinateValue(position, key) {
  if (!position) return null;
  return typeof position[key] === 'function' ? position[key]() : Number(position[key]);
}

function addressComponent(components, acceptedTypes) {
  const component = (components || []).find((item) =>
    acceptedTypes.some((type) => item.types?.includes(type))
  );
  return component?.longText || component?.long_name || '';
}

function predictionText(prediction) {
  return prediction?.text?.toString?.() || '';
}

function autocompleteErrorMessage(error) {
  const message = String(error?.message || error || '');
  const origin = typeof window !== 'undefined' ? window.location.origin : 'este origen';
  if (/referer.*blocked|xhr error/i.test(message)) {
    return `Google bloqueó ${origin}. Autoriza este origen en las restricciones web de la clave y verifica Places API (New). Puedes escribir la dirección manualmente mientras se corrige.`;
  }
  if (/ApiNotActivated|not authorized|permission/i.test(message)) {
    return 'Places API (New) no está habilitada o no está autorizada para esta clave. Puedes escribir la dirección manualmente mientras se corrige.';
  }
  return 'Google no pudo consultar direcciones. Revisa Places API (New), facturación y los dominios autorizados; mientras tanto puedes escribirla manualmente.';
}

export default function DeliveryAddressPicker({
  value,
  onChange,
  onAvailabilityChange,
  apiKey = '',
  mapId = 'DEMO_MAP_ID',
  inputClassName = 'form-input',
  compact = false,
  labels = {},
}) {
  const copy = { ...DEFAULT_LABELS, ...labels };
  const suggestionListId = useId();
  const mapHostRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const availabilityChangeRef = useRef(onAvailabilityChange);
  const valueRef = useRef(value);
  const placesLibraryRef = useRef(null);
  const sessionTokenRef = useRef(null);
  const markerRef = useRef(null);
  const dragListenerRef = useRef(null);
  const renderLocationRef = useRef(null);
  const clearMapRef = useRef(null);
  const renderedCoordinatesRef = useRef('');
  const requestSequenceRef = useRef(0);
  const skipNextSearchRef = useRef(false);
  const [status, setStatus] = useState(apiKey ? 'loading' : 'manual');
  const [query, setQuery] = useState(value.address || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchFinished, setSearchFinished] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [selectedAddress, setSelectedAddress] = useState(value.address || '');
  const [selectionReady, setSelectionReady] = useState(
    value.latitude != null && value.longitude != null
  );

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { availabilityChangeRef.current = onAvailabilityChange; }, [onAvailabilityChange]);
  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => {
    if (value.address !== query && value.address !== selectedAddress) {
      skipNextSearchRef.current = true;
      setQuery(value.address || '');
      setSelectedAddress(value.address || '');
    }
  }, [query, selectedAddress, value.address]);

  useEffect(() => {
    if (!apiKey) {
      setStatus('manual');
      availabilityChangeRef.current?.(false);
      return undefined;
    }

    let disposed = false;

    const clearMap = () => {
      dragListenerRef.current?.remove();
      dragListenerRef.current = null;
      if (markerRef.current) markerRef.current.map = null;
      markerRef.current = null;
      renderedCoordinatesRef.current = '';
      if (mapHostRef.current) mapHostRef.current.replaceChildren();
    };
    clearMapRef.current = clearMap;

    loadGoogleMaps(apiKey)
      .then(([placesLibrary, mapsLibrary, markerLibrary]) => {
        if (disposed || !mapHostRef.current) return;
        const { AutocompleteSessionToken } = placesLibrary;
        const { Map } = mapsLibrary;
        const { AdvancedMarkerElement } = markerLibrary;

        placesLibraryRef.current = placesLibrary;
        sessionTokenRef.current = new AutocompleteSessionToken();

        const showLocationOnMap = (latitude, longitude, viewport = null) => {
          if (disposed || !mapHostRef.current) return;
          const coordinateKey = `${latitude},${longitude}`;
          dragListenerRef.current?.remove();
          if (markerRef.current) markerRef.current.map = null;

          const map = new Map(mapHostRef.current, {
            center: { lat: latitude, lng: longitude },
            zoom: 18,
            mapId,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            gestureHandling: 'greedy',
          });
          if (viewport) map.fitBounds(viewport);

          markerRef.current = new AdvancedMarkerElement({
            map,
            position: { lat: latitude, lng: longitude },
            title: copy.markerTitle,
            gmpDraggable: true,
          });
          renderedCoordinatesRef.current = coordinateKey;
          dragListenerRef.current = markerRef.current.addListener('dragend', () => {
            const nextLatitude = coordinateValue(markerRef.current?.position, 'lat');
            const nextLongitude = coordinateValue(markerRef.current?.position, 'lng');
            if (!Number.isFinite(nextLatitude) || !Number.isFinite(nextLongitude)) return;
            renderedCoordinatesRef.current = `${nextLatitude},${nextLongitude}`;
            onChangeRef.current({
              latitude: nextLatitude,
              longitude: nextLongitude,
              locationAdjusted: true,
              locationConfirmed: false,
            });
          });
        };
        renderLocationRef.current = showLocationOnMap;
        setStatus('ready');
        availabilityChangeRef.current?.(true);

        const existingLatitude = Number(valueRef.current.latitude);
        const existingLongitude = Number(valueRef.current.longitude);
        if (valueRef.current.latitude != null && valueRef.current.longitude != null
            && Number.isFinite(existingLatitude) && Number.isFinite(existingLongitude)) {
          showLocationOnMap(existingLatitude, existingLongitude);
          setSelectionReady(true);
        }
      })
      .catch((error) => {
        console.error('No fue posible cargar Google Maps:', error);
        if (!disposed) {
          setStatus('manual');
          setSearchError('Google Maps no está disponible. Puedes escribir la dirección manualmente.');
          availabilityChangeRef.current?.(false);
        }
      });

    return () => {
      disposed = true;
      requestSequenceRef.current += 1;
      placesLibraryRef.current = null;
      sessionTokenRef.current = null;
      clearMap();
      renderLocationRef.current = null;
      clearMapRef.current = null;
    };
  }, [apiKey, mapId]);

  useEffect(() => {
    if (status !== 'ready') return undefined;
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return undefined;
    }

    const input = query.trim();
    if (input.length < MIN_QUERY_LENGTH || selectionReady) {
      requestSequenceRef.current += 1;
      setSuggestions([]);
      setIsSearching(false);
      setSearchFinished(false);
      setActiveSuggestion(-1);
      return undefined;
    }

    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    setIsSearching(true);
    setSearchFinished(false);
    setSearchError('');

    const timer = window.setTimeout(async () => {
      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLibraryRef.current || {};
        if (!AutocompleteSuggestion || !AutocompleteSessionToken) {
          throw new Error('La biblioteca de Places no expone el servicio de sugerencias.');
        }
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }
        const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input,
          sessionToken: sessionTokenRef.current,
          locationBias: { center: DEFAULT_CENTER, radius: 35_000 },
          includedRegionCodes: ['co'],
          language: 'es',
          region: 'co',
        });
        if (requestSequenceRef.current !== requestId) return;
        const nextSuggestions = (response.suggestions || [])
          .map((suggestion) => suggestion.placePrediction)
          .filter(Boolean)
          .slice(0, 6);
        setSuggestions(nextSuggestions);
        setActiveSuggestion(nextSuggestions.length ? 0 : -1);
        setSearchFinished(true);
        availabilityChangeRef.current?.(true);
      } catch (error) {
        if (requestSequenceRef.current !== requestId) return;
        console.error('No fue posible consultar sugerencias de Google Maps:', error);
        setSuggestions([]);
        setSearchFinished(true);
        setSearchError(autocompleteErrorMessage(error));
        availabilityChangeRef.current?.(false);
      } finally {
        if (requestSequenceRef.current === requestId) setIsSearching(false);
      }
    }, SEARCH_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [query, selectionReady, status]);

  useEffect(() => {
    const latitude = Number(value.latitude);
    const longitude = Number(value.longitude);
    if (value.latitude == null || value.longitude == null
        || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setSelectionReady(false);
      clearMapRef.current?.();
      return;
    }
    setSelectionReady(true);
    const coordinateKey = `${latitude},${longitude}`;
    if (status === 'ready' && renderedCoordinatesRef.current !== coordinateKey) {
      renderLocationRef.current?.(latitude, longitude);
    }
  }, [status, value.latitude, value.longitude]);

  const updateAddress = (event) => {
    const nextAddress = event.target.value;
    setQuery(nextAddress);
    setSelectedAddress(nextAddress);
    setSelectionReady(false);
    setSuggestions([]);
    setSearchError('');
    onChange({
      address: nextAddress,
      latitude: null,
      longitude: null,
      placeId: '',
      locationAdjusted: false,
      locationConfirmed: false,
    });
  };

  const selectPrediction = async (placePrediction) => {
    const readableAddress = predictionText(placePrediction);
    skipNextSearchRef.current = true;
    setQuery(readableAddress);
    setSelectedAddress(readableAddress);
    setSuggestions([]);
    setActiveSuggestion(-1);
    setSearchFinished(false);
    setIsSearching(true);

    try {
      const place = placePrediction.toPlace();
      await place.fetchFields({
        fields: ['id', 'displayName', 'formattedAddress', 'location', 'viewport', 'addressComponents'],
      });
      if (!place.location) throw new Error('La dirección seleccionada no tiene coordenadas.');

      const latitude = place.location.lat();
      const longitude = place.location.lng();
      const formattedAddress = place.formattedAddress || place.displayName || readableAddress;
      const barrio = addressComponent(place.addressComponents, [
        'neighborhood', 'sublocality_level_1', 'sublocality',
      ]);
      onChange({
        address: formattedAddress,
        barrio: barrio || valueRef.current.barrio || '',
        latitude,
        longitude,
        placeId: place.id || '',
        locationAdjusted: false,
        locationConfirmed: false,
      });
      skipNextSearchRef.current = true;
      setQuery(formattedAddress);
      setSelectedAddress(formattedAddress);
      setSelectionReady(true);
      setSearchError('');
      renderLocationRef.current?.(latitude, longitude, place.viewport);
      const { AutocompleteSessionToken } = placesLibraryRef.current || {};
      sessionTokenRef.current = AutocompleteSessionToken ? new AutocompleteSessionToken() : null;
      availabilityChangeRef.current?.(true);
    } catch (error) {
      console.error('No fue posible obtener los detalles de la dirección:', error);
      setSearchError('No pudimos ubicar esa dirección. Selecciona otra sugerencia o escríbela completa.');
      setSelectionReady(false);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputKeyDown = (event) => {
    if (!suggestions.length) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestion((current) => (current + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestion((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === 'Enter' && activeSuggestion >= 0) {
      event.preventDefault();
      void selectPrediction(suggestions[activeSuggestion]);
    } else if (event.key === 'Escape') {
      setSuggestions([]);
      setActiveSuggestion(-1);
    }
  };

  const hasOpenSuggestions = status === 'ready' && suggestions.length > 0;

  return (
    <div className={`delivery-address-picker ${status === 'manual' ? 'manual-address-picker' : ''} ${compact ? 'is-compact' : ''}`}>
      <div className="address-picker-heading">
        <MapPin size={19} />
        <div>
          <strong>{copy.title}</strong>
          <span>
            {status === 'manual'
              ? copy.manualHelp
              : copy.readyHelp}
          </span>
        </div>
      </div>

      <div className="google-autocomplete-shell">
        <Search className="address-search-icon" size={19} aria-hidden="true" />
        <input
          id={`delivery-address-${suggestionListId.replace(/:/g, '')}`}
          type="text"
          className={`${inputClassName} google-address-input`}
          value={query}
          placeholder={copy.placeholder}
          aria-label={copy.inputAriaLabel}
          aria-autocomplete="list"
          aria-controls={suggestionListId}
          aria-expanded={hasOpenSuggestions}
          autoComplete="street-address"
          onChange={updateAddress}
          onKeyDown={handleInputKeyDown}
        />
        {(status === 'loading' || isSearching) && (
          <Loader2 className="address-search-spinner" size={19} aria-label="Buscando direcciones" />
        )}
        {hasOpenSuggestions && (
          <div id={suggestionListId} className="address-suggestions" role="listbox">
            {suggestions.map((suggestion, index) => {
              const label = predictionText(suggestion);
              return (
                <button
                  key={suggestion.placeId || `${label}-${index}`}
                  type="button"
                  role="option"
                  aria-selected={activeSuggestion === index}
                  className={activeSuggestion === index ? 'is-active' : ''}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => void selectPrediction(suggestion)}
                >
                  <MapPin size={17} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {status === 'ready' && query.trim().length > 0 && query.trim().length < MIN_QUERY_LENGTH && (
        <p className="address-helper">Escribe al menos {MIN_QUERY_LENGTH} caracteres para buscar.</p>
      )}
      {status === 'ready' && searchFinished && !isSearching && !suggestions.length && !searchError && !selectionReady && (
        <p className="address-helper address-helper-warning">
          No encontramos coincidencias. Agrega número de calle o barrio.
        </p>
      )}
      {(status === 'manual' || searchError) && (
        <p className="address-helper address-helper-warning">
          {searchError || 'El autocompletado no está configurado. Puedes continuar escribiendo la dirección completa.'}
        </p>
      )}

      <div className={`delivery-map-panel ${selectionReady ? 'is-visible' : ''}`}>
        <div ref={mapHostRef} className="delivery-map" aria-label={copy.mapAriaLabel} />
        {selectionReady && (
          <div className="delivery-map-confirmation">
            <div className="selected-address-row">
              <MapPin size={20} />
              <div>
                <strong>{selectedAddress || value.address}</strong>
                <span>Valledupar, Colombia</span>
              </div>
            </div>
            <p className="address-helper"><Move size={16} /> Si el punto quedó corrido, arrastra el marcador.</p>
            <button
              type="button"
              className={`confirm-location-btn ${value.locationConfirmed ? 'is-confirmed' : ''}`}
              onClick={() => onChange({ locationConfirmed: true })}
            >
              <CheckCircle2 size={19} />
              {value.locationConfirmed ? copy.confirmed : copy.confirm}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
