import { GeminiProvider } from "./geminiProvider";
import { RunningHubProvider } from "./runningHubProvider";
import { KimiProvider } from "./kimiProvider";
import { Glm5Provider } from "./glm5Provider";
import { ScriptProvider, ImageProvider, VideoProvider } from "./base";
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

export const getScriptProvider = (engine: string = 'google'): ScriptProvider => {
    if (engine === 'kimi' || engine === 'moonshot') return kimi;
    if (engine === 'glm5') return glm5;
    return gemini;
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
