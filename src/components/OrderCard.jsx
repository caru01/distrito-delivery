import React from 'react';
import { ArrowRight, Banknote, Clock3, MapPin, Navigation, User } from 'lucide-react';
import { Link } from '../routing';
import { elapsed, money, time } from '../utils/format';

export default function OrderCard({ order, onAccept, accepting = false }) {
  return (
    <article className="order-card">
      <div className="order-card-head">
        <div><span className="eyebrow">Pedido</span><h3>#{order.id}</h3></div>
        <span className={`status-pill status-${String(order.deliveryStatus).toLowerCase().replace(/\s/g, '-')}`}>{order.deliveryStatus}</span>
      </div>
      <div className="order-customer"><User size={18} /><strong>{order.customerName}</strong></div>
      <div className="order-address"><MapPin size={18} /><div>{order.address}<small>{order.barrio || 'Barrio sin registrar'}</small></div></div>
      <div className="order-meta-grid">
        <span><Clock3 size={16} /><b>{time(order.createdAt)}</b><small>{elapsed(order.createdAt)}</small></span>
        <span><Navigation size={16} /><b>{order.distanceKm ? `${order.distanceKm} km` : 'Abrir Maps'}</b><small>Distancia</small></span>
        <span><Banknote size={16} /><b>{money(order.deliveryFee)}</b><small>{order.paymentMethod}</small></span>
      </div>
      <div className="order-card-actions">
        <Link className="button button-ghost" to={`/pedidos/${order.id}`}>Ver detalle <ArrowRight size={18} /></Link>
        {onAccept && <button className="button button-primary" disabled={accepting} onClick={() => onAccept(order.id)}>{accepting ? 'Aceptando…' : 'Aceptar pedido'}</button>}
      </div>
    </article>
  );
}
