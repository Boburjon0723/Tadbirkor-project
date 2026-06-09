/** POS komponentlari uchun mavzu-agnostik Tailwind klasslari */

export const posCatalog = {
  surface: 'bg-[var(--pos-card)]',
  input: 'bg-[var(--pos-input-bg)] border-[var(--pos-border)] text-[var(--pos-text)]',
  text: 'text-[var(--pos-text)]',
  muted: 'text-[var(--pos-muted)]',
  border: 'border-[var(--pos-border)]',
  hoverCard: 'hover:bg-[var(--pos-card)]',
} as const;

export const posCart = {
  bg: 'bg-[var(--pos-cart-bg)]',
  card: 'bg-[var(--pos-cart-card)]',
  header: 'bg-[var(--pos-cart-header)]',
  text: 'text-[var(--pos-cart-text)]',
  muted: 'text-[var(--pos-cart-muted)]',
  border: 'border-[var(--pos-cart-border)]',
  input: 'bg-[var(--pos-cart-card)] border-[var(--pos-cart-border)] text-[var(--pos-cart-text)]',
} as const;
