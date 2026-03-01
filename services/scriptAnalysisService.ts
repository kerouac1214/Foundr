import { Type } from "@google/genai";
import { ProjectMetadata, StoryboardItem, CharacterDNA, SceneDNA, EnvironmentDNA, GlobalContext, AIEngine, Episode, ProjectStatus, Chapter } from "../types";
import { withRetry, getAIClient } from "./core";

// Shared retry logic is now imported from ./core

import { getScriptProvider } from "./providers";

export const extractAssets = async (storyText: string, context: GlobalContext, engine?: AIEngine): Promise<{ characters: any[]; scenes: any[] }> => {
    const provider = getScriptProvider(engine || context.script_engine);
    return await provider.extractAssets(storyText, context);
};

export const structureEpisodes = async (storyText: string, engine?: AIEngine): Promise<{ status: ProjectStatus, episodes: Episode[] }> => {
    const provider = getScriptProvider(engine);
    return await provider.structureEpisodes(storyText);
};

export const partitionIntoChapters = async (storyText: string, engine?: AIEngine): Promise<Chapter[]> => {
    const provider = getScriptProvider(engine);
    return await provider.partitionIntoChapters(storyText);
};

export const extractGlobalAssets = async (storyText: string, context: GlobalContext, engine?: AIEngine): Promise<{ characters: any[], scenes: any[] }> => {
    const provider = getScriptProvider(engine || context.script_engine);
    return await provider.extractGlobalAssets(storyText, context);
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

export const refineAssetDNA = async (
    name: string,
    description: string,
    type: 'character' | 'scene',
    context: GlobalContext,
    referenceImage?: string
): Promise<string> => {
    const provider = getScriptProvider(context.script_engine);
    return await provider.refineAssetDNA(name, description, type, context, referenceImage);
};
