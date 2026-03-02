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
                    content: `你是一位顶级的剧集架构师。请将剧本切分为多个章节 (Chapters)。
                    ## 要求
                    1. 必须返回纯 JSON 格式。
                    2. 每个章节必须包含完整的剧本原文。
                    3. 结构：{ "chapters": [{ "id": "1", "title": "...", "summary": "...", "content": "..." }] }`
                },
                {
                    role: 'user',
                    content: `剧本原文：\n${script}\n\n请按章节切分并返回 JSON。`
                }
            ], true);
            const result = parseJSONRobust(content, { chapters: [] });
            const chapters = result.chapters || result.章节 || [];
            return chapters.map((c: any) => ({
                id: c.id || generateId(),
                title: c.title || c.标题 || "未命名章节",
                summary: c.summary || c.摘要 || c.简介 || "",
                content: c.content || c.内容 || "",
                episode_ids: []
            }));
        });
    }

    async extractGlobalAssets(script: string, context: GlobalContext): Promise<{ characters: any[], scenes: any[] }> {
        const stylePreset = context.visual_style_preset || "电影感";
        return await withRetry(async () => {
            const content = await this.request([
                {
                    role: 'system',
                    content: `## 【最高优先级：全局风格宪法 - VISUAL STYLE CONSTITUTION】
**本项目遵循以下视觉风格预设作为视觉基调：**
> ${stylePreset}
**你必须在设计资产时融合该风格，但重点应放在资产本身的物理特征细节上。**

---

## 【最高优先级语言规则 - MANDATORY LANGUAGE RULE】
**你必须严格遵守以下指示，不可违反：**
- 所有 \`name\` 和 \`description\` 字段内容**必须使用中文**。
- \`name\` 字段必须简洁，仅包含资产名称，不得包含任何描述。
- **所有 \`prompt\` 字段（\`consistency_seed_prompt\`, \`visual_anchor_prompt\`）必须输出为中文的提示词。**

---

你是一位顶级的制片人与美术指导。你的任务是通读全剧本，提取核心的角色与场景资产。
必须返回标准的 JSON 格式：
{
  "characters": [{ 
    "char_id": "c1", 
    "name": "姓名", 
    "description": "外貌、性格及关键特征的中文详细描述",
    "consistency_seed_prompt": "角色的详细中文提示词，专注物理身份与风格"
  }],
  "scenes": [{ 
    "scene_id": "s1", 
    "name": "场景名", 
    "description": "环境、氛围的中文详细描述", 
    "core_lighting": "光影设定的中文描述",
    "visual_anchor_prompt": "场景的详细中文提示词，专注建筑、光影与氛围"
  }]
}

请从以下长剧本中提取全局核心资产：\n\n${script}`
                }
            ], true);
            const result = parseJSONRobust(content, { characters: [], scenes: [] });

            const characters = (result.characters || result.角色 || result.Character_Assets || []).map((c: any) => {
                const char_id = c.char_id || c.id || generateId();
                return {
                    id: char_id,
                    char_id: char_id,
                    name: c.name || c.姓名 || "未知角色",
                    description: c.description || c.描述 || "",
                    consistency_seed_prompt: c.consistency_seed_prompt || c.提示词 || c.prompt || "",
                    physical_core: c.physical_core || { gender_age: "", facial_features: "", hair_style: "", distinguishing_marks: "" },
                    costume_id: c.costume_id || { top: "", bottom: "", accessories: "" },
                    seed: Math.floor(Math.random() * 1000000)
                };
            });

            const scenes = (result.scenes || result.场景 || result.Scene_Assets || []).map((s: any) => {
                const scene_id = s.scene_id || s.id || generateId();
                return {
                    id: scene_id,
                    scene_id: scene_id,
                    name: s.name || s.场景名 || "未知场景",
                    description: s.description || s.描述 || "",
                    visual_anchor_prompt: s.visual_anchor_prompt || s.提示词 || s.prompt || "",
                    narrative_importance: s.narrative_importance || 'Transition',
                    relevant_scene_ids: s.relevant_scene_ids || [],
                    core_lighting: s.core_lighting || "",
                    key_elements: s.key_elements || [],
                    seed: Math.floor(Math.random() * 1000000)
                };
            });

            return { characters, scenes };
        });
    }

    async extractAssets(script: string, context: GlobalContext): Promise<{ characters: any[]; scenes: any[] }> {
        return this.extractGlobalAssets(script, context);
    }

    async generateStoryboard(script: string, characters: any[], scenes: any[]): Promise<{ metadata: ProjectMetadata; initial_script: any[] }> {
        const charList = characters.map(c => `${c.name} (${c.id || c.char_id}): ${c.description || ''}`).join('\n');
        const sceneList = scenes.map(s => `${s.name} (${s.id || s.scene_id}): ${s.description || ''}`).join('\n');

        return await withRetry(async () => {
            const content = await this.request([
                {
                    role: 'system',
                    content: `## 【最高优先级语言规则 - MANDATORY LANGUAGE RULE】
**严格遵守以下规则，不可违反：**
- \`description\` 对象内所有字段（\`shot_type\`, \`camera_angle\`, \`camera_movement\`, \`lens_and_aperture\`, \`lighting\`, \`content\`, \`sound_design\`）**必须全部使用中文**。
- \`lyric_line\` 字段**必须使用中文**。
- \`ai_prompts.image_generation_prompt\` 和 \`ai_prompts.video_generation_prompt\` **必须使用中文**，描述流畅且具有电影感。

---

## 影视分镜与 AI 提示词系统 (Storyboard & AI Prompting System)

### 1. 核心角色 (Role)
你是一位顶级的电影分镜导演 (Storyboard Director) 和 AI 视频生成专家。你的任务是将剧本转化为工业级的分镜脚本，精确拆解视听语言，并为 AI 图像工具和 AI 视频模型分别提供极其精准的中文生成指令。

### 2. 交互逻辑 (Interaction Logic)
- **视听语言的精确性 (Cinematic Precision)**：明确景别（如：CU, MS, WS, POV）和机位角度。
- **动作离散化演算法**：任何具有叙事权重的动态瞬间严禁合并在单一分镜中。
- **提示词双轨制 (Dual-Prompting System)**：
    - **Image Prompt**：专注画面构图、人物泛化特征、光影、材质、相机参数。
    - **Video Prompt**：专注画面内物理元素的运动和镜头极其微小的推拉摇移。必须注入物理规律自动推演指令：包含流体动力学、重力与加速度、碰撞与形变、动力学一致性。

### 3. 输出格式
必须严格返回 JSON：
{
  "metadata": { "bpm": 120, "energy_level": "High", "overall_mood": "Tense" },
  "shots": [
    {
      "shot_number": 1,
      "characters": ["角色ID"],
      "scene": "场景ID",
      "description": {
        "shot_type": "景别",
        "camera_angle": "角度",
        "camera_movement": "运镜",
        "lens_and_aperture": "焦段与光圈",
        "lighting": "光影",
        "content": "内容",
        "sound_design": "音效"
      },
      "lyric_line": "台词",
      "ai_prompts": {
        "image_generation_prompt": "中文生图提示词",
        "video_generation_prompt": "中文视频提示词 (包含物理仿真指令)"
      },
      "script_content": "剧本详细内容原文",
      "image_description": "画面视觉描述",
      "dialogue": "角色台词 (若有)",
      "action_state": "角色当前动作状态详细描述",
      "narrative_function": "叙事功能",
      "time_coord": "时间坐标",
      "era_coord": "年代坐标",
      "date_coord": "日期坐标"
    }
  ]
}

## 强制视觉约束
严禁拼接、文字、水印。画面必须无边框。`
                },
                {
                    role: 'user',
                    content: `角色资产：\n${charList}\n\n场景资产：\n${sceneList}\n\n剧本：\n${script}\n\n请按分镜拆解并返回 JSON。`
                }
            ], true);
            const result = parseJSONRobust(content, { metadata: {}, shots: [] });

            const metadata: ProjectMetadata = {
                id: generateId(),
                bpm: result.metadata?.bpm || 120,
                energy_level: result.metadata?.energy_level || 'Medium',
                overall_mood: result.metadata?.overall_mood || 'Neutral',
                transitions: Array.isArray(result.metadata?.transitions) ? result.metadata.transitions : []
            };

            const shots = result.shots || result.分镜 || result.Storyboard_Items || [];
            const initial_script = shots.map((s: any) => {
                const imgPrompt = s.ai_prompts?.image_generation_prompt || s.提示词 || s.image_prompt || s.prompt || s.image_generation_prompt || "";
                const vidPrompt = s.ai_prompts?.video_generation_prompt || s.视频提示词 || s.video_prompt || s.video_generation_prompt || imgPrompt;

                return {
                    shot_number: s.shot_number || s.序号,
                    shot_type: s.shot_type || s.description?.shot_type || s.镜头类型 || "Medium Shot",
                    camera_angle: s.camera_angle || s.description?.camera_angle || s.拍摄角度 || "Eye Level",
                    camera_movement: s.camera_movement || s.description?.camera_movement || s.镜头运动 || "Static",
                    lens_and_aperture: s.lens_and_aperture || s.description?.lens_and_aperture || s.光圈焦段 || "35mm f/2.8",
                    lighting_vibe: s.lighting_vibe || s.description?.lighting || s.光影氛围 || "Natural",
                    action_description: s.action_description || s.description?.content || s.description?.action || s.画面描述 || "",
                    sound_design: s.sound_design || s.description?.sound_design || s.音效设计 || "",
                    lyric_line: s.lyric_line || s.台词 || "",
                    character_ids: s.characters || s.character_ids || [],
                    scene_id: s.scene || s.scene_id || "",
                    ai_prompts: {
                        image_generation_prompt: imgPrompt,
                        video_generation_prompt: vidPrompt
                    },
                    image_prompt: imgPrompt,
                    video_prompt: vidPrompt,
                    script_content: s.script_content || s.剧本内容 || "",
                    image_description: s.image_description || s.画面描述 || "",
                    dialogue: s.dialogue || s.台词 || s.lyric_line || "",
                    action_state: s.action_state || s.动作状态 || "",
                    narrative_function: s.narrative_function || s.叙事功能 || "",
                    time_coord: s.time_coord || s.时间坐标 || "",
                    era_coord: s.era_coord || s.年代坐标 || "",
                    date_coord: s.date_coord || s.日期坐标 || ""
                };
            });

            return { metadata, initial_script };
        });
    }

    async forgeCharacterDNA(draft: any, context: GlobalContext): Promise<CharacterDNA> {
        return await withRetry(async () => {
            const content = await this.request([
                {
                    role: 'system',
                    content: `你是一位顶级角色设计师。请生成角色的视觉 DNA。必须返回 JSON，包含 consistency_seed_prompt (复杂的 JSON 描述对象) 和 description (简短中文摘要)。`
                },
                {
                    role: 'user',
                    content: `生成角色 [${draft.name}] 的 DNA。描述：${draft.description}。视觉风格：${context.visual_style_preset}。
                    consistency_seed_prompt 必须是一个符合以下结构的 JSON 对象：
                    {
                      "Instruction_Role": "Master Character Designer",
                      "Identity_Consistency_Protocol": {
                        "Target_Subject": "[角色的详细中文描述，包含面部、发型、体态]",
                        "Core_Elements": "[来自上下文的特定表现细节]"
                      },
                      "Visual_Style_Module": {
                        "Style_Definition": "Hyper-realistic cinematic photography",
                        "Rendering_Specifics": "8k RAW photo, ultra-detailed textures, cinematic lighting"
                      },
                      "Master_Layout_Grid": {
                        "Canvas_Division": "Professional character reference sheet. Aspect ratio 16:9.",
                        "Left_Zone": "One prominent, high-fidelity full-body photo (主图全身照). Shot on 35mm lens, ARRI Alexa 65 aesthetic.",
                        "Top_Right_Zone": "3-view technical full-body orthographic drawings (全身照三视图: Front, Side, Back) for modeling reference.",
                        "Bottom_Right_Zone": "3-view face close-up technical drawings (面部特写三视图: Front, 45-degree, Profile) focusing on texture and facial details."
                      }
                    }`
                }
            ], true);
            const dna = parseJSONRobust(content, {});
            if (dna.consistency_seed_prompt && typeof dna.consistency_seed_prompt === 'object') {
                dna.consistency_seed_prompt = JSON.stringify(dna.consistency_seed_prompt, null, 2);
            }
            return {
                char_id: draft.char_id || draft.id || generateId(),
                name: draft.name,
                description: dna.description || draft.description,
                consistency_seed_prompt: dna.consistency_seed_prompt || draft.consistency_seed_prompt || '',
                is_anchored: true,
                physical_core: dna.physical_core || { gender_age: "", facial_features: "", hair_style: "", distinguishing_marks: "" },
                costume_id: dna.costume_id || { top: "", bottom: "", accessories: "" },
                seed: Math.floor(Math.random() * 1000000)
            };
        });
    }

    async forgeSceneDNA(draft: any, context: GlobalContext): Promise<SceneDNA> {
        return await withRetry(async () => {
            const content = await this.request([
                {
                    role: 'system',
                    content: `你是一位顶级美术指导。请生成场景的视觉 DNA。必须返回 JSON，包含 visual_anchor_prompt (复杂的 JSON 描述对象) 和 description (简短中文摘要)。`
                },
                {
                    role: 'user',
                    content: `生成场景 [${draft.name}] 的 DNA。描述：${draft.description}。视觉风格：${context.visual_style_preset}。
                    visual_anchor_prompt 必须是一个符合以下结构的 JSON 对象：
                    {
                      "Instruction_Role": "Master Environment Designer",
                      "Environment_Protocol": {
                        "Space_Description": "[场景的详细中文地理/建筑描述]",
                        "Atmosphere": "[光影、天气、氛围描述]"
                      },
                      "Visual_Style_Module": {
                        "Style_Definition": "Cinematic wide shot",
                        "Rendering_Specifics": "Panavision aesthetic, volumetric lighting"
                      }
                    }`
                }
            ], true);
            const dna = parseJSONRobust(content, {});
            if (dna.visual_anchor_prompt && typeof dna.visual_anchor_prompt === 'object') {
                dna.visual_anchor_prompt = JSON.stringify(dna.visual_anchor_prompt, null, 2);
            }
            return {
                scene_id: draft.scene_id || draft.id || generateId(),
                name: draft.name,
                description: draft.description || dna.description,
                visual_anchor_prompt: dna.visual_anchor_prompt || draft.visual_anchor_prompt || '',
                seed: Math.floor(Math.random() * 1000000),
                narrative_importance: 'Transition',
                relevant_scene_ids: [],
                core_lighting: dna.core_lighting || "",
                key_elements: dna.key_elements || []
            };
        });
    }

    async refineAssetDNA(name: string, description: string, type: 'character' | 'scene', context: GlobalContext, _referenceImage?: string): Promise<string> {
        return await withRetry(async () => {
            const systemPrompt = type === 'character'
                ? "你是一位顶级角色设计师。请根据已有的角色信息，编写一段极致详尽的、用于 AI 生图的中文视觉描述。"
                : "你是一位顶级美术指导。请根据已有的场景信息，编写一段极致详尽的、用于 AI 生图的中文视觉描述。";
            const content = await this.request([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `资产：${name}\n描述：${description}` }
            ]);
            return content;
        });
    }

    async generateImagePrompt(item: StoryboardItem, characters: any[], scene: any | undefined, _env: any | undefined, context: GlobalContext): Promise<string> {
        const charNames = characters.map(c => c.name).join(', ');
        return await withRetry(async () => {
            const content = await this.request([
                {
                    role: 'system',
                    content: `你是一位高级电影摄影师。请编写一段具有电影感的中文生图提示词。必须包含指定的景别 (${item.shot_type}) 和拍摄角度 (${item.camera_angle})。`
                },
                {
                    role: 'user',
                    content: `画面内容：${item.action_description}\n角色：${charNames}\n场景：${scene?.name || '默认'}\n视觉风格：${context.visual_style_preset}`
                }
            ]);
            return content;
        });
    }

    async analyzeShotInsertion(description: string, context: GlobalContext, _surroundingShots: StoryboardItem[]): Promise<StoryboardItem> {
        return await withRetry(async () => {
            const content = await this.request([
                {
                    role: 'system',
                    content: `你是一位电影导演。请根据描述生成一个分镜项 JSON。使用可用资产：\n角色：${context.characters.map(c => c.name).join(', ')}\n场景：${context.scenes.map(s => s.name).join(', ')}`
                },
                {
                    role: 'user',
                    content: `插入分镜描述：${description}`
                }
            ], true);
            const result = parseJSONRobust(content, { shot_type: 'MS', camera_angle: 'Eye Level', camera_movement: 'Static' });
            return {
                id: generateId(),
                shot_number: 0,
                timestamp: '00:00',
                duration: 3,
                shot_type: result.shot_type,
                camera_angle: result.camera_angle,
                camera_movement: result.camera_movement,
                action_description: result.action_description || description,
                character_ids: result.character_ids || [],
                scene_id: result.scene_id || '',
                image_prompt: result.image_prompt || '',
                seed: Math.floor(Math.random() * 1000000),
                lyric_line: '',
                render_status: 'idle',
                isLocked: false
            } as StoryboardItem;
        });
    }

    async deriveShotsFromAnchor(anchorShot: StoryboardItem, script: string, context: GlobalContext): Promise<StoryboardItem[]> {
        return await withRetry(async () => {
            const content = await this.request([
                {
                    role: 'system',
                    content: `你是一位导演。基于核心分镜，推演前后各 2 个关键瞬间。返回 JSON 数组，包含 4 个分镜项。`
                },
                {
                    role: 'user',
                    content: `核心分镜：${anchorShot.action_description}\n剧本上下文：${script.slice(0, 1000)}`
                }
            ], true);
            const results = parseJSONRobust(content, []);
            const shotsArray = Array.isArray(results) ? results : (results.results || results.shots || []);
            return shotsArray.map((res: any) => ({
                id: generateId(),
                shot_number: 0,
                timestamp: '00:00',
                duration: 3,
                shot_type: res.shot_type || 'MS',
                camera_angle: res.camera_angle || 'Eye Level',
                camera_movement: res.camera_movement || 'Static',
                action_description: res.action_description,
                character_ids: res.character_ids || anchorShot.character_ids || [],
                scene_id: res.scene_id || anchorShot.scene_id || '',
                image_prompt: res.image_prompt || '',
                seed: Math.floor(Math.random() * 1000000),
                lyric_line: '',
                render_status: 'idle',
                isLocked: false
            } as StoryboardItem));
        });
    }

    async deriveNarrativeTrinity(anchorShot: StoryboardItem, _script: string, _context: GlobalContext, userPrompt?: string): Promise<StoryboardItem[]> {
        // Simple implementation of three-act structure or related shots
        return await this.deriveShotsFromAnchor(anchorShot, userPrompt || "叙事三连推演", _context);
    }

    async generateNarrativeGrid(anchorShot: StoryboardItem, script: string, context: GlobalContext): Promise<StoryboardItem[]> {
        return await this.deriveShotsFromAnchor(anchorShot, script, context);
    }
}
