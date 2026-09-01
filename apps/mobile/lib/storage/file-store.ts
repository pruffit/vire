import { Directory, File, Paths } from 'expo-file-system';

/**
 * Хранилище ключ-значение поверх файловой системы, в форме `StateStorage` из zustand.
 *
 * Почему не AsyncStorage: `expo-file-system` уже стоит и уже так используется
 * (`lib/offline/download-manager.ts` держит индекс скачанного плоским JSON). Новая
 * нативная зависимость означала бы новую пересборку и новый риск — ради интерфейса,
 * который здесь занимает двадцать строк.
 *
 * Форма выбрана под `createJSONStorage` намеренно: персист плеера (P2) подключится к
 * этому же адаптеру без переписывания.
 */
const DIR_NAME = 'prefs';

function file(key: string): File {
  const dir = new Directory(Paths.document, DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  // Ключ идёт в имя файла — режем всё, что файловая система может понять по-своему.
  return new File(dir, `${key.replace(/[^\w.-]/g, '_')}.json`);
}

export const fileStore = {
  getItem(key: string): string | null {
    try {
      const f = file(key);
      return f.exists ? f.textSync() : null;
    } catch {
      // Нечитаемое хранилище не должно ронять запуск — ведём себя как «ничего не сохранено».
      return null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      file(key).write(value);
    } catch {
      // Настройки не критичны: потеря записи хуже молчания, но не фатальна.
    }
  },

  removeItem(key: string): void {
    try {
      const f = file(key);
      if (f.exists) f.delete();
    } catch {
      // см. выше
    }
  },
};
