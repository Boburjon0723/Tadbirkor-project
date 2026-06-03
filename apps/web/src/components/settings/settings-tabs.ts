export const SETTINGS_TABS = [
  'profil',
  'kompaniya',
  'modullar',
  'rollar',
  'arxitektura',
  'xavfsizlik',
  'yordam',
  'tariflar',
] as const;

export type SettingsTabId = (typeof SETTINGS_TABS)[number];

export function isSettingsTab(value: string | null): value is SettingsTabId {
  return !!value && SETTINGS_TABS.includes(value as SettingsTabId);
}
