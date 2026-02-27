import {
    CharacterDNA,
    SceneDNA,
    StoryboardItem,
    GlobalContext,
    AspectRatio,
    ProjectMetadata,
    EnvironmentDNA
} from "../../types";

export interface ScriptProvider {
    updateConfig?(config: any): void;
    extractAssets(script: string): Promise<{ characters: any[], scenes: any[] }>;
    generateStoryboard(script: string, characters: any[], scenes: any[]): Promise<{ metadata: ProjectMetadata, initial_script: any[] }>;
    forgeCharacterDNA(draft: any, context: GlobalContext): Promise<CharacterDNA>;
    forgeSceneDNA(draft: any, context: GlobalContext): Promise<SceneDNA>;
    generateImagePrompt(
        item: StoryboardItem,
        characters: CharacterDNA[],
        scene: SceneDNA | undefined,
        env: EnvironmentDNA | undefined,
        context: GlobalContext
    ): Promise<string>;
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
