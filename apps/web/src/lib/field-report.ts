export type FieldReportRow = {
  variantId: string;
  label: string;
  plannedQty: number;
  usedQty: number;
  returnedQty: number;
  lostQty: number;
};

export function mergeTaskReportRows(task: {
  plannedItems?: unknown;
  report?: { items?: unknown } | null;
}): FieldReportRow[] {
  const planned = Array.isArray(task.plannedItems) ? task.plannedItems : [];
  const reportItems = Array.isArray(task.report?.items) ? task.report.items : [];

  return planned.map((p: any) => {
    const r = reportItems.find((i: any) => i.variantId === p.variantId);
    return {
      variantId: p.variantId,
      label: p.label || 'Mahsulot',
      plannedQty: Number(p.qty) || 0,
      usedQty: Number(r?.usedQty) || 0,
      returnedQty: Number(r?.returnedQty) || 0,
      lostQty: Number(r?.lostQty) || 0,
    };
  });
}

export function totalInstalledQty(rows: FieldReportRow[]): number {
  return rows.reduce((sum, r) => sum + r.usedQty, 0);
}
