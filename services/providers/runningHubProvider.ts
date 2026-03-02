import { AspectRatio } from "../../types";
import { withRetry } from "../core";
import { ImageProvider } from "./base";
import { uploadFile, runWorkflow, pollTask } from "../runningHubService";
import JSZip from "jszip";
import { proxyRunningHubUrl } from "../../utils/urlUtils";

export class RunningHubProvider implements ImageProvider {
    // New NB2 Workflow: AI App 2027697385668874241
    private workflowIdNB2 = "2027697385668874241";
    private workflowIdQwen = "2007837815798763521";
    private workflowIdLegacy = "1967051468748546049";
    private config?: any;
    private currentEngine: string = 'runninghub';

    updateConfig(config: any) {
        this.config = config;
    }

    setEngine(engine: string) {
        this.currentEngine = engine;
    }

    private async urlToBlob(url: string): Promise<Blob> {
        let fetchUrl = proxyRunningHubUrl(url);
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
                    try {
                        const blob = await this.urlToBlob(url);
                        const uploaded = await uploadFile(blob, `ref_${Date.now()}.png`, this.config);
                        uploadedUrls.push(uploaded);
                    } catch (e) {
                        console.warn("Reference image upload failed", e);
                    }
                }
            }

            // Path 1: NB2 / z_image / runninghub logic
            if (this.currentEngine === 'nb2' || this.currentEngine === 'runninghub' || this.currentEngine === 'z_image') {
                let isCharacterJSON = false;
                let cleanJsonPrompt = prompt;

                try {
                    let parsed = JSON.parse(prompt);
                    if (parsed.Identity_Consistency_Protocol) isCharacterJSON = true;
                } catch (e) {
                    const jsonMatch = prompt.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        try {
                            const parsed = JSON.parse(jsonMatch[0]);
                            if (parsed.Identity_Consistency_Protocol) {
                                isCharacterJSON = true;
                                cleanJsonPrompt = jsonMatch[0];
                            }
                        } catch (innerE) { }
                    }
                }

                // Default NB2/z_image logic: Use Workflow 2027697385668874241
                console.log(`[NB2 Debug] Using Workflow ${this.workflowIdNB2} for engine: ${this.currentEngine}`);
                const nodeInfoList: any[] = [
                    { nodeId: "4", fieldName: "text", fieldValue: isCharacterJSON ? cleanJsonPrompt : prompt },
                    { nodeId: "9", fieldName: "aspectRatio", fieldValue: aspectRatio },
                    { nodeId: "9", fieldName: "resolution", fieldValue: "1k" }
                ];

                // Map Images to 1, 2, 3, 10
                const imageNodes = ["1", "2", "3", "10"];
                imageNodes.forEach((nodeId, index) => {
                    const value = uploadedUrls[index] || "";
                    nodeInfoList.push({
                        nodeId: nodeId,
                        fieldName: "image",
                        fieldValue: value
                    });
                });

                console.log("[NB2 Debug] nodeInfoList:", JSON.stringify(nodeInfoList, null, 2));

                const taskId = await runWorkflow(this.workflowIdNB2, nodeInfoList, this.config);
                const resultUrl = await pollTask(taskId, this.config, 600000);
                if (resultUrl.endsWith('.zip')) return await this.extractImageFromZipUrl(resultUrl);
                return resultUrl;
            }

            // Path 2: qwen2512 / runninghub
            const [w, h] = this.aspectRatioToPixels(aspectRatio);
            const nodeInfoList = [
                { nodeId: "5", fieldName: "text", fieldValue: prompt },
                { nodeId: "7", fieldName: "width", fieldValue: w.toString() },
                { nodeId: "7", fieldName: "height", fieldValue: h.toString() }
            ];
            const taskId = await runWorkflow(this.workflowIdQwen, nodeInfoList, this.config);
            const resultUrl = await pollTask(taskId, this.config);
            if (resultUrl.endsWith('.zip')) return await this.extractImageFromZipUrl(resultUrl);
            return resultUrl;
        });
    }
}
