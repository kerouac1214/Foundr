import { Type } from "@google/genai";
import { ProjectMetadata, StoryboardItem, CharacterDNA, SceneDNA, EnvironmentDNA, GlobalContext, AIEngine } from "../types";
import { withRetry, getAIClient } from "./core";

// Shared retry logic is now imported from ./core

import { getScriptProvider } from "./providers";

export const extractAssets = async (storyText: string, engine?: AIEngine): Promise<{ characters: any[]; scenes: any[] }> => {
    const provider = getScriptProvider(engine);
    return await provider.extractAssets(storyText);
};

export const generateStoryboard = async (storyText: string, characters: any[], scenes: any[], engine?: AIEngine): Promise<{ metadata: ProjectMetadata; initial_script: any[] }> => {
    const provider = getScriptProvider(engine);
    return await provider.generateStoryboard(storyText, characters, scenes);
};

export const generateImagePrompt = async (
    item: StoryboardItem,
    characters: CharacterDNA[],
    scene: SceneDNA | undefined,
    env: EnvironmentDNA | undefined,
    context: GlobalContext
): Promise<string> => {
    const provider = getScriptProvider(context.script_engine);
    return await provider.generateImagePrompt(item, characters, scene, env, context);
};
