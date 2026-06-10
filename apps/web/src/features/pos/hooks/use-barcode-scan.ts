import { useEffect, useRef } from 'react';
import { unlockNotificationAudio } from '@/lib/browser-notification';

/**
 * USB/Bluetooth HID skaner: tez klaviatura inputini ushlab oladi.
 * Inson klaviaturasidan farq: skaner juda qisqa vaqt ichida (odatda har bir belgi orasida <30ms) belgilarni yuboradi va Enter bilan tugaydi.
 * Yangilanish: Endi kursor input ichida bo'lsa ham ishlaydi va noto'g'ri kiritishning oldini oladi.
 */
export function useBarcodeScanner(onScan: (barcode: string) => void, enabled = true) {
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef<number>(0);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      unlockNotificationAudio();

      const isInput =
        (e.target as HTMLElement).tagName === 'INPUT' ||
        (e.target as HTMLElement).tagName === 'TEXTAREA' ||
        (e.target as HTMLElement).tagName === 'SELECT';

      const now = performance.now();
      
      // Agar belgilar orasidagi vaqt 50ms dan ko'p bo'lsa (odam yozayotgan bo'lsa)
      if (now - lastKeyTimeRef.current > 50) {
        bufferRef.current = '';
      }
      
      if (e.key === 'Enter') {
        if (bufferRef.current.length >= 4) {
          e.preventDefault(); // Sahifa yangilanishi yoki form yuborilishini to'xtatadi
          onScanRef.current(bufferRef.current);
          
          // Agar input ichida bo'lsak, skaner yozib qo'ygan barkodni o'chirib tashlaymiz
          if (isInput) {
            const el = e.target as HTMLInputElement;
            // Kichik timeout kerak, chunki ba'zan React state o'zgarishi bilan sinxronlashish kerak bo'ladi
            setTimeout(() => {
              if (el.value && el.value.endsWith(bufferRef.current)) {
                el.value = el.value.slice(0, -bufferRef.current.length);
                // React/DOM ni trigger qilish uchun event dispatch qilamiz
                el.dispatchEvent(new Event('input', { bubbles: true }));
              }
            }, 10);
          }
        }
        bufferRef.current = '';
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        bufferRef.current += e.key;
        lastKeyTimeRef.current = now;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [enabled]);
}
