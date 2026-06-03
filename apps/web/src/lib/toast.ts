import { toast as sonner } from 'sonner';

type ToastOpts = { duration?: number };

export const toast = {
  success: (message: string, opts?: ToastOpts) => sonner.success(message, opts),
  error: (message: string, opts?: ToastOpts) => sonner.error(message, opts),
  info: (message: string, opts?: ToastOpts) => sonner.info(message, opts),
  warning: (message: string, opts?: ToastOpts) => sonner.warning(message, opts),
};

export function formatApiError(err: unknown, fallback = 'Xatolik yuz berdi'): string {
  const message =
    (err as { response?: { data?: { message?: string | string[] } } })?.response
      ?.data?.message || (err as Error)?.message;
  if (Array.isArray(message)) return message.join(', ');
  if (typeof message === 'string' && message.trim()) return message;
  return fallback;
}
