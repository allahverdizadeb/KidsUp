import { useContext } from 'react';
import { ToastContext } from './ToastContext.ts';
import type { ToastApi } from './ToastContext.ts';

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast needs a ToastProvider');
  return api;
}
