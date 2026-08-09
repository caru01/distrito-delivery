import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Camera, CheckCircle2, ChevronLeft, Clock3, MapPin, MessageCircle, Navigation, Phone, Star } from 'lucide-react';
import { Link, useNavigate, useParams } from '../routing';
import StatusTimeline from '../components/StatusTimeline';
import { apiFetch } from '../services/api';
import { elapsed, money, dateTime } from '../utils/format';
import { LiveDeliveryMap, speakNotification } from '@distrito/shared-ui';
import { AuthContext } from '../context/AuthContext';

function distanceLabel(meters) {
  if (!Number.isFinite(Number(meters))) return 'calculando distancia';
  const distance = Number(meters);
  return distance < 1000 ? `${Math.max(0, Math.round(distance))} m` : `${(distance / 1000).toFixed(1)} km`;
}

async function imageToDataUrl(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.72);
}

export default function OrderDetail({ gps = { status: 'idle', accuracy: null, error: '' } }) {
  const { settings } = useContext(AuthContext);
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [finish, setFinish] = useState(false);
  const [delivery, setDelivery] = useState({ confirmReceived: false, notes: '', rating: '', evidence: null });

  const load = useCallback(async () => {
    try { const data = await apiFetch(`/delivery/orders/${id}`); setOrder(data.order); setError(''); }
    catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const refresh = (event) => {
      const data = event.detail?.data || {};
      if (!data.orderId || Number(data.orderId) === Number(id)) load();
    };
    window.addEventListener('distrito:realtime', refresh);
    return () => window.removeEventListener('distrito:realtime', refresh);
  }, [id, load]);

  const action = async (path) => {
    setBusy(true); setError('');
    try {
      const data = await apiFetch(`/delivery/orders/${id}/${path}`, { method: 'POST' });
      setOrder(data.order);
      if (path === 'accept') speakNotification('order_accepted', settings || {});
      window.dispatchEvent(new Event('distrito:active-orders-changed'));
    }
    catch (actionError) { setError(actionError.message); }
    finally { setBusy(false); }
  };
  const complete = async (event) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const data = await apiFetch(`/delivery/orders/${id}/complete`, { method: 'POST', body: JSON.stringify({ ...delivery, geofenceOverrideId: order.geofenceOverrideId }) });
      setOrder(data.order); speakNotification('order_delivered', settings || {}); setFinish(false); window.setTimeout(() => navigate('/historial'), 1200);
    } catch (completeError) { setError(completeError.message); } finally { setBusy(false); }
  };
  const evidence = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try { setDelivery({ ...delivery, evidence: await imageToDataUrl(file) }); }
    catch { setError('No fue posible procesar la fotografía'); }
  };

  if (loading) return <div className="page-content"><div className="empty-state"><span className="loader" /></div></div>;
  if (!order) return <div className="page-content"><Link className="back-link" to="/"><ChevronLeft /> Pedidos</Link><div className="alert alert-error">{error || 'Pedido no disponible'}</div></div>;
  const deliveryStatus = String(order.deliveryStatus || order.status || '').trim().toLowerCase();
  const canAccept = deliveryStatus === 'pendiente';
  const canPickup = deliveryStatus === 'aceptado' || deliveryStatus === 'recogido';
  const canComplete = deliveryStatus === 'en camino';
  const liveArrival = gps.arrivals?.[Number(id)] || order.arrival || {};
  const exactDestination = Boolean(order.arrival?.hasExactDestination);
  const withinCompletionRange = exactDestination ? liveArrival.isWithinRange === true : Boolean(order.geofenceOverrideId);
  const currentDriver = gps.latitude != null && gps.longitude != null
    ? [{
      id: order.deliveryUserId || 'current',
      name: order.driverName || 'Tu ubicación',
      orderId: order.id,
      latitude: gps.latitude,
      longitude: gps.longitude,
      status: 'Ocupado',
    }]
    : order.driverLatitude != null && order.driverLongitude != null
      ? [{
        id: order.deliveryUserId || 'current',
        name: order.driverName || 'Tu ubicación',
        orderId: order.id,
        latitude: order.driverLatitude,
        longitude: order.driverLongitude,
        status: 'Ocupado',
      }]
      : [];

  return (
    <div className="page-content detail-page">
      <Link className="back-link" to="/"><ChevronLeft size={20} /> Volver a pedidos</Link>
      <section className="detail-hero"><div><span className="eyebrow">Pedido #{order.id}</span><h1>{order.customerName}</h1><p><MapPin size={17} /> {order.address}, {order.barrio}</p></div><div className="hero-time"><Clock3 /><b>{dateTime(order.createdAt)}</b><small>{elapsed(order.createdAt)} desde su creación</small></div></section>
      <StatusTimeline status={order.deliveryStatus} />
      {error && <div className="alert alert-error">{error}</div>}
      {order.deliveryStatus === 'En camino' && <div className={`gps-banner gps-${gps.status}`}><Navigation size={20} /><div><b>{gps.status === 'sharing' ? 'Ubicación compartida en vivo' : gps.status === 'error' ? 'Ubicación requerida' : 'Activando GPS…'}</b><small>{gps.error || (gps.accuracy ? `Precisión aproximada: ${gps.accuracy} m` : 'El cliente y el administrador verán tu recorrido')}</small></div></div>}
      {(canAccept || canPickup || canComplete) && (
        <section className={`delivery-primary-action${canComplete && withinCompletionRange ? ' is-arrived' : ''}`} aria-label="Acción principal de la entrega">
          <div>
            <span className="eyebrow">Siguiente acción</span>
            <strong>{canComplete
              ? withinCompletionRange ? 'Llegaste al destino: ya puedes finalizar la entrega' : 'Acércate a la dirección del cliente para finalizar'
              : canPickup ? 'Recoge el pedido para iniciar el recorrido' : 'Acepta este pedido para comenzar'}</strong>
            {canComplete && exactDestination && !withinCompletionRange && (
              <small>{gps.error || `Estás a ${distanceLabel(liveArrival.distanceMeters)}. El botón aparecerá dentro de ${liveArrival.radiusMeters || 150} m.`}</small>
            )}
            {canComplete && !exactDestination && <small>{order.geofenceOverrideId ? 'Administración autorizó una excepción de geocerca auditable.' : 'Este pedido no tiene coordenadas exactas. Solicita a administración una excepción para finalizar.'}</small>}
          </div>
          {canAccept && <button className="button button-primary button-large" disabled={busy} onClick={() => action('accept')}>Aceptar pedido</button>}
          {canPickup && <button className="button button-primary button-large" disabled={busy} onClick={() => action('pickup')}><Navigation size={19} /> He recogido el pedido</button>}
          {canComplete && withinCompletionRange && <button data-testid="complete-delivery" className="button button-primary button-large" disabled={busy} onClick={() => setFinish(true)}><CheckCircle2 size={19} /> Finalizar entrega</button>}
        </section>
      )}
      <div className="detail-grid">
        <div className="detail-stack">
          <section className="panel"><div className="panel-title"><h2>Cliente y destino</h2></div><dl className="data-list"><div><dt>Nombre</dt><dd>{order.customerName}</dd></div><div><dt>Teléfono</dt><dd>{order.customerPhone}</dd></div><div><dt>Dirección</dt><dd>{order.address}</dd></div><div><dt>Barrio</dt><dd>{order.barrio || '—'}</dd></div>{order.apartment && <div><dt>Apartamento</dt><dd>{order.apartment}</dd></div>}{order.tower && <div><dt>Torre</dt><dd>{order.tower}</dd></div>}{order.floor && <div><dt>Piso</dt><dd>{order.floor}</dd></div>}<div><dt>Referencia</dt><dd>{order.reference || 'Sin referencia'}</dd></div><div><dt>Ubicación</dt><dd>{order.destinationLatitude != null ? 'Confirmada por el cliente' : 'Basada en la dirección escrita'}</dd></div><div><dt>Observaciones</dt><dd>{order.notes || 'Sin observaciones'}</dd></div></dl><div className="quick-actions"><a className="quick-button" href={order.phoneLink}><Phone /> Llamar</a><a className="quick-button" href={order.whatsappLink} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a><a className="quick-button primary" href={order.googleMapsUrl} target="_blank" rel="noreferrer"><Navigation /> Abrir navegación</a></div></section>
          <section className="panel"><div className="panel-title"><h2>Productos</h2><span>{order.items.length} referencias</span></div><div className="product-list">{order.items.map((item, index) => <div className="product-row" key={`${item.id}-${index}`}><span className="qty">{item.quantity}×</span><div><b>{item.title}</b>{item.notes && <small>{item.notes}</small>}</div><strong>{money(item.price * item.quantity)}</strong></div>)}</div>{order.notes && <div className="order-note"><b>Observación general</b><p>{order.notes}</p></div>}</section>
        </div>
        <aside className="detail-sidebar"><section className="panel sticky-panel"><div className="panel-title"><h2>Resumen</h2></div><dl className="money-list"><div><dt>Pedido</dt><dd>{money(order.total)}</dd></div><div><dt>Valor domicilio</dt><dd>{money(order.deliveryFee)}</dd></div><div><dt>Método de pago</dt><dd>{order.paymentMethod}</dd></div>{order.changeRequired != null && <div><dt>Cambio requerido</dt><dd>{money(order.changeRequired)}</dd></div>}</dl>
          <a className="button button-ghost button-large" href={order.googleMapsUrl} target="_blank" rel="noreferrer"><MapPin size={19} /> Google Maps</a>
          {(canPickup || canComplete) && (
            <div className="delivery-order-map">
              <div className="delivery-order-map__heading">
                <div><span className="eyebrow">Recorrido para la entrega</span><strong>Tu ubicación, la cocina y el destino</strong></div>
                {canComplete && <span className={withinCompletionRange ? 'arrival-badge is-near' : 'arrival-badge'}>{withinCompletionRange ? 'En destino' : distanceLabel(liveArrival.distanceMeters)}</span>}
              </div>
              <LiveDeliveryMap
                apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}
                mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'}
                store={order.store}
                destinations={[{ latitude: order.destinationLatitude, longitude: order.destinationLongitude, address: order.address }]}
                drivers={currentDriver}
                trail={order.driverTrail || []}
                selectedDriverId={currentDriver[0]?.id || null}
                showJourney
                ariaLabel={`Recorrido en vivo del pedido ${order.id}`}
              />
              <small className="delivery-order-map__legend"><span>🛵 Tu GPS</span><span>🏪 Cocina</span><span>📍 Destino</span></small>
            </div>
          )}
        </section></aside>
      </div>
      {finish && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setFinish(false); }}><form className="modal-card" onSubmit={complete}><div className="panel-title"><div><span className="eyebrow">Pedido #{id}</span><h2>Confirmar entrega</h2></div><button type="button" className="modal-close" onClick={() => setFinish(false)}>×</button></div><label className="confirmation-check"><input type="checkbox" required checked={delivery.confirmReceived} onChange={(event) => setDelivery({ ...delivery, confirmReceived: event.target.checked })} /><CheckCircle2 /><span><b>El cliente recibió el pedido</b><small>Esta confirmación es obligatoria.</small></span></label><label>Observaciones<textarea rows="3" value={delivery.notes} onChange={(event) => setDelivery({ ...delivery, notes: event.target.value })} placeholder="Novedades de la entrega…" /></label><label>Calificación opcional<div className="rating-row">{[1,2,3,4,5].map((rating) => <button type="button" key={rating} className={Number(delivery.rating) >= rating ? 'active' : ''} onClick={() => setDelivery({ ...delivery, rating })}><Star /></button>)}</div></label><label className="camera-field"><Camera /> <span><b>{delivery.evidence ? 'Fotografía agregada' : 'Tomar fotografía opcional'}</b><small>Se comprime antes de enviarse.</small></span><input type="file" accept="image/*" capture="environment" onChange={evidence} /></label><button className="button button-primary button-large" disabled={busy || !delivery.confirmReceived}>{busy ? 'Finalizando…' : 'Confirmar entrega'}</button></form></div>}
    </div>
  );
}
