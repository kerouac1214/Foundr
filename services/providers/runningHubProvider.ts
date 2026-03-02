import { AspectRatio } from "../../types";
import { withRetry } from "../core";
import { ImageProvider } from "./base";
import { uploadFile, runWorkflow, pollTask, runNBProImage } from "../runningHubService";
import JSZip from "jszip";
import { proxyRunningHubUrl } from "../../utils/urlUtils";

export class RunningHubProvider implements ImageProvider {
    private workflowIdNB2 = "2027444678353752065";
    private workflowIdQwen = "2007837815798763521";
    private workflowIdLegacy = "1967051468748546049";
    private config?: any;
    private currentEngine: string = 'nb2';

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

            // Path 1: NB2 (Latest Provided Workflow)
            if (this.currentEngine === 'nb2') {
                const WORKFLOW_ID = this.workflowIdNB2;
                const nodeInfoList: any[] = [
                    { nodeId: "9", fieldName: "text", fieldValue: prompt || "" },
                    { nodeId: "1", fieldName: "aspectRatio", fieldValue: aspectRatio },
                    { nodeId: "1", fieldName: "resolution", fieldValue: "2k" }
                ];

                // Always send all 4 image nodes to clear previous values in the workflow
                const imageNodeIds = ["2", "3", "4", "10"];
                imageNodeIds.forEach((nodeId, index) => {
                    const value = uploadedUrls[index] || "";
                    nodeInfoList.push({
                        nodeId,
                        fieldName: "image",
                        fieldValue: value
                    });
                });

                console.log(`[NB2 Debug] Submitting Workflow ${WORKFLOW_ID} with nodes:`, JSON.stringify(nodeInfoList, null, 2));
                const taskId = await runWorkflow(WORKFLOW_ID, nodeInfoList, this.config);
                const resultUrl = await pollTask(taskId, this.config, 600000);
                if (resultUrl.endsWith('.zip')) return await this.extractImageFromZipUrl(resultUrl);
                return resultUrl;
            }

            // Path 2: Qwen (runninghub) or Z-Image
            const targetWorkflow = (this.currentEngine === 'z_image') ? this.workflowIdNB2 : this.workflowIdQwen;

            const [w, h] = this.aspectRatioToPixels(aspectRatio);
            const nodeInfoList = [
                { nodeId: "5", fieldName: "text", fieldValue: prompt },
                { nodeId: "7", fieldName: "width", fieldValue: w.toString() },
                { nodeId: "7", fieldName: "height", fieldValue: h.toString() }
            ];
            const taskId = await runWorkflow(targetWorkflow, nodeInfoList, this.config);
            return await pollTask(taskId, this.config);
        });
    }
}
