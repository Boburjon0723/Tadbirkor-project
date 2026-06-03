import { getInventorySocket } from '@/lib/inventory-socket';
import { productsService } from '@/services/products.service';

const TERMINAL = new Set([
  'COMPLETED',
  'COMPLETED_WITH_ERRORS',
  'FAILED',
  'CANCELLED',
]);

export type ImportProgressUpdate = {
  processed: number;
  total: number;
  successRows: number;
  failedRows: number;
};

export async function waitForImportJob(
  jobId: string,
  totalFallback: number,
  onProgress: (update: ImportProgressUpdate) => void,
  isCancelled: () => boolean,
): Promise<Record<string, unknown>> {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const socket = getInventorySocket();
    let settled = false;

    const cleanup = () => {
      clearInterval(pollTimer);
      socket?.off('import:progress', onSocket);
    };

    const finish = (payload: Record<string, unknown>) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(payload);
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(message));
    };

    const applyPayload = (payload: Record<string, unknown>) => {
      onProgress({
        processed: Number(payload.processedRows || 0),
        total: Number(payload.totalRows || totalFallback),
        successRows: Number(payload.successRows || 0),
        failedRows: Number(payload.failedRows || 0),
      });
    };

    const onSocket = (payload: Record<string, unknown>) => {
      if (String(payload?.jobId || '') !== jobId) return;
      if (isCancelled()) {
        fail('cancelled');
        return;
      }
      applyPayload(payload);
      const status = String(payload.status || '');
      if (status === 'CANCELLED') {
        fail('cancelled');
        return;
      }
      if (TERMINAL.has(status)) {
        finish(payload);
      }
    };

    const pollOnce = async () => {
      if (isCancelled()) {
        fail('cancelled');
        return;
      }
      if (Date.now() - start > 1000 * 60 * 20) {
        fail('Import kutish vaqti tugadi (20 daqiqa).');
        return;
      }
      const job = (await productsService.getImportJobStatus(jobId)) as Record<
        string,
        unknown
      >;
      applyPayload(job);
      const status = String(job?.status || '');
      if (status === 'CANCELLED') {
        fail('cancelled');
        return;
      }
      if (TERMINAL.has(status)) {
        finish(job);
      }
    };

    socket?.on('import:progress', onSocket);
    void pollOnce();
    const pollTimer = setInterval(() => {
      void pollOnce();
    }, 1000);
  });
}
