// IndexedDB wrapper for timer persistence with backup storage
const DB_NAME = 'timeflow';
const DB_VERSION = 1;
const TIMER_STORE = 'timer_state';
const BACKUP_KEY = 'timeflow_timer_backup';

interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  startTime: number | null;
  elapsedTime: number;
  baseTime: number;
  description: string;
  selectedClient: any;
  selectedProject: any;
  isBillable: boolean;
  lastUpdate: number;
}

class TimerDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.warn('IndexedDB failed, falling back to localStorage');
        resolve();
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(TIMER_STORE)) {
          const store = db.createObjectStore(TIMER_STORE);
          store.createIndex('lastUpdate', 'lastUpdate');
        }
      };
    });

    return this.initPromise;
  }

  private async saveToLocalStorage(state: TimerState): Promise<void> {
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify({
        ...state,
        lastUpdate: Date.now()
      }));
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }

  private getFromLocalStorage(): TimerState | null {
    try {
      const data = localStorage.getItem(BACKUP_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn('Failed to read from localStorage:', error);
      return null;
    }
  }

  async saveTimer(state: TimerState): Promise<void> {
    await this.init();
    
    const stateWithTimestamp = {
      ...state,
      lastUpdate: Date.now()
    };

    // Save to both IndexedDB and localStorage for redundancy
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        if (!this.db) {
          resolve();
          return;
        }

        const transaction = this.db.transaction([TIMER_STORE], 'readwrite');
        const store = transaction.objectStore(TIMER_STORE);
        const request = store.put(stateWithTimestamp, 'current');

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      }),
      this.saveToLocalStorage(stateWithTimestamp)
    ]);
  }

  async getTimer(): Promise<TimerState | null> {
    await this.init();

    try {
      // Try IndexedDB first
      if (this.db) {
        const state = await new Promise<TimerState | null>((resolve, reject) => {
          const transaction = this.db!.transaction([TIMER_STORE], 'readonly');
          const store = transaction.objectStore(TIMER_STORE);
          const request = store.get('current');

          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });

        if (state) return this.adjustTimerState(state);
      }

      // Fall back to localStorage
      const backupState = this.getFromLocalStorage();
      return backupState ? this.adjustTimerState(backupState) : null;

    } catch (error) {
      console.warn('Error reading timer state:', error);
      // Try localStorage as last resort
      const backupState = this.getFromLocalStorage();
      return backupState ? this.adjustTimerState(backupState) : null;
    }
  }

  private adjustTimerState(state: TimerState): TimerState {
    if (state.isRunning && !state.isPaused && state.startTime) {
      const now = Date.now();
      // Ensure we don't lose time when restoring state
      state.startTime = now - Math.max(state.baseTime, now - state.startTime);
    }
    return state;
  }

  async clearTimer(): Promise<void> {
    await this.init();

    await Promise.all([
      new Promise<void>((resolve, reject) => {
        if (!this.db) {
          resolve();
          return;
        }

        const transaction = this.db.transaction([TIMER_STORE], 'readwrite');
        const store = transaction.objectStore(TIMER_STORE);
        const request = store.delete('current');

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      }),
      new Promise<void>((resolve) => {
        try {
          localStorage.removeItem(BACKUP_KEY);
        } catch (error) {
          console.warn('Failed to clear localStorage backup:', error);
        }
        resolve();
      })
    ]);
  }
}

export const timerDB = new TimerDB();