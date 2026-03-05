import { useProjectStore } from '../store/useProjectStore';

/**
 * Laf Cloud Service Wrapper
 * Handles communication with Laf cloud functions and database using native fetch
 */
export class LafService {
    private static instance: LafService;
    private appId: string = '';
    private baseUrl: string = '';

    private constructor() {
        this.updateConfig();
    }

    public static getInstance(): LafService {
        if (!LafService.instance) {
            LafService.instance = new LafService();
        }
        return LafService.instance;
    }

    public updateConfig() {
        // We'll look for LAF_APP_ID in process.env or project store
        const envAppId = (process as any).env?.LAF_APP_ID;
        if (envAppId) {
            this.appId = envAppId;
            this.baseUrl = `https://${this.appId}.sealosbja.site`;
        }
    }

    public setAppId(appId: string) {
        this.appId = appId;
        this.baseUrl = `https://${this.appId}.sealosbja.site`;
    }

    /**
     * Call a Laf Cloud Function
     */
    public async callFunction(name: string, data: any) {
        if (!this.appId) {
            throw new Error('Laf App ID not configured. Please set it in settings.');
        }

        const response = await fetch(`${this.baseUrl}/${name}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Laf Function Error (${name}): ${errorText}`);
        }

        return await response.json();
    }

    /**
     * Proxy AI Chat request through Laf to protect API Keys
     */
    public async chatProxy(engine: string, messages: any[], model?: string, jsonMode: boolean = false) {
        const result = await this.callFunction('ai-chat-proxy', {
            engine,
            messages,
            model,
            jsonMode
        });
        return result.content;
    }
}

export const lafService = LafService.getInstance();
