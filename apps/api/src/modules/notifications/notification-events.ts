export type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export type NotificationEventPayload = {
  moduleKey: string;
  eventKey: string;
  severity?: NotificationSeverity;
  entityType?: string;
  entityId?: string;
  title: string;
  message: string;
  details?: Record<string, unknown>;
  targetRoles?: string[];
};

export function buildEventKey(moduleKey: string, eventKey: string, suffix?: string): string {
  return suffix ? `${moduleKey}:${eventKey}:${suffix}` : `${moduleKey}:${eventKey}`;
}

export function notificationPayloadToTelegramDetails(
  details?: Record<string, unknown>,
): Record<string, string> | undefined {
  if (!details) return undefined;
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(details)) {
    if (v === undefined || v === null) continue;
    flat[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
  }
  return flat;
}

export type CompanyTelegramPayload = {
  moduleKey: string;
  eventKey: string;
  details?: Record<string, unknown>;
  targetRoles?: string[];
  actions?: Array<{
    key: string;
    label: string;
    targetType: string;
    targetId: string;
    payload?: Record<string, unknown>;
  }>;
};