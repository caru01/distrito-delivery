import React from 'react';
import { Check } from 'lucide-react';
import { deliveryStatusMeta } from '@distrito/shared-ui';

const STEPS = ['Pendiente', 'Aceptado', 'En camino', 'Entregado'];

export default function StatusTimeline({ status }) {
  if (status === 'Cancelado') return <div className="status-cancelled">Pedido cancelado</div>;
  const normalizedStatus = status === 'Recogido' ? 'En camino' : status;
  const normalized = STEPS.indexOf(normalizedStatus);
  return (
    <div className="timeline" aria-label={`Estado: ${status}`}>
      {STEPS.map((step, index) => (
        <div className={`timeline-step timeline-${deliveryStatusMeta(step).tone} ${index <= normalized ? 'is-done' : ''}`} key={step} title={deliveryStatusMeta(step).description}>
          <span>{index < normalized ? <Check size={14} /> : index + 1}</span>
          <small>{deliveryStatusMeta(step).label}</small>
        </div>
      ))}
    </div>
  );
}
