import { StateStorage } from 'zustand/middleware';
import { db } from '../services/dbService';

/**
 * Custom storage for Zustand that uses IndexedDB via Dexie
 */
export const idbStorage: StateStorage = {
    getItem: async (name: string): Promise<string | null> => {
        const record = await db.keyValue.get(name);
        if (record) return record.value;

        // Migration: check localStorage if IDB is empty
        const local = localStorage.getItem(name);
        if (local) {
            console.log(`[Storage] Migrating ${name} from localStorage to IndexedDB`);
            await db.keyValue.put({ key: name, value: local });
            localStorage.removeItem(name);
            return local;
        }

        return null;
    },
    setItem: async (name: string, value: string): Promise<void> => {
        await db.keyValue.put({ key: name, value: value });
    },
    removeItem: async (name: string): Promise<void> => {
        await db.keyValue.delete(name);
    },
};
