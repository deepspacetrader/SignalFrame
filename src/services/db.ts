
/**
 * Backend API Service for SignalFrame
 * Handles persistence of daily analysis snapshots via backend API.
 */

const API_BASE = 'http://localhost:3001/api';

export class StorageService {
    static async saveAnalysis(date: string, data: any) {
        try {
            const response = await fetch(`${API_BASE}/analysis/${date}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Failed to save analysis');
            return true;
        } catch (error) {
            console.error('StorageService saveAnalysis error:', error);
            throw error;
        }
    }

    static async getAnalysis(date: string): Promise<any> {
        try {
            const response = await fetch(`${API_BASE}/analysis/${date}`);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error('StorageService getAnalysis error:', error);
            return null;
        }
    }

    static async getAllDates(): Promise<string[]> {
        try {
            const response = await fetch(`${API_BASE}/analysis/dates`);
            if (!response.ok) return [];
            return await response.json();
        } catch (error) {
            console.error('StorageService getAllDates error:', error);
            return [];
        }
    }

    static async saveGlobal(key: string, data: any) {
        try {
            // Wrap primitives (numbers, strings, booleans) so the JSON body parser
            // on the server doesn't reject them as top-level non-objects
            const payload = (data !== null && typeof data === 'object' && !Array.isArray(data))
                ? data
                : { __value: data };
            const response = await fetch(`${API_BASE}/global/${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to save global data (${response.status}): ${errorText}`);
            }
            return true;
        } catch (error) {
            console.error('StorageService saveGlobal error:', error);
            throw error;
        }
    }

    static async getGlobal(key: string): Promise<any> {
        try {
            const response = await fetch(`${API_BASE}/global/${key}`);
            if (!response.ok) return null;
            const data = await response.json();
            // Unwrap primitives that were wrapped by saveGlobal
            if (data && typeof data === 'object' && '__value' in data) {
                return data.__value;
            }
            return data;
        } catch (error) {
            console.error('StorageService getGlobal error:', error);
            return null;
        }
    }
}
