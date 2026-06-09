import type { WarehouseIntake, WarehouseIntakeSettings } from '@/services/warehouse-intake.service';

export function intakeStatusLabel(status: string) {
  switch (status) {
    case 'DRAFT':
      return 'Qoralama';
    case 'COMPLETED':
      return 'Yakunlangan';
    case 'CANCELLED':
      return 'Bekor qilingan';
    default:
      return status;
  }
}

/** Stitch mobil status pill */
export function intakeStatusPillClass(status: string) {
  switch (status) {
    case 'DRAFT':
      return 'bg-[rgba(255,185,95,0.2)] text-[#ffb95f]';
    case 'COMPLETED':
      return 'bg-[rgba(16,185,129,0.2)] text-[#10b981]';
    case 'CANCELLED':
      return 'bg-[rgba(255,180,171,0.2)] text-[#ffb4ab]';
    default:
      return 'bg-white/10 text-gray-400';
  }
}

export function intakeStatusMobileLabel(status: string) {
  switch (status) {
    case 'DRAFT':
      return 'QORALAMA';
    case 'COMPLETED':
      return 'TUGALLANGAN';
    case 'CANCELLED':
      return 'BEKOR QILINGAN';
    default:
      return status;
  }
}

export function scanModeMobileLabel(settings?: WarehouseIntakeSettings) {
  if (!settings) return 'Skaner';
  return settings.scanMode === 'EACH_SCAN_ONE' ? 'Har skaner +1' : 'Skaner + miqdor';
}

export function intakeStatusStyle(status: string) {
  switch (status) {
    case 'DRAFT':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    case 'COMPLETED':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'CANCELLED':
      return 'bg-white/5 text-gray-400 border-white/10';
    default:
      return 'bg-white/5 text-gray-400 border-white/10';
  }
}

export function lineQty(line: { quantity: number | string }) {
  return Number(line.quantity) || 0;
}

export function intakeTotals(intake?: WarehouseIntake | null) {
  const lines = intake?.lines ?? [];
  const positions = lines.length;
  const units = lines.reduce((sum, l) => sum + lineQty(l), 0);
  return { positions, units };
}

export function scanModeLabel(settings?: WarehouseIntakeSettings) {
  if (!settings) return '';
  return settings.scanMode === 'EACH_SCAN_ONE'
    ? 'Qattiq: har skaner +1'
    : 'Tez: skaner + miqdor';
}

export function canManualAdd(settings?: WarehouseIntakeSettings) {
  if (!settings) return true;
  if (settings.scanMode === 'EACH_SCAN_ONE') return false;
  return settings.allowBulkQty;
}

export function canEditLineQty(settings?: WarehouseIntakeSettings) {
  if (!settings) return true;
  return settings.scanMode !== 'EACH_SCAN_ONE';
}

export function formatIntakeDate(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('uz-UZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
