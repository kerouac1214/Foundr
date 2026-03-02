import {
    CharacterDNA,
    SceneDNA,
    GlobalContext,
    ProjectMetadata,
    StoryboardItem,
    EnvironmentDNA,
    Episode,
    ProjectStatus,
    Chapter
} from "../../types";
import { withRetry, parseJSONRobust } from "../core";
import { ScriptProvider } from "./base";
import { generateId } from "../../utils";

export class Glm5Provider implements ScriptProvider {
    private model = "glm-5";
    private apiBase = "https://maas-api.ai-yuanjing.com/openapi/compatible-mode/v1";
    private apiKey = "sk-af4be68bfa884fe29cdfc988b6eb656f";
    private enableThinking = true;

    updateConfig(config: any) {
        if (config.api_base) this.apiBase = config.api_base;
        if (config.api_key) this.apiKey = config.api_key;
        if (config.model_name) this.model = config.model_name;
        if (config.enable_thinking !== undefined) this.enableThinking = config.enable_thinking;
    }

    private async request(messages: any[], jsonMode: boolean = false) {
        const response = await fetch(`${this.apiBase}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model,
                messages,
                temperature: 0.3,
                chat_template_kwargs: {
                    enable_thinking: this.enableThinking
                }
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`GLM-5 API Error: ${error}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;

        // GLM-5 might return thinking process or wrap JSON in markdown blocks
        if (jsonMode) {
            const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/```([\s\S]*?)```/);
            return jsonMatch ? jsonMatch[1] : content;
        }

        return content;
    }

    async structureEpisodes(script: string): Promise<{ status: ProjectStatus, episodes: Episode[] }> {
        return await withRetry(async () => {
            const content = await this.request([
                {
                    role: 'system',
                    content: `你是一位顶级的剧本统筹。请将剧本拆分为多个集数 (Episodes)。必须严格返回 JSON 格式。`
                },
                {
                    role: 'user',
                    content: `剧本原文：\n${script}\n\n请按集数拆分，并返回 JSON：{ "project_status": { "total_episodes": 0, "division_mode": "Smart_120s_Cliffhanger" }, "episodes": [] }`
                }
            ], true);
            const result = parseJSONRobust(content, { project_status: {}, episodes: [] });
            return {
                status: {
                    total_episodes: result.project_status?.total_episodes || 0,
                    division_mode: result.project_status?.division_mode || 'Smart_120s_Cliffhanger'
                },
                episodes: result.episodes || []
            };
        });
    }

    async partitionIntoChapters(script: string): Promise<Chapter[]> {
        return await withRetry(async () => {
            const content = await this.request([
                {
                    role: 'system',
                    content: `你是一位顶级的剧集架构师。请将长剧本切分为多个章节 (Chapters)。每个章节必须包含完整的剧本原文。`
                },
                {
                    role: 'user',
                    content: `剧本原文：\n${script}\n\n请切分为章节并返回 JSON：{ "chapters": [{ "id": "1", "title": "...", "summary": "...", "content": "..." }] }`
                }
            ], true);
            const result = parseJSONRobust(content, { chapters: [] });
            return (result.chapters || []).map((c: any) => ({ ...c, episode_ids: [] }));
        });
    }

    async extractGlobalAssets(script: string, context: GlobalContext): Promise<{ characters: any[], scenes: any[] }> {
        return await withRetry(async () => {
            const content = await this.request([
                {
                    role: 'system',
                    content: `你是一位顶级美术指导。请从剧本中提取核心角色与场景。所有返回字段必须使用中文。`
                },
                {
                    role: 'user',
                    content: `剧本：\n${script}\n\n提取资产并返回 JSON：{ "characters": [], "scenes": [] }`
                }
            ], true);
            return parseJSONRobust(content, { characters: [], scenes: [] });
        });
    }

    async extractAssets(script: string, context: GlobalContext): Promise<{ characters: any[]; scenes: any[] }> {
        // Reuse extraction logic for simplicity in GLM-5 initial implementation
        return this.extractGlobalAssets(script, context);
    }

