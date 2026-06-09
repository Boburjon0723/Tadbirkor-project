import { api } from '@/lib/api';
import { downloadBlobFile } from '@/lib/download-blob';
import { formatApiError, toast } from '@/lib/toast';

export async function openIntakeNakladnoyPdf(intakeId: string, reference: string) {
  try {
    const response = await api.get(`/warehouse-intake/${intakeId}/nakladnoy/pdf`, {
      responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
      await downloadBlobFile(blob, `nakladnoy-${reference}.pdf`, {
        mimeType: 'application/pdf',
      });
      toast.info('PDF yuklandi — faylni ochib chop eting');
      return;
    }
    URL.revokeObjectURL(url);
  } catch (err) {
    toast.error(formatApiError(err, 'Nakladnoy yuklanmadi'));
  }
}
