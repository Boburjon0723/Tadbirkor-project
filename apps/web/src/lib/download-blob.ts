const PDF_MIME = 'application/pdf';
const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Mobil brauzer yoki PWA (standalone) */
export function isMobileOrPwa(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent;
  const mobile = /iPhone|iPad|iPod|Android/i.test(ua);
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return mobile || standalone;
}

function mimeFromFilename(filename: string, fallback?: string): string {
  if (fallback && fallback !== 'application/octet-stream') return fallback;
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf')) return PDF_MIME;
  if (lower.endsWith('.xlsx')) return XLSX_MIME;
  if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
  return fallback || 'application/octet-stream';
}

function isShareableFile(mime: string, filename: string): boolean {
  return (
    mime === PDF_MIME ||
    mime === XLSX_MIME ||
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    /\.(pdf|xlsx|xls)$/i.test(filename)
  );
}

/**
 * Blob faylni yuklab olish — desktop va mobil/PWA uchun.
 * Mobilda: Web Share API → yangi tab → `<a download>` ketma-ketligi.
 */
export async function downloadBlobFile(
  blobData: Blob,
  filename: string,
  options?: { mimeType?: string },
): Promise<'shared' | 'opened' | 'downloaded'> {
  const mime = mimeFromFilename(filename, options?.mimeType || blobData.type);
  const blob =
    blobData.type === mime ? blobData : new Blob([blobData], { type: mime });
  const url = URL.createObjectURL(blob);

  const cleanup = (ms = 120_000) => {
    setTimeout(() => URL.revokeObjectURL(url), ms);
  };

  if (isMobileOrPwa()) {
    const file = new File([blob], filename, { type: mime });
    if (
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function'
    ) {
      try {
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: filename });
          cleanup();
          return 'shared';
        }
      } catch (err) {
        if ((err as DOMException)?.name === 'AbortError') {
          URL.revokeObjectURL(url);
          return 'downloaded';
        }
      }
    }

    if (isShareableFile(mime, filename)) {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) {
        window.location.assign(url);
      }
      cleanup();
      return 'opened';
    }
  }

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  cleanup(5_000);
  return 'downloaded';
}

export function mobileDownloadHint(result: 'shared' | 'opened' | 'downloaded'): string {
  if (result === 'shared') {
    return 'Fayl ulashildi — «Fayllarga saqlash» yoki kerakli ilovani tanlang';
  }
  if (result === 'opened' && isMobileOrPwa()) {
    return 'Fayl ochildi — yuqoridagi «Ulashish» tugmasidan saqlang';
  }
  return 'Fayl yuklandi';
}
