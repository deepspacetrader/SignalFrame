
/**
 * IndexedDB Service for SignalFrame
 * Handles large scale persistence of daily analysis snapshots.
 */

const DB_NAME = 'SignalFrameDB';
const DB_VERSION = 1;

export class StorageService {
    private static db: IDBDatabase | null = null;

    static async init(): Promise<IDBDatabase> {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event: any) => {
                const db = event.target.result;
                // Store analysis by date (e.g., '2026-01-08')
                if (!db.objectStoreNames.contains('analysis')) {
                    db.createObjectStore('analysis', { keyPath: 'date' });
                }
                // Store global definitions (AI config, trackable relations)
                if (!db.objectStoreNames.contains('global')) {
                    db.createObjectStore('global');
                }
            };

            request.onsuccess = (event: any) => {
                this.db = event.target.result;
                resolve(this.db!);
            };

            request.onerror = (event) => reject(event);
        });
    }

    static async saveAnalysis(date: string, data: any) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['analysis'], 'readwrite');
            const store = transaction.objectStore('analysis');
            const request = store.put({ date, ...data, timestamp: new Date().getTime() });
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    static async getAnalysis(date: string): Promise<any> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['analysis'], 'readonly');
            const store = transaction.objectStore('analysis');
            const request = store.get(date);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    static async getAllDates(): Promise<string[]> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['analysis'], 'readonly');
            const store = transaction.objectStore('analysis');
            const request = store.getAllKeys();
            request.onsuccess = () => resolve((request.result as string[]).sort());
            request.onerror = () => reject(request.error);
        });
    }

    static async saveGlobal(key: string, data: any) {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['global'], 'readwrite');
            const store = transaction.objectStore('global');
            const request = store.put(data, key);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    static async getGlobal(key: string): Promise<any> {
        const db = await this.init();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['global'], 'readonly');
            const store = transaction.objectStore('global');
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}
