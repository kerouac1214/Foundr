import { Type } from "@google/genai";
import { SceneDNA, GlobalContext, EnvironmentDNA, CharacterDNA, AIEngine } from "../types";
import { withRetry, getAIClient } from "./core";

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
