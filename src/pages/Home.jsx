import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Bike, PackageCheck, RefreshCw, Radio, Search } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import OrderCard from '../components/OrderCard';
import { apiFetch } from '../services/api';
import { useNavigate } from '../routing';
import { announceAvailableOrder } from '../utils/orderAlert';
import { speak } from '../utils/speech';

export default function Home() {
  const { profile } = useContext(AuthContext);
  const navigate = useNavigate();
  const [available, setAvailable] = useState([]);
  const [current, setCurrent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(null);
  const [capacity, setCapacity] = useState(() => Math.min(Math.max(Number(profile?.max_active_orders) || 1, 1), 5));
  const knownAvailableIds = useRef(new Set());
  const hasLoadedAvailable = useRef(false);
  const hasCapacity = current.length < capacity;

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const ts = Date.now();
      const [availableData, currentData] = await Promise.all([
        apiFetch(`/delivery/orders/available?t=${ts}`), 
        apiFetch(`/delivery/orders/current?t=${ts}`)
      ]);
      const nextAvailable = availableData.orders || [];
      const newOrders = hasLoadedAvailable.current
        ? nextAvailable.filter((order) => !knownAvailableIds.current.has(Number(order.id)))
        : nextAvailable;
      knownAvailableIds.current = new Set(nextAvailable.map((order) => Number(order.id)));
      hasLoadedAvailable.current = true;
      setCapacity(Math.min(Math.max(Number(currentData.capacity || availableData.capacity) || 1, 1), 5));
      setAvailable(nextAvailable); setCurrent(currentData.orders || []); setError('');
      if (newOrders.length) announceAvailableOrder({
        orderId: newOrders.length === 1 ? Number(newOrders[0].id) : null,
        count: newOrders.length,
      });
    } catch (loadError) { setError(loadError.message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const refresh = (event) => { if (!['connected', 'delivery_location'].includes(event.detail?.event)) load(true); };
    window.addEventListener('distrito:realtime', refresh);
    return () => window.removeEventListener('distrito:realtime', refresh);
  }, [load]);

  const accept = async (id) => {
    setAccepting(id); setError('');
    try {
      await apiFetch(`/delivery/orders/${id}/accept`, { method: 'POST' });
      // Voice feedback for successful acceptance (female voice configured in utils/speech.js)
      speak('Pedido aceptado');
      window.dispatchEvent(new Event('distrito:active-orders-changed'));
      navigate(`/pedidos/${id}`);
    }
    catch (acceptError) { setError(acceptError.message); await load(true); }
    finally { setAccepting(null); }
  };

  return (
    <div className="page-content">
      <section className="page-heading">
        <div><span className="eyebrow"><Radio size={14} /> Sincronizado en vivo</span><h1>Pedidos disponibles</h1><p>Hola, {profile?.name || profile?.username}. Puedes llevar {capacity} pedido{capacity === 1 ? '' : 's'} simultáneamente.</p></div>
        <button className="button button-ghost" onClick={() => load()}><RefreshCw size={18} /> Actualizar</button>
      </section>
      {error && <div className="alert alert-error">{error}</div>}
      {current.length > 0 && <section><div className="section-title"><div><span className="eyebrow">En operación</span><h2>Tus entregas activas</h2></div><span className="count-badge">{current.length}/{capacity}</span></div><div className="orders-grid focus-grid">{current.map((order) => <OrderCard key={order.id} order={order} />)}</div></section>}
      {!hasCapacity && <div className="alert alert-info">Llegaste a tu capacidad de {capacity} pedidos. Finaliza una entrega para aceptar la siguiente.</div>}
      <section>
        <div className="section-title"><div><span className="eyebrow">Cola del restaurante</span><h2>Listos para entregar</h2></div><span className="count-badge">{available.length}</span></div>
        {loading ? <div className="empty-state"><RefreshCw className="spin" /><h3>Sincronizando pedidos</h3></div> : available.length ? <div className="orders-grid">{available.map((order) => <OrderCard key={order.id} order={order} onAccept={hasCapacity ? accept : null} accepting={accepting === order.id} />)}</div> : <div className="empty-state"><PackageCheck /><h3>Todo al día</h3><p>No hay pedidos listos por ahora. Puedes dejar esta pantalla abierta.</p></div>}
      </section>
      <div className="live-fab" title="Conexión en tiempo real"><span /><Bike size={19} /> En vivo</div>
    </div>
  );
}
