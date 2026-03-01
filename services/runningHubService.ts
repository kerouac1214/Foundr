import { withRetry } from "./core";

const PROXY_BASE_URL = process.env.VITE_API_BASE_URL || "https://rough-mode-92f3.kerouac1214.workers.dev";
// Route through Vite proxy in dev to avoid CORS issues
const RUNNINGHUB_API_KEY = process.env.RUNNINGHUB_API_KEY || "";
const DEFAULT_BASE_URL = "/runninghub";

export interface RunningHubConfig {
    api_base?: string;
    api_key?: string;
}
const VOICE_WORKFLOW_ID = "2021166495828549634"; // Voice Cloning Workflow ID

export interface VoiceCloneResponse {
    audioUrl: string;
    duration?: number;
}

/**
 * Clones a voice using RunningHub API.
 * @param audioBase64 The reference audio file input as a Base64 string (without data URI prefix ideally, but we will handle logic).
 * @param text The text to be spoken by the cloned voice.
 * @returns Promise resolving to the generated audio URL.
 */


// Helper to create a Blob from Base64 string in both Node and Browser environments
const createBlob = async (base64: string, mimeType: string = 'application/octet-stream'): Promise<Blob> => {
    // Check if running in Node.js
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
        const { Blob } = await import('node:buffer');
        const buffer = Buffer.from(base64, 'base64');
        return new Blob([buffer], { type: mimeType }) as unknown as Blob;
    } else {
        // Browser environment
        const response = await fetch(`data:${mimeType};base64,${base64}`);
        return await response.blob();
    }
};

export const uploadFile = async (
    base64OrBlob: string | Blob,
    filename: string = `file_${Date.now()}.png`,
    config?: RunningHubConfig
): Promise<string> => {
    const apiBase = config?.api_base || DEFAULT_BASE_URL;
    const apiKey = config?.api_key || RUNNINGHUB_API_KEY;
    let blob: Blob;
    let mimeType = 'application/octet-stream';
    if (filename.endsWith('.png')) mimeType = 'image/png';
    else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) mimeType = 'image/jpeg';
    else if (filename.endsWith('.wav')) mimeType = 'audio/wav';

    if (typeof base64OrBlob === 'string') {
        const cleanBase64 = base64OrBlob.includes('base64,') ? base64OrBlob.split('base64,')[1] : base64OrBlob;
        blob = await createBlob(cleanBase64, mimeType);
    } else {
        blob = base64OrBlob;
    }

    // For RunningHub upload
    const formData = new FormData();
    formData.append('file', blob, filename);
    formData.append('apiKey', apiKey);

    // Route through Vite proxy or custom base
    const PRIMARY_UPLOAD_URL = `${apiBase}/task/openapi/upload`;

    try {
        const resp = await fetch(PRIMARY_UPLOAD_URL, {
            method: 'POST',
            headers: { "Authorization": `Bearer ${apiKey}` }, // Header also required?
            body: formData
        });

        if (resp.ok) {
            const data = await resp.json();
            // For task/openapi/upload, success format is often just { "code": 0, "data": { "fileName": "..." } } or similar
            if (data.code === 0 && data.data && data.data.fileName) return data.data.fileName;
            // Sometimes it returns path directly? 
            // Previous debug showed: Upload Success: api/8c1...
            // Let's check other fields
            if (data.data && data.data.fileUrl) return data.data.fileUrl;
            if (data.fileName) return data.fileName;

            console.log("Upload response data:", JSON.stringify(data));
        } else {
            console.warn(`Upload failed status: ${resp.status}`, await resp.text());
        }
    } catch (e) {
        console.warn("Upload exception:", e);
    }

    throw new Error("RunningHub File Upload Failed");
};

export interface NodeInfo {
    nodeId: string;
    fieldName: string;
    fieldValue: string;
    description?: string;
}

