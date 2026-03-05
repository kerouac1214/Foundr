import { GeminiProvider } from "./geminiProvider";
import { RunningHubProvider } from "./runningHubProvider";
import { KimiProvider } from "./kimiProvider";
import { Glm5Provider } from "./glm5Provider";
import {
    ScriptProvider,
    ImageProvider,
    VideoProvider
} from "./base";
import {
    CharacterDNA,
    SceneDNA,
    StoryboardItem,
    GlobalContext,
    EnvironmentDNA,
    AIEngine
} from "../../types";
import { RunningHubVideoProvider } from "./runningHubVideoProvider";

export * from "./base";
export * from "./geminiProvider";
export * from "./runningHubProvider";
export * from "./kimiProvider";
export * from "./glm5Provider";
export * from "./runningHubVideoProvider";

const gemini = new GeminiProvider();
const runningHub = new RunningHubProvider();
const runningHubVideo = new RunningHubVideoProvider();
const kimi = new KimiProvider();
const glm5 = new Glm5Provider();

import { lafService } from "../laf";

/**
 * A provider that proxies chat requests to Laf Cloud Functions
 * but delegates other script-related tasks to the local provider.
 * This ensures API keys for chat are hidden while maintaining
 * full functionality for the rest of the script engine.
 */
class CloudScriptProvider implements ScriptProvider {
    private localProvider: ScriptProvider;
    private engine: string;
    private config: any = {};

    constructor(engine: string, localProvider: ScriptProvider) {
        this.engine = engine;
        this.localProvider = localProvider;

        // Monkey-patch the local provider's chat method to hit the proxy
        // This ensures that internal calls like partitionIntoChapters() 
        // also go through the cloud proxy.
        if (localProvider.chat) {
            localProvider.chat = (messages: any[], jsonMode: boolean = false) => this.chat(messages, jsonMode);
        }
    }

    updateConfig(config: any) {
        this.config = config;
        this.localProvider.updateConfig?.(config);
    }

    // Delegate all standard methods to the local provider
    partitionIntoChapters = (script: string) => this.localProvider.partitionIntoChapters(script);
    extractGlobalAssets = (script: string, context: GlobalContext) => this.localProvider.extractGlobalAssets(script, context);
    extractAssets = (script: string, context: GlobalContext, engine?: AIEngine) => this.localProvider.extractAssets(script, context, engine);
    analyzeShotInsertion = (description: string, context: GlobalContext, surroundingShots: StoryboardItem[]) => this.localProvider.analyzeShotInsertion(description, context, surroundingShots);
    deriveShotsFromAnchor = (anchorShot: StoryboardItem, script: string, context: GlobalContext) => this.localProvider.deriveShotsFromAnchor(anchorShot, script, context);
    deriveNarrativeTrinity = (anchorShot: StoryboardItem, script: string, context: GlobalContext, userPrompt?: string) => this.localProvider.deriveNarrativeTrinity(anchorShot, script, context, userPrompt);
    generateNarrativeGrid = (anchorShot: StoryboardItem, script: string, context: GlobalContext) => this.localProvider.generateNarrativeGrid(anchorShot, script, context);
    structureEpisodes = (script: string) => this.localProvider.structureEpisodes(script);
    generateStoryboard = (script: string, characters: any[], scenes: any[]) => this.localProvider.generateStoryboard(script, characters, scenes);
    forgeCharacterDNA = (draft: any, context: GlobalContext) => this.localProvider.forgeCharacterDNA(draft, context);
    forgeSceneDNA = (draft: any, context: GlobalContext) => this.localProvider.forgeSceneDNA(draft, context);
    refineAssetDNA = (name: string, description: string, type: 'character' | 'scene', context: GlobalContext, referenceImage?: string) => this.localProvider.refineAssetDNA(name, description, type, context, referenceImage);
    generateImagePrompt = (item: StoryboardItem, characters: CharacterDNA[], scene: SceneDNA | undefined, env: EnvironmentDNA | undefined, context: GlobalContext) => this.localProvider.generateImagePrompt(item, characters, scene, env, context);

    // Only proxy the chat method to Laf
    async chat(messages: any[], jsonMode: boolean = false): Promise<string> {
        const model = this.config.model_name;

        let targetEngine = this.engine;
        if (targetEngine === 'google') targetEngine = 'google';
        if (targetEngine === 'moonshot') targetEngine = 'kimi';
        if (targetEngine === 'glm5') targetEngine = 'glm';

        console.log(`[CloudScriptProvider] Proxying ${targetEngine} request via Laf (jsonMode: ${jsonMode})...`);
        return await lafService.chatProxy(targetEngine, messages, model, jsonMode);
    }
}

export const getScriptProvider = (engine: string = 'google'): ScriptProvider => {
    let localProvider: ScriptProvider;
    if (engine === 'kimi' || engine === 'moonshot') {
        localProvider = kimi;
    } else if (engine === 'glm5') {
        localProvider = glm5;
    } else {
        localProvider = gemini;
    }

    // Disabling cloud proxy to rollback to local dev
    // if (process.env.LAF_APP_ID) {
    //     return new CloudScriptProvider(engine, localProvider);
    // }

    return localProvider;
};

export const getImageProvider = (engine: string = 'nb2'): ImageProvider => {
    if (engine === 'nb2' || engine === 'qwen2512' || engine === 'runninghub' || engine === 'z_image') {
        runningHub.setEngine(engine);
        return runningHub;
    }
    return gemini;
};

export const getVideoProvider = (engine: string = 'wan2_2'): VideoProvider => {
    if (engine === 'wan2_2' || engine === 'vidu_q2' || engine === 'seedance_1_5' || engine === 'runninghub') {
        runningHubVideo.setEngine(engine);
        return runningHubVideo;
    }
    return gemini;
};

export const updateProviderConfigs = (configs: Record<string, any>) => {
    if (configs['google']) gemini.updateConfig(configs['google']);
    if (configs['runninghub']) {
        runningHub.updateConfig(configs['runninghub']);
        runningHubVideo.updateConfig(configs['runninghub']);
    }
    if (configs['kimi']) kimi.updateConfig(configs['kimi']);
    if (configs['glm5']) glm5.updateConfig(configs['glm5']);
};
