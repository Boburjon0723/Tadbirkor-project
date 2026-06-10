import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
} from 'lucide-react';

export function getNotificationIcon(type: string, size = 20) {
  switch (type) {
    case 'SUCCESS':
      return <CheckCircle2 className="text-emerald-500" size={size} />;
    case 'WARNING':
      return <AlertTriangle className="text-amber-500" size={size} />;
    case 'ERROR':
      return <XCircle className="text-red-500" size={size} />;
    default:
      return <Info className="text-blue-500" size={size} />;
  }
}

export function formatNotificationTimeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Hozirgina';
  if (minutes < 60) return `${minutes} daqiqa avval`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} soat avval`;
  return new Date(date).toLocaleDateString('uz-UZ');
}
