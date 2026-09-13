import { useEffect } from 'react';

const modalStack = [];

export const modalManager = {
  register(closeFn) {
    if (typeof closeFn === 'function') {
      modalStack.push(closeFn);
    }
    return () => {
      this.unregister(closeFn);
    };
  },

  unregister(closeFn) {
    const index = modalStack.lastIndexOf(closeFn);
    if (index !== -1) {
      modalStack.splice(index, 1);
    }
  },

  hasOpenModals() {
    return modalStack.length > 0;
  },

  closeTopModal() {
    if (modalStack.length > 0) {
      const closeFn = modalStack.pop();
      try {
        closeFn();
        return true;
      } catch (err) {
        console.error('Error al cerrar el modal superior:', err);
        return false;
      }
    }
    return false;
  },

  clear() {
    modalStack.length = 0;
  }
};

/**
 * Hook para registrar un modal en el gestor global mientras esté abierto.
 * Al presionar el botón físico atrás, se cerrará primero este modal.
 */
export function useBackModal(isOpen, closeFn) {
  useEffect(() => {
    if (isOpen && typeof closeFn === 'function') {
      return modalManager.register(closeFn);
    }
  }, [isOpen, closeFn]);
}
