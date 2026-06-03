/** O‘zbekiston telefonini E.164 (+998XXXXXXXXX) formatiga keltirish. */
export function normalizeUzPhone(raw: string | null | undefined): string | null {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return null;

  let normalized = digits;
  if (normalized.startsWith('998')) {
    normalized = normalized.slice(3);
  } else if (normalized.startsWith('8') && normalized.length >= 10) {
    normalized = normalized.slice(1);
  }

  if (normalized.length === 9) {
    return `+998${normalized}`;
  }
  if (normalized.length === 12 && normalized.startsWith('998')) {
    return `+${normalized}`;
  }
  return null;
}

export function phonesEquivalent(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeUzPhone(a);
  const nb = normalizeUzPhone(b);
  if (!na || !nb) return false;
  return na === nb;
}
