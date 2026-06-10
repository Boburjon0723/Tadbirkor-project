/** Backend `round2` bilan mos: 2 xonagacha yaxlitlash */
export function roundMoney(value: number): number {
  return Math.round(Number(value || 0) * 100) / 100;
}

/** POS savat jami — har qator alohida yaxlitlanadi */
export function calcPosCartTotal(
  items: Array<{ price: number; quantity: number }>,
): number {
  const subtotal = items.reduce(
    (sum, item) => sum + roundMoney(item.price * item.quantity),
    0,
  );
  return roundMoney(subtotal);
}
