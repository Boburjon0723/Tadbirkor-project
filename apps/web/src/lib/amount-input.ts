/** Summa maydoni: faqat raqam va bitta o‘nlik ajratgich (`,` yoki `.`) */
export function sanitizeAmountInput(raw: string): string {
  let out = '';
  let hasSep = false;
  for (const ch of raw) {
    if (/\d/.test(ch)) {
      out += ch;
      continue;
    }
    if ((ch === ',' || ch === '.') && !hasSep) {
      hasSep = true;
      out += ch;
    }
  }
  return out;
}

export function parseAmountInput(value: string): number {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!normalized || normalized === '.') return NaN;
  return parseFloat(normalized);
}
