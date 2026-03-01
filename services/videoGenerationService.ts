import { AspectRatio, AIEngine } from "../types";
import { withRetry, getAIClient } from "./core";

import { getVideoProvider } from "./providers";

export const generateVideoForShot = async (prompt: string, aspectRatio: AspectRatio, engine?: AIEngine, sourceImageUrl?: string): Promise<string> => {
    const provider = getVideoProvider(engine);
    return await provider.generateVideo(prompt, aspectRatio, sourceImageUrl);
};
