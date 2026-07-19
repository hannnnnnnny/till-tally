export type DemoStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

// localStorage can be unavailable (private browsing hard limits); the demo
// then degrades to per-load memory instead of crashing.
export function resolveDemoStorage(candidate?: DemoStorage): DemoStorage {
  if (candidate) {
    return candidate;
  }

  try {
    const probeKey = 'tilltally-demo-probe';
    window.localStorage.setItem(probeKey, '1');
    window.localStorage.removeItem(probeKey);
    return window.localStorage;
  } catch {
    return createMemoryStorage();
  }
}

export function createMemoryStorage(): DemoStorage {
  const values = new Map<string, string>();

  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

export function readJsonItem<T>(storage: DemoStorage, key: string): T | null {
  const raw = storage.getItem(key);

  if (raw === null) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function writeJsonItem(storage: DemoStorage, key: string, value: unknown): void {
  storage.setItem(key, JSON.stringify(value));
}
