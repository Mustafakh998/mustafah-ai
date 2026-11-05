// Minimal app-wide toast notifications. Call `toast('Saved!')` from anywhere on the client.
export type ToastKind = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  text: string;
  kind: ToastKind;
}

type Listener = (t: ToastMessage) => void;

const listeners = new Set<Listener>();
let nextId = 1;

export function toast(text: string, kind: ToastKind = 'success') {
  const msg = { id: nextId++, text, kind };
  listeners.forEach((l) => l(msg));
}

export function subscribeToasts(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
