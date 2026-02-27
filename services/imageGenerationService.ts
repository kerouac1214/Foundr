import { AspectRatio, ImageEngine, StoryboardItem, CharacterDNA, EnvironmentDNA, SceneDNA, GlobalContext } from "../types";
import { withRetry, getAIClient } from "./core";
import JSZip from "jszip";

const RUNNINGHUB_API_KEY = process.env.RUNNINGHUB_API_KEY || "";
const PROXY_BASE_URL = process.env.VITE_API_BASE_URL || "https://rough-mode-92f3.kerouac1214.workers.dev";
const RUNNINGHUB_BASE_URL = `${PROXY_BASE_URL}/runninghub/external/server/v1/open`;

const urlToBlob = async (url: string): Promise<Blob> => {
    try {
        let fetchUrl = url;
        // Proxy RunningHub images through local dev server to avoid CORS
        if (url.includes('rh-images-1252422369.cos.ap-beijing.myqcloud.com')) {
            fetchUrl = url.replace('https://rh-images-1252422369.cos.ap-beijing.myqcloud.com', '/rh-images');
        }

        const resp = await fetch(fetchUrl);
        if (!resp.ok) throw new Error(`Failed to fetch image from ${url}`);
        return await resp.blob();
    } catch (e) {
        console.error("urlToBlob failed", e);
        throw e;
    }
};


export const refineShotPrompt = (item: StoryboardItem, characters: CharacterDNA[], inputEnv: EnvironmentDNA | undefined, scene: SceneDNA | undefined, context: GlobalContext): string => {
    const charDetails = characters.map(c =>
        `(Character: ${c.name}, VisualDNA: ${c.consistency_seed_prompt})`
    ).join(' AND ');

    const visualAnchor = scene?.visual_anchor_prompt || inputEnv?.visual_anchor_prompt || context.visual_style_preset;
    const lighting = scene?.core_lighting || inputEnv?.core_lighting || "cinematic lighting";

    const sceneAnchor = `((Scene Visual Anchor: ${visualAnchor}, Lighting: ${lighting}, Atmosphere: ${context.visual_style_preset}))`;
    return `${sceneAnchor}, ${charDetails}, ACTION: ${item.action_description}, SHOT: ${item.shot_type} shot, CAMERA: ${item.camera_movement}, masterpiece.`;
};

import { getImageProvider } from "./providers";

export const generateVisualPreview = async (
    engine: ImageEngine,
    prompt: string,
    seed: number,
    aspectRatio: AspectRatio,
    refImages?: string[]
): Promise<string> => {
    const provider = getImageProvider(engine);
    return await provider.generateImage(prompt, seed, aspectRatio, refImages);
};
