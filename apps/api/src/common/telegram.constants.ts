/** Asosiy Telegram bot — ro'yxatdan o'tish, parol tiklash, bildirishnomalar */
export const DEFAULT_TELEGRAM_BOT_USERNAME = 'tadbirkor_malumot_bot';

export function normalizeTelegramBotUsername(raw?: string | null): string {
  const value = String(raw || '')
    .trim()
    .replace(/^@+/, '');
  return value || DEFAULT_TELEGRAM_BOT_USERNAME;
}

export function telegramBotUrl(startPayload?: string): string {
  const username = DEFAULT_TELEGRAM_BOT_USERNAME;
  if (startPayload?.trim()) {
    return `https://t.me/${username}?start=${encodeURIComponent(startPayload.trim())}`;
  }
  return `https://t.me/${username}`;
}
