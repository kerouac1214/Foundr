import { SceneDNA, GlobalContext, EnvironmentDNA, CharacterDNA, AIEngine, StoryboardItem } from "../types";
import { withRetry } from "./core";

import { getScriptProvider } from "./providers";

export const forgeSceneDNA = async (draft: any, context: GlobalContext): Promise<SceneDNA> => {
    const provider = getScriptProvider(context.script_engine);
    return await provider.forgeSceneDNA(draft, context);
};

export const forgeEnvironmentDNA = async (storyText: string, context: GlobalContext): Promise<EnvironmentDNA> => {
    const provider = getScriptProvider(context.script_engine);
    const result = await provider.forgeSceneDNA({ name: 'Environment', description: storyText, scene_id: 'env' }, context);
    return result as unknown as EnvironmentDNA;
};

export const forgeCharacterDNA = async (draft: any, context: GlobalContext): Promise<CharacterDNA> => {
    const provider = getScriptProvider(context.script_engine);
    return await provider.forgeCharacterDNA(draft, context);
};

export const analyzeShotInsertion = async (description: string, context: GlobalContext, surroundingShots: StoryboardItem[]): Promise<StoryboardItem> => {
    const provider = getScriptProvider(context.script_engine);
    return await provider.analyzeShotInsertion(description, context, surroundingShots);
};

export const deriveShotsFromAnchor = async (anchorShot: StoryboardItem, script: string, context: GlobalContext): Promise<StoryboardItem[]> => {
    const provider = getScriptProvider(context.script_engine);
    return await provider.deriveShotsFromAnchor(anchorShot, script, context);
};

export const deriveNarrativeTrinity = async (
    anchorShot: StoryboardItem,
    script: string,
    context: GlobalContext,
    userPrompt?: string
): Promise<StoryboardItem[]> => {
    const provider = getScriptProvider(context.script_engine);
    return await provider.deriveNarrativeTrinity(anchorShot, script, context, userPrompt);
};

export const generateNarrativeGrid = async (anchorShot: StoryboardItem, script: string, context: GlobalContext): Promise<StoryboardItem[]> => {
    const provider = getScriptProvider(context.script_engine);
    return await provider.generateNarrativeGrid(anchorShot, script, context);
};
