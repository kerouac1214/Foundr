import { AspectRatio } from "../../types";
import { withRetry } from "../core";
import { ImageProvider } from "./base";
import { uploadFile, runWorkflow, pollTask, runNBProImage } from "../runningHubService";
import JSZip from "jszip";

export class RunningHubProvider implements ImageProvider {
    private workflowIdNBPro = "2004543847939751938"; // NB pro (Default)
    private workflowIdQwen = "2007837815798763521";  // qwen2512
    private workflowIdLegacy = "1967051468748546049"; // Legacy fusion
    private config?: any;
    private currentEngine: string = 'nb_pro';

    updateConfig(config: any) {
        this.config = config;
    }

    setEngine(engine: string) {
        this.currentEngine = engine;
    }

    private async urlToBlob(url: string): Promise<Blob> {
        let fetchUrl = url;
        if (url.includes('rh-images-1252422369.cos.ap-beijing.myqcloud.com')) {
            fetchUrl = url.replace('https://rh-images-1252422369.cos.ap-beijing.myqcloud.com', '/rh-images');
        }
        const resp = await fetch(fetchUrl);
        if (!resp.ok) throw new Error(`Failed to fetch image from ${url}`);
        return await resp.blob();
    }

    private async extractImageFromZipUrl(zipUrl: string): Promise<string> {
        const resp = await fetch(zipUrl);
        if (!resp.ok) throw new Error(`Failed to download zip: ${resp.status}`);
        const zipData = await resp.arrayBuffer();
        const zip = await JSZip.loadAsync(zipData);
        const imageFile = Object.values(zip.files).find(f =>
            !f.dir && /\.(png|jpg|jpeg|webp)$/i.test(f.name)
        );
        if (!imageFile) throw new Error('No image found in zip output');
        const blob = await imageFile.async('blob');
        return URL.createObjectURL(blob);
    }

    private aspectRatioToPixels(ratio: AspectRatio): [number, number] {
        switch (ratio) {
            case '16:9': return [1584, 888];
            case '9:16': return [888, 1584];
            case '4:3': return [1200, 900];
            case '1:1':
            default: return [1024, 1024];
        }
    }

    async generateImage(prompt: string, seed: number, aspectRatio: AspectRatio, refImages?: string[]): Promise<string> {
        return await withRetry(async () => {
            const uploadedUrls: string[] = [];
            if (refImages && refImages.length > 0) {
                for (const url of refImages) {
                    const blob = await this.urlToBlob(url);
                    const uploaded = await uploadFile(blob, `ref_${Date.now()}.png`, this.config);
                    uploadedUrls.push(uploaded);
                }
            }

            // Path 1: Z-image or NB Pro (Via User-Provided ComfyUI Workflow)
            if (this.currentEngine === 'nb_pro' || this.currentEngine === 'z_image' || this.currentEngine === 'runninghub') {
                // Check if this is a specialized Character DNA Prompt by extracting JSON
                let isCharacterJSON = false;
                let cleanJsonPrompt = prompt;

                try {
                    // Try parsing directly first
                    let parsed = JSON.parse(prompt);
                    if (parsed.Identity_Consistency_Protocol) isCharacterJSON = true;
                } catch (e) {
                    // If direct parse fails, try extracting via regex in case it has prefixes like "Character Portrait: "
                    const jsonMatch = prompt.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        try {
                            const parsed = JSON.parse(jsonMatch[0]);
                            if (parsed.Identity_Consistency_Protocol) {
                                isCharacterJSON = true;
                                cleanJsonPrompt = jsonMatch[0]; // Use the perfectly clean JSON
                            }
                        } catch (innerE) { }
                    }
                }

                // Z-image workflow maps to 2026205650287599618, Node 59.
                // It specifically handles Character DNA. But if user manually selected z_image for general storyboard, force run it through Node 59 anyway.
                if (isCharacterJSON || this.currentEngine === 'z_image') {
                    // If user forces z_image but provide non-json, we just send as is (though it might fail on server).
                    // If we found valid JSON, we send cleanJsonPrompt to guarantee it parses.
                    const finalPayload = isCharacterJSON ? cleanJsonPrompt : prompt;

                    const WORKFLOW_ID = "2026270585814261762";
                    const nodeInfoList: any[] = [
                        { nodeId: "59", fieldName: "value", fieldValue: finalPayload }
                    ];

                    console.log("[Z-Image Debug] Sending payload to RunningHub:", JSON.stringify(nodeInfoList, null, 2));

                    const taskId = await runWorkflow(WORKFLOW_ID, nodeInfoList, this.config);
                    const resultUrl = await pollTask(taskId, this.config);
                    if (resultUrl.endsWith('.zip')) return await this.extractImageFromZipUrl(resultUrl);
                    return resultUrl;
                }

                const WORKFLOW_ID = "2026161270482804737";

                // Base parameters mapped to Node 2
                const nodeInfoList: any[] = [
                    { nodeId: "2", fieldName: "prompt", fieldValue: prompt },
                    { nodeId: "2", fieldName: "aspectRatio", fieldValue: aspectRatio },
                    { nodeId: "2", fieldName: "resolution", fieldValue: "1k" },
                    { nodeId: "2", fieldName: "channel", fieldValue: "Third-party" } // Optional cost saving
                ];

                // Map up to 6 reference images to Nodes 11, 12, 13, 3, 7, 8
                const imageNodeIds = ["11", "12", "13", "3", "7", "8"];
                if (uploadedUrls.length > 0) {
                    for (let i = 0; i < Math.min(uploadedUrls.length, 6); i++) {
                        nodeInfoList.push({
                            nodeId: imageNodeIds[i],
                            fieldName: "image",
                            fieldValue: uploadedUrls[i]
                        });
                    }
                }

                const taskId = await runWorkflow(WORKFLOW_ID, nodeInfoList, this.config);
                const resultUrl = await pollTask(taskId, this.config);
                if (resultUrl.endsWith('.zip')) return await this.extractImageFromZipUrl(resultUrl);
                return resultUrl;
            }

            // Path 2: qwen2512 (Standard Workflow API)
            const [w, h] = this.aspectRatioToPixels(aspectRatio);
            const nodeInfoList: any[] = [
                { nodeId: "5", fieldName: "text", fieldValue: prompt },
                { nodeId: "7", fieldName: "width", fieldValue: w.toString() },
                { nodeId: "7", fieldName: "height", fieldValue: h.toString() }
            ];

            // If single reference is provided for qwen (though it's mostly T2I), we could map it if we knew the node
            // For now, qwen remains primarily a T2I backup as requested

            const taskId = await runWorkflow(this.workflowIdQwen, nodeInfoList, this.config);
            const resultUrl = await pollTask(taskId, this.config);
            if (resultUrl.endsWith('.zip')) return await this.extractImageFromZipUrl(resultUrl);
            return resultUrl;
        });
    }
}