export const runNBProImage = async (params: { prompt: string, aspectRatio?: string, resolution?: string }, config?: RunningHubConfig) => {
    const apiBase = config?.api_base || DEFAULT_BASE_URL;
    const apiKey = config?.api_key || RUNNINGHUB_API_KEY;
    const URL = `${apiBase}/openapi/v2/rhart-image-n-pro/text-to-image`;

    const body = {
        prompt: params.prompt,
        resolution: params.resolution || "1k",
        aspectRatio: params.aspectRatio || "16:9"
    };

    const resp = await fetch(URL, {
        method: 'POST',
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`NB Pro Run Failed (${resp.status}): ${text}`);
    }

    const result = await resp.json();
    const taskId = result.taskId || (result.data && result.data.taskId);
    if (!taskId) throw new Error(`No Task ID in response: ${JSON.stringify(result)}`);
    return taskId;
};

export const runViduQ2Pro = async (params: { prompt: string, imageUrl: string, duration?: string, resolution?: string }, config?: RunningHubConfig) => {
    const apiBase = config?.api_base || DEFAULT_BASE_URL;
    const apiKey = config?.api_key || RUNNINGHUB_API_KEY;
    const URL = `${apiBase}/openapi/v2/vidu/image-to-video-q2-pro`;

    const body = {
        prompt: params.prompt,
        imageUrl: params.imageUrl,
        duration: params.duration || "5",
        resolution: params.resolution || "720p",
        movementAmplitude: "auto",
        bgm: false // Changed to false by default for consistency unless BGM is needed
    };

    const resp = await fetch(URL, {
        method: 'POST',
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Vidu Q2 Pro Run Failed (${resp.status}): ${text}`);
    }

    const result = await resp.json();
    const taskId = result.taskId || (result.data && result.data.taskId);
    if (!taskId) throw new Error(`No Task ID in response: ${JSON.stringify(result)}`);
    return taskId;
};

export const runWorkflow = async (workflowId: string, nodeInfoList: NodeInfo[], config?: RunningHubConfig) => {
    const apiBase = config?.api_base || DEFAULT_BASE_URL;
    const apiKey = config?.api_key || RUNNINGHUB_API_KEY;

    const endpoints = [
        `${apiBase}/openapi/v2/run/workflow/${workflowId}`,
        `${apiBase}/openapi/v2/run/ai-app/${workflowId}`
    ];

    const body = {
        nodeInfoList,
        instanceType: "default",
        usePersonalQueue: "false",
        addMetadata: true
    };

    for (const url of endpoints) {
        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            if (resp.status === 404) continue; // Try next endpoint

            if (!resp.ok) {
                const text = await resp.text();
                throw new Error(`RunningHub Run Failed (${resp.status}): ${text}`);
            }

            const result = await resp.json();
            if (!result.taskId) throw new Error(`No Task ID in response: ${JSON.stringify(result)}`);
            return result.taskId;
        } catch (e) {
            if (url === endpoints[endpoints.length - 1]) throw e;
        }
    }
    throw new Error("Could not find valid run endpoint");
};

export const pollTask = async (taskId: string, config?: RunningHubConfig, timeoutMs: number = 240000) => {
    const apiBase = config?.api_base || DEFAULT_BASE_URL;
    const apiKey = config?.api_key || RUNNINGHUB_API_KEY;

    // Use the v2 query endpoint provided by user
    const QUERY_URL = `${apiBase}/openapi/v2/query`;
    let attempts = 0;
    const interval = 4000;
    const maxAttempts = timeoutMs / interval;

    while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, interval));

        const resp = await fetch(QUERY_URL, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({ taskId })
        });

        if (!resp.ok) {
            console.warn(`Poll failed: ${resp.status}`);
            continue;
        }

        const result = await resp.json();
        // User provided response format:
        // { "taskId": "...", "status": "SUCCESS", "results": [ { "url": "...", ... } ], ... }

        const status = result.status;

        if (status === "SUCCESS") {
            if (result.results && result.results.length > 0) {
                // Find the first valid URL
                const output = result.results.find((r: any) => r.url);
                if (output) {
                    if (output.url.includes('rh-images-1252422369.cos.ap-beijing.myqcloud.com')) {
                        return output.url.replace('https://rh-images-1252422369.cos.ap-beijing.myqcloud.com', '/rh-images');
                    }
                    return output.url;
                }
            }
            throw new Error(`Task Succeeded but no results found: ${JSON.stringify(result)}`);
        } else if (status === "FAILED") {
            throw new Error(`Task Failed: ${result.errorMessage || result.errorCode}`);
        }

        // QUEUED or RUNNING
        attempts++;
    }
    throw new Error("Task Timeout");
};

export const cloneVoice = async (audioBase64: string, text: string, config?: RunningHubConfig): Promise<string> => {
    // 1. Upload
    const audioUrl = await uploadFile(audioBase64, `voice_${Date.now()}.wav`, config);
    console.log("Voice Audio Uploaded:", audioUrl);

    // 2. Run
    const taskId = await runWorkflow(VOICE_WORKFLOW_ID, [
        { nodeId: "11", fieldName: "audio", fieldValue: audioUrl, description: "audio" },
        { nodeId: "8", fieldName: "prompt", fieldValue: text, description: "prompt" }
    ], config);
    console.log("Voice Task Started:", taskId);

    // 3. Poll
    return await pollTask(taskId, config);
};

export const runSeedance15 = async (params: { prompt: string, imageUrl: string, duration?: string, resolution?: string, aspectRatio?: string }, config?: RunningHubConfig) => {
    const apiBase = config?.api_base || DEFAULT_BASE_URL;
    const apiKey = config?.api_key || RUNNINGHUB_API_KEY;
    const URL = `${apiBase}/openapi/v2/seedance-v1.5-pro/image-to-video-fast`;

    const body = {
        prompt: params.prompt,
        firstImageUrl: params.imageUrl,
        lastImageUrl: "",
        aspectRatio: params.aspectRatio || "adaptive",
        duration: params.duration || "5",
        resolution: params.resolution || "720p",
        generateAudio: "true",
        cameraFixed: "false"
    };

    const resp = await fetch(URL, {
        method: 'POST',
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Seedance 1.5 Run Failed (${resp.status}): ${text}`);
    }

    const result = await resp.json();
    const taskId = result.taskId || (result.data && result.data.taskId);
    if (!taskId) throw new Error(`No Task ID in response: ${JSON.stringify(result)}`);
    return taskId;
};

