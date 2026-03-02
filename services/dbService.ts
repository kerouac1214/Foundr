import Dexie, { Table } from 'dexie';
import { proxyRunningHubUrl } from '../utils/urlUtils';

export interface AssetRecord {
    id: string; // e.g., shotId_type or charId
    projectId: string;
    type: 'image' | 'video' | 'candidate';
    data: Blob;
    timestamp: number;
}

export interface KeyValueRecord {
    key: string;
    value: any;
}

export class AssetDatabase extends Dexie {
    assets!: Table<AssetRecord>;
    keyValue!: Table<KeyValueRecord>;

    constructor() {
        super('FoundrAssetDB');
        this.version(2).stores({
            assets: 'id, projectId, type, timestamp',
            keyValue: 'key'
        });
    }
}

export const db = new AssetDatabase();

export const AssetDBService = {
    async saveAsset(id: string, projectId: string, type: AssetRecord['type'], data: Blob | string) {
        let blob: Blob;
        if (typeof data === 'string') {
            if (data.startsWith('data:') || data.startsWith('blob:') || data.startsWith('http') || data.startsWith('/')) {
                try {
                    let fetchUrl = proxyRunningHubUrl(data);

                    const resp = await fetch(fetchUrl);
                    if (!resp.ok) throw new Error(`Fetch failed with status ${resp.status}`);
                    blob = await resp.blob();

                    // Final check: if we fetched something that isn't an image/video/audio (like a 404 HTML page)
                    if (blob.size < 100) { // Unlikely to be a valid asset
                        throw new Error("Fetched data too small to be a valid asset");
                    }
                } catch (e) {
                    console.error("Asset fetch failed", e);
                    throw new Error(`Failed to store asset: ${e instanceof Error ? e.message : 'Unknown error'}`);
                }
            } else {
                blob = new Blob([data], { type: 'text/plain' });
            }
        } else {
            blob = data;
        }

        await db.assets.put({
            id,
            projectId,
            type,
            data: blob,
            timestamp: Date.now()
        });

        return URL.createObjectURL(blob);
    },

    async getAsset(id: string): Promise<Blob | null> {
        const record = await db.assets.get(id);
        return record ? record.data : null;
    },

    async getAssetUrl(id: string): Promise<string | null> {
        const blob = await this.getAsset(id);
        return blob ? URL.createObjectURL(blob) : null;
    },

    async deleteProjectAssets(projectId: string) {
        await db.assets.where('projectId').equals(projectId).delete();
    },

    async clearAll() {
        await db.assets.clear();
    },

    async getAllProjectAssets(projectId: string) {
        return await db.assets.where('projectId').equals(projectId).toArray();
    },

    /**
     * Generates a deterministic ID for an asset to allow recovery after refresh.
     */
    getDeterministicId(type: 'photo' | 'video' | 'candidate', shotId: string, index?: number) {
        if (type === 'candidate') return `shot_${shotId}_cand_${index}`;
        return `shot_${shotId}_${type}`;
    }
};
