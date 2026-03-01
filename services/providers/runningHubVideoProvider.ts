import { AspectRatio } from "../../types";
import { withRetry } from "../core";
import { VideoProvider } from "./base";
import { uploadFile, runWorkflow, pollTask, runViduQ2Pro, runSeedance15 } from "../runningHubService";

export class RunningHubVideoProvider implements VideoProvider {
    private workflowIdWan2_2 = "2027632357276131329"; // Wan2.2

    private config?: any;
    private currentEngine: string = 'wan2_2';

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
        if (!resp.ok) throw new Error(`[Video] Failed to fetch image from ${url}`);
        return await resp.blob();
    }

    async generateVideo(prompt: string, aspectRatio: AspectRatio, sourceImageUrl?: string): Promise<string> {
        return await withRetry(async () => {
            let uploadedImageUrl = "";
            if (sourceImageUrl) {
                try {
                    const blob = await this.urlToBlob(sourceImageUrl);
                    uploadedImageUrl = await uploadFile(blob, `video_ref_${Date.now()}.png`, this.config);
                } catch (e) {
                    console.warn("Failed to upload source image for video generation, falling back to text-to-video if supported.", e);
                }
            }

            if (this.currentEngine === 'vidu_q2') {
                if (!uploadedImageUrl) throw new Error("Vidu Q2 Pro requires a source image to generate video.");
                console.log(`[VideoProvider] Submitting to RunningHub (Vidu Q2 Pro)...`);
                const taskId = await runViduQ2Pro({
                    prompt,
                    imageUrl: uploadedImageUrl
                }, this.config);
                return await pollTask(taskId, this.config, 500000);
            }

            if (this.currentEngine === 'seedance_1_5') {
                if (!uploadedImageUrl) throw new Error("Seedance 1.5 requires a source image to generate video.");
                console.log(`[VideoProvider] Submitting to RunningHub (Seedance 1.5)...`);
                const taskId = await runSeedance15({
                    prompt,
                    imageUrl: uploadedImageUrl
                }, this.config);
                return await pollTask(taskId, this.config, 500000);
            }

            // Workflow engines (e.g. Wan2.2)
            let targetWorkflow = this.workflowIdWan2_2;
            const nodeInfoList: any[] = [];

            if (this.currentEngine === 'wan2_2') {
                targetWorkflow = this.workflowIdWan2_2;
                nodeInfoList.push({ nodeId: "10", fieldName: "prompt", fieldValue: prompt });
                if (uploadedImageUrl) {
                    nodeInfoList.push({ nodeId: "4", fieldName: "image", fieldValue: uploadedImageUrl });
                }
            }

            console.log(`[VideoProvider] Submitting to RunningHub (${this.currentEngine}) with workflow ${targetWorkflow}...`);
            const taskId = await runWorkflow(targetWorkflow, nodeInfoList, this.config);
            const resultUrl = await pollTask(taskId, this.config, 500000); // Poll with 500s timeout

            return resultUrl;
        });
    }
}
