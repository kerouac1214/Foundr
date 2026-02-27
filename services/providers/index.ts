import { GeminiProvider } from "./geminiProvider";
import { RunningHubProvider } from "./runningHubProvider";
import { KimiProvider } from "./kimiProvider";
import { ScriptProvider, ImageProvider, VideoProvider } from "./base";

export * from "./base";
export * from "./geminiProvider";
export * from "./runningHubProvider";
export * from "./kimiProvider";

const gemini = new GeminiProvider();
const runningHub = new RunningHubProvider();
const kimi = new KimiProvider();

export const getScriptProvider = (engine: string = 'google'): ScriptProvider => {
    if (engine === 'kimi' || engine === 'moonshot') return kimi;
    return gemini;
};

export const getImageProvider = (engine: string = 'google'): ImageProvider => {
    if (engine === 'nb_pro' || engine === 'qwen2512' || engine === 'runninghub') {
        runningHub.setEngine(engine);
        return runningHub;
    }
    return gemini;
};

export const getVideoProvider = (engine: string = 'google'): VideoProvider => {
    return gemini;
};

export const updateProviderConfigs = (configs: Record<string, any>) => {
    if (configs['google']) gemini.updateConfig(configs['google']);
    if (configs['runninghub']) runningHub.updateConfig(configs['runninghub']);
    if (configs['kimi']) kimi.updateConfig(configs['kimi']);
};
