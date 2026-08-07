import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, MapPin, Search } from 'lucide-react';
import { Link } from '../routing';
import { apiFetch } from '../services/api';
import { dateTime, duration, money } from '../utils/format';

export default function History() {
  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { apiFetch('/delivery/history').then((data) => setOrders(data.orders)).catch((err) => setError(err.message)).finally(() => setLoading(false)); }, []);
  const filtered = useMemo(() => orders.filter((order) => `${order.id} ${order.customerName} ${order.address}`.toLowerCase().includes(query.toLowerCase())), [orders, query]);
  return <div className="page-content"><section className="page-heading"><div><span className="eyebrow">Trazabilidad personal</span><h1>Historial de entregas</h1><p>Consulta tiempos, distancia y valor de tus domicilios anteriores.</p></div><div className="search-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pedido o cliente" /></div></section>{error && <div className="alert alert-error">{error}</div>}{loading ? <div className="empty-state"><span className="loader" /></div> : filtered.length ? <div className="history-list">{filtered.map((order) => <Link to={`/pedidos/${order.id}`} className="history-row" key={order.id}><div className="history-id"><span><CheckCircle2 /></span><div><b>Pedido #{order.id}</b><small>{order.customerName}</small></div></div><div><CalendarDays /><span><b>{dateTime(order.createdAt)}</b><small>Fecha del pedido</small></span></div><div><CalendarDays /><span><b>{dateTime(order.completedAt || order.updatedAt)}</b><small>Fecha de entrega</small></span></div><div><Clock3 /><span><b>{duration(order.durationSeconds)}</b><small>Tiempo empleado</small></span></div><div><MapPin /><span><b>{order.distanceKm ? `${order.distanceKm} km` : 'Sin registrar'}</b><small>Distancia</small></span></div><div className="history-value"><b>{money(order.deliveryFee)}</b><small>{order.deliveryStatus}</small></div></Link>)}</div> : <div className="empty-state"><CalendarDays /><h3>Aún no hay entregas</h3><p>Los pedidos finalizados aparecerán aquí.</p></div>}</div>;
}
