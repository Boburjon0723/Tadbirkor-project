export const FIELD_TASK_STATUS_LABEL: Record<string, string> = {
  ASSIGNED: 'Yangi topshiriq',
  IN_PROGRESS: 'Qabul qildingiz — ish jarayonda',
  REPORTED: 'Hisobot yuborildi',
  NEEDS_FIX: 'Qayta hisobot kerak',
  APPROVED: 'Tasdiqlangan',
  REJECTED: 'Rad etilgan',
  CANCELED: 'Bekor qilingan',
};

export function fieldStatusBadgeClass(status: string): string {
  switch (status) {
    case 'ASSIGNED':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    case 'IN_PROGRESS':
      return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
    case 'REPORTED':
      return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
    case 'NEEDS_FIX':
      return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
    case 'APPROVED':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    default:
      return 'bg-gray-500/15 text-gray-400 border-gray-500/30';
  }
}
