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


/**
 * Global Style Constitution (全局风格宪法)
 * Enforces the global visual style preset as the highest priority marker for all prompts.
 */
export const applyStyleConstitution = (prompt: string, context: GlobalContext): string => {
    const stylePreset = context.visual_style_preset || "cinematic lighting, high quality";

    // The "Constitution" wrapper: Triple parentheses give maximum weight.
    // We emphasize that this is a VISUAL CONSTITUTION that must be obeyed.
    const styledPrompt = `(((Visual Style Constitution: ${stylePreset}))), ${prompt}, masterpiece, extremely detailed, cinematic, 8k resolution, professionally color graded.`;

    return styledPrompt;
};

export const refineShotPrompt = (item: StoryboardItem, characters: CharacterDNA[], inputEnv: EnvironmentDNA | undefined, scene: SceneDNA | undefined, context: GlobalContext): string => {
    const charDetails = characters.map(c => {
        let physicalDesc = "";
        let costumeDesc = "";
        try {
            const parsed = JSON.parse(c.consistency_seed_prompt);
            physicalDesc = parsed.Identity_Consistency_Protocol?.Target_Subject || "";
            costumeDesc = parsed.Identity_Consistency_Protocol?.Core_Elements ? ` wearing ${parsed.Identity_Consistency_Protocol.Core_Elements}` : "";
        } catch (e) {
            physicalDesc = c.description || "";
        }
        return `(Subject Character: ${c.name}, Identity: ${physicalDesc}${costumeDesc}, Identity_Lock: 100%)`;
    }).join(' AND ');

    const visualAnchor = scene?.visual_anchor_prompt || inputEnv?.visual_anchor_prompt || "";
    let sceneDesc = "";
    try {
        const parsed = JSON.parse(visualAnchor);
        sceneDesc = parsed.Identity_Consistency_Protocol?.Target_Subject || "";
    } catch (e) {
        sceneDesc = visualAnchor;
    }

    const lighting = scene?.core_lighting || inputEnv?.core_lighting || "";

    const coreContent = `SCENE CONTEXT: ${sceneDesc}. LIGHTING: ${lighting}. CHARACTERS: ${charDetails}. ACTION: ${item.action_description}. SHOT: ${item.shot_type} shot. CAMERA: ${item.camera_movement || 'static'}.`;

    return applyStyleConstitution(coreContent, context);
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
    const result = await provider.generateImage(prompt, {
        seed,
        aspect_ratio: aspectRatio,
        reference_image_url: refImages?.[0]
    });
    return result.preview_url;
};
