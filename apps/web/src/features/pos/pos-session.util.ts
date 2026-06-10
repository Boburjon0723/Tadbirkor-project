import type { CartSession } from './usePosMultiCart';

/** Band bo'lmagan eng kichik Mijoz raqamini topadi */
export function nextSessionLabel(sessions: CartSession[]): string {
  const used = new Set<number>();
  for (const s of sessions) {
    const match = s.label.match(/Mijoz\s*(\d+)/i);
    if (match) used.add(Number(match[1]));
  }
  let n = 1;
  while (used.has(n)) n += 1;
  return `Mijoz ${n}`;
}
