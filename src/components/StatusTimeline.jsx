import React from 'react';
import { Check } from 'lucide-react';

const STEPS = ['Pendiente', 'Aceptado', 'Recogido', 'En camino', 'Entregado'];

export default function StatusTimeline({ status }) {
  if (status === 'Cancelado') return <div className="status-cancelled">Pedido cancelado</div>;
  const normalized = status === 'En camino' ? 3 : STEPS.indexOf(status);
  return (
    <div className="timeline" aria-label={`Estado: ${status}`}>
      {STEPS.map((step, index) => (
        <div className={`timeline-step ${index <= normalized ? 'is-done' : ''}`} key={step}>
          <span>{index < normalized ? <Check size={14} /> : index + 1}</span>
          <small>{step}</small>
        </div>
      ))}
    </div>
  );
}