/**
 * Rhart Flash Text to Image API
 */
export async function runRhartT2I(prompt: string, aspectRatio: string, config?: any): Promise<string> {
    const apiBase = config?.api_base || DEFAULT_BASE_URL;
    const apiKey = config?.api_key || RUNNINGHUB_API_KEY;
    const resp = await fetch(`${apiBase}/openapi/v2/rhart-image-n-g31-flash/text-to-image`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            prompt,
            aspectRatio,
            resolution: "1k"
        })
    });

    if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Rhart T2I Failed: ${resp.status} - ${errText}`);
    }

    const data = await resp.json();
    console.log(`[Rhart T2I] Response:`, JSON.stringify(data));

    if (data.errorCode && data.errorCode !== "0") {
        throw new Error(`Rhart T2I Error (${data.errorCode}): ${data.errorMessage}`);
    }

    const taskIdResult = data.taskId || (data.data && data.data.taskId);
    if (!taskIdResult) throw new Error(`No taskId returned from Rhart T2I: ${JSON.stringify(data)}`);
    return await pollTask(taskIdResult, config);
}

/**
 * Rhart Flash Image to Image API
 */
export async function runRhartI2I(prompt: string, imageUrls: string[], aspectRatio: string, config?: any): Promise<string> {
    const apiBase = config?.api_base || DEFAULT_BASE_URL;
    const apiKey = config?.api_key || RUNNINGHUB_API_KEY;
    const resp = await fetch(`${apiBase}/openapi/v2/rhart-image-n-g31-flash/image-to-image`, {
        method: 'POST',
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            imageUrls,
            prompt,
            aspectRatio,
            resolution: "1k"
        })
    });

    if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Rhart I2I Failed: ${resp.status} - ${errText}`);
    }

    const data = await resp.json();
    console.log(`[Rhart I2I] Response:`, JSON.stringify(data));

    if (data.errorCode && data.errorCode !== "0") {
        throw new Error(`Rhart I2I Error (${data.errorCode}): ${data.errorMessage}`);
    }

    const taskIdResult = data.taskId || (data.data && data.data.taskId);
    if (!taskIdResult) throw new Error(`No taskId returned from Rhart I2I: ${JSON.stringify(data)}`);
    return await pollTask(taskIdResult, config);
}

