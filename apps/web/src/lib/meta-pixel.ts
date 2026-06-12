type Fbq = (
  action: 'init' | 'track',
  eventName: string,
  params?: Record<string, unknown>,
) => void;

declare global {
  interface Window {
    fbq?: Fbq;
  }
}

export function trackMetaPixelEvent(
  eventName: string,
  params?: Record<string, unknown>,
) {
  if (typeof window === 'undefined' || !window.fbq) return;
  window.fbq('track', eventName, params);
}
