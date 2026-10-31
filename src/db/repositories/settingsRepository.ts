import { db } from '../database';

const DEFAULT_SETTINGS = {
  theme: 'light',
  isPinEnabled: false,
  pinHash: '',
  pinSalt: '',
  reportDate: '2026-10-29',
};

export const settingsRepository = {
  async get<T>(key: string, defaultValue?: T): Promise<T> {
    const item = await db.appSettings.get(key);
    if (!item) {
      if (defaultValue !== undefined) return defaultValue;
      return (DEFAULT_SETTINGS as Record<string, unknown>)[key] as T;
    }
    return item.value as T;
  },

  async set<T>(key: string, value: T): Promise<void> {
    await db.appSettings.put({
      key,
      value,
      updatedAt: new Date().toISOString(),
    });
  },

  async getAllSettings(): Promise<typeof DEFAULT_SETTINGS> {
    const items = await db.appSettings.toArray();
    const map = items.reduce((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {} as Record<string, unknown>);

    return {
      ...DEFAULT_SETTINGS,
      ...map,
    };
  }
};
