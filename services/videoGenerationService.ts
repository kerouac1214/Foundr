import { AspectRatio, AIEngine } from "../types";
import { withRetry, getAIClient } from "./core";

import { getVideoProvider } from "./providers";

export const generateVideoForShot = async (prompt: string, aspectRatio: AspectRatio, engine?: AIEngine, sourceImageUrl?: string): Promise<string> => {
    const provider = getVideoProvider(engine);
    const result = await provider.generateVideo(prompt, {
        aspect_ratio: aspectRatio,
        source_image_url: sourceImageUrl
    });
    return result.video_url;
};
