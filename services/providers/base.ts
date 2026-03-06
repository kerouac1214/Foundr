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
    AIEngine,
    ImageEngine
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
    generateMovieNarrative(script: string, referenceImage: string): Promise<{
        breakdown: string;
        story_tone: string;
        approach: string;
        keyframes: any[];
        grid_image_url?: string;
        prompt_breakdown: string;
    }>;
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

    // Optional methods for providers that support direct image/video generation
    generateImage?(
        prompt: string,
        options: {
            seed?: number,
            aspect_ratio: AspectRatio,
            image_engine?: ImageEngine,
            reference_image_url?: string
        }
    ): Promise<{ preview_url: string }>;

    generateVideo?(
        prompt: string,
        options: {
            aspect_ratio: AspectRatio,
            video_engine?: string,
            source_image_url?: string
        }
    ): Promise<{ video_url: string }>;

    chat?(messages: any[], jsonMode?: boolean): Promise<string>;
}

export interface ImageProvider {
    updateConfig?(config: any): void;
    generateImage(
        prompt: string,
        options: {
            seed?: number,
            aspect_ratio: AspectRatio,
            image_engine?: ImageEngine,
            reference_image_url?: string
        }
    ): Promise<{ preview_url: string }>;
}

export interface VideoProvider {
    updateConfig?(config: any): void;
    generateVideo(
        prompt: string,
        options: {
            aspect_ratio: AspectRatio,
            video_engine?: string,
            source_image_url?: string
        }
    ): Promise<{ video_url: string }>;
}
