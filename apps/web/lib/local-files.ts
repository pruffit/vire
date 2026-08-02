/**
 * Реестр локальных файлов с устройства: только в памяти вкладки, на сервер не уходит.
 * Общий для вечеринки (колонка играет файл) и глобального плеера (файл в очереди).
 * В Chromium дополнительно запоминает file-хэндл в IndexedDB — файл переживает перезагрузку
 * при повторном разрешении доступа; Safari/Firefox остаются на сессионном Map (честно, без API FSA).
 */

interface LocalFileEntry {
  file: File;
  name: string;
}

const files = new Map<string, LocalFileEntry>();

function generateId(): string {
  return `local-${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
}

export function registerLocalFile(file: File, id: string = generateId()): string {
  files.set(id, { file, name: file.name });
  return id;
}

export function getLocalFile(id: string): File | null {
  return files.get(id)?.file ?? null;
}

type FileSystemFileHandleLike = {
  getFile(): Promise<File>;
  queryPermission?(opts: { mode: 'read' }): Promise<'granted' | 'denied' | 'prompt'>;
};
type FilePickerWindow = Window & {
  showOpenFilePicker?(opts: unknown): Promise<FileSystemFileHandleLike[]>;
};

export function hasFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && typeof (window as FilePickerWindow).showOpenFilePicker === 'function';
}

const DB_NAME = 'vire-party-files';
const STORE = 'handles';

function openHandleDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Best-effort: недоступный IndexedDB (приватный режим и т.п.) деградирует до сессионного файла молча. */
async function persistFileHandle(id: string, handle: FileSystemFileHandleLike): Promise<void> {
  try {
    const db = await openHandleDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(handle, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* остаётся только в памяти этой сессии */
  }
}

/** На маунте экрана вечеринки — поднять хэндлы, на которые браузер ещё не отозвал разрешение. */
export async function restorePersistedFiles(): Promise<Array<{ id: string; name: string }>> {
  if (!hasFileSystemAccess()) return [];
  try {
    const db = await openHandleDb();
    const entries = await new Promise<Array<[IDBValidKey, FileSystemFileHandleLike]>>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const cursorReq = tx.objectStore(STORE).openCursor();
      const out: Array<[IDBValidKey, FileSystemFileHandleLike]> = [];
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) { resolve(out); return; }
        out.push([cursor.key, cursor.value as FileSystemFileHandleLike]);
        cursor.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });

    const restored: Array<{ id: string; name: string }> = [];
    for (const [key, handle] of entries) {
      try {
        const permission = await handle.queryPermission?.({ mode: 'read' });
        if (permission && permission !== 'granted') continue;
        const file = await handle.getFile();
        const id = String(key);
        files.set(id, { file, name: file.name });
        restored.push({ id, name: file.name });
      } catch {
        /* хэндл протух (файл удалён/перемещён) — пропускаем */
      }
    }
    return restored;
  } catch {
    return [];
  }
}

/** Открывает системный выбор файла. Chromium — через File System Access (хэндл переживёт перезагрузку); иначе — вызывающая сторона использует скрытый `<input type="file">`. */
export async function pickLocalFile(): Promise<{ id: string; name: string } | null> {
  if (!hasFileSystemAccess()) return null;
  try {
    const w = window as FilePickerWindow;
    const [handle] = await w.showOpenFilePicker!({
      types: [{ description: 'Аудио', accept: { 'audio/*': ['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.aac'] } }],
    });
    if (!handle) return null;
    const file = await handle.getFile();
    const id = registerLocalFile(file);
    await persistFileHandle(id, handle);
    return { id, name: file.name };
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return null;
    return null;
  }
}