    async generateStoryboard(script: string, characters: any[], scenes: any[]): Promise<{ metadata: ProjectMetadata; initial_script: any[] }> {
        return await withRetry(async () => {
            const charList = characters.map(c => c.name).join(', ');
            const sceneList = scenes.map(s => s.name).join(', ');

            const content = await this.request([
                {
                    role: 'system',
                    content: `你是一位顶级的电影分镜导演。请根据剧本生成工业级分镜脚本。`
                },
                {
                    role: 'user',
                    content: `剧本：\n${script}\n\n角色：${charList}\n场景：${sceneList}\n\n生成分镜并返回 JSON：{ "metadata": {}, "shots": [] }`
                }
            ], true);
            const result = parseJSONRobust(content, { metadata: {}, shots: [] });

            const metadata: ProjectMetadata = {
                id: '',
                bpm: result.metadata?.bpm || 120,
                energy_level: result.metadata?.energy_level || 'Medium',
                overall_mood: result.metadata?.overall_mood || 'Neutral',
                transitions: Array.isArray(result.metadata?.transitions) ? result.metadata.transitions : []
            };

            const initial_script = (result.shots || []).map((s: any) => ({
                shot_number: s.shot_number,
                shot_type: s.description?.shot_type,
                camera_angle: s.description?.camera_angle,
                camera_movement: s.description?.camera_movement,
                lens_and_aperture: s.description?.lens_and_aperture,
                lighting_vibe: s.description?.lighting,
                action_description: s.description?.content,
                sound_design: s.description?.sound_design,
                lyric_line: s.lyric_line,
                character_ids: s.characters || [],
                scene_id: s.scene,
                ai_prompts: s.ai_prompts
            }));

            return { metadata, initial_script };
        });
    }

    async forgeCharacterDNA(draft: any, context: GlobalContext): Promise<CharacterDNA> {
        return await withRetry(async () => {
            const content = await this.request([
                {
                    role: 'system',
                    content: `你是一位顶级角色设计师。请生成角色的视觉 DNA。`
                },
                {
                    role: 'user',
                    content: `生成角色 ${draft.name} 的 DNA。描述：${draft.description}。返回 JSON：{ "consistency_seed_prompt": "...", "description": "..." }`
                }
            ], true);
            const dna = parseJSONRobust(content, {});
            return {
                ...dna,
                char_id: draft.char_id,
                name: draft.name,
                description: dna.description || draft.description,
                is_anchored: true,
                seed: Math.floor(Math.random() * 1000000)
            };
        });
    }

    async forgeSceneDNA(draft: any, context: GlobalContext): Promise<SceneDNA> {
        return await withRetry(async () => {
            const content = await this.request([
                {
                    role: 'system',
                    content: `你是一位顶级场景设计师。请生成场景的视觉 DNA。`
                },
                {
                    role: 'user',
                    content: `生成场景 ${draft.name} 的 DNA。描述：${draft.description}。返回 JSON：{ "visual_anchor_prompt": "...", "description": "..." }`
                }
            ], true);
            const dna = parseJSONRobust(content, {});
            return {
                ...dna,
                scene_id: draft.scene_id,
                name: draft.name,
                description: draft.description || dna.description,
                seed: Math.floor(Math.random() * 1000000)
            };
        });
    }

    async refineAssetDNA(name: string, description: string, type: 'character' | 'scene', context: GlobalContext, referenceImage?: string): Promise<string> {
        return await withRetry(async () => {
            const content = await this.request([
                {
                    role: 'system',
                    content: `你是一位辅助 AI 提示词工程师。请优化资产描述。`
                },
                {
                    role: 'user',
                    content: `资产：${name}，描述：${description}，类型：${type}。返回优化的 JSON 字符串。`
                }
            ], true);
            return content;
        });
    }

    async generateImagePrompt(
        item: StoryboardItem,
        characters: any[],
        scene: any | undefined,
        env: any | undefined,
        context: GlobalContext
    ): Promise<string> {
        return await withRetry(async () => {
            const charNames = characters.map(c => c.name).join(', ');
            const content = await this.request([
                {
                    role: 'system',
                    content: `你是一位电影摄影师。请为 AI 生成中文图像提示词。`
                },
                {
                    role: 'user',
                    content: `场景内容：${item.action_description}。角色：${charNames}。场景：${scene?.name || '背景'}。输出电影剧照提示词（中文）。`
                }
            ]);
            return content;
        });
    }

    async analyzeShotInsertion(description: string, context: GlobalContext, surroundingShots: StoryboardItem[]): Promise<StoryboardItem> {
        throw new Error("Method not implemented.");
    }

    async deriveShotsFromAnchor(anchorShot: StoryboardItem, script: string, context: GlobalContext): Promise<StoryboardItem[]> {
        throw new Error("Method not implemented.");
    }

    async deriveNarrativeTrinity(anchorShot: StoryboardItem, script: string, context: GlobalContext, userPrompt?: string): Promise<StoryboardItem[]> {
        throw new Error("Method not implemented.");
    }

    async generateNarrativeGrid(anchorShot: StoryboardItem, script: string, context: GlobalContext): Promise<StoryboardItem[]> {
        throw new Error("Method not implemented.");
    }
}
