import {
    CharacterDNA,
    SceneDNA,
    StoryboardItem,
    GlobalContext,
    AspectRatio,
    ProjectMetadata,
    EnvironmentDNA,
    Episode,
    ProjectStatus,
    Chapter,
    AIEngine
} from "../../types";

export interface ScriptProvider {
    updateConfig?(config: any): void;
    // New Hierarchy Methods (Full Script Analysis)
    partitionIntoChapters(script: string): Promise<Chapter[]>;
    extractGlobalAssets(script: string, context: GlobalContext): Promise<{ characters: any[], scenes: any[] }>;

    extractAssets(script: string, context: GlobalContext, engine?: AIEngine): Promise<{ characters: any[], scenes: any[] }>;
    analyzeShotInsertion(description: string, context: GlobalContext, surroundingShots: StoryboardItem[]): Promise<StoryboardItem>;
    deriveShotsFromAnchor(anchorShot: StoryboardItem, script: string, context: GlobalContext): Promise<StoryboardItem[]>;
    deriveNarrativeTrinity(anchorShot: StoryboardItem, script: string, context: GlobalContext, userPrompt?: string): Promise<StoryboardItem[]>;
    generateNarrativeGrid(anchorShot: StoryboardItem, script: string, context: GlobalContext): Promise<StoryboardItem[]>;
    structureEpisodes(script: string): Promise<{ status: ProjectStatus, episodes: Episode[] }>;
    generateStoryboard(script: string, characters: any[], scenes: any[]): Promise<{ metadata: ProjectMetadata, initial_script: any[] }>;
    forgeCharacterDNA(draft: any, context: GlobalContext): Promise<CharacterDNA>;
    forgeSceneDNA(draft: any, context: GlobalContext): Promise<SceneDNA>;
    refineAssetDNA(name: string, description: string, type: 'character' | 'scene', context: GlobalContext, referenceImage?: string): Promise<string>;
    generateImagePrompt(
        item: StoryboardItem,
        characters: CharacterDNA[],
        scene: SceneDNA | undefined,
        env: EnvironmentDNA | undefined,
        context: GlobalContext
    ): Promise<string>;
    chat?(messages: any[]): Promise<string>;
}

export interface ImageProvider {
    updateConfig?(config: any): void;
    generateImage(
        prompt: string,
        seed: number,
        aspectRatio: AspectRatio,
        refImages?: string[]
    ): Promise<string>;
}

export interface VideoProvider {
    updateConfig?(config: any): void;
    generateVideo(
        prompt: string,
        aspectRatio: AspectRatio,
        sourceImageUrl?: string
    ): Promise<string>;
}
