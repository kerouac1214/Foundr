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
    private apiBase = "/glm/openapi/compatible-mode/v1";
    private apiKey = process.env.GLM_API_KEY || "";
    private enableThinking = false;

    updateConfig(config: any) {
        if (config.api_base) this.apiBase = config.api_base;
        if (config.api_key) this.apiKey = config.api_key;
        if (config.model_name) this.model = config.model_name;
        if (config.enable_thinking !== undefined) this.enableThinking = config.enable_thinking;
    }

    async chat(messages: any[], jsonMode: boolean = false): Promise<string> {
        const hasImage = messages.some(m =>
            Array.isArray(m.content) && m.content.some((c: any) => c.type === 'image_url')
        );
        if (hasImage) {
            console.log(`[Glm5Provider] Image detected in chat, using model: ${this.model}`);
        }
        return await this.request(messages, jsonMode);
    }

    private async request(messages: any[], jsonMode: boolean = false) {
        // If we have no API key and are likely in a browser environment without a proxy,
        // this call will fail. But CloudScriptProvider will normally intercept this 
        // if its chat() method is used by the internal provider.
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
            const errorText = await response.text();
            console.error(`[Glm5Provider] Request failed:`, errorText);
            throw new Error(`GLM-5 API Error: ${errorText}`);
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
            const content = await this.chat([
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
                    total_episodes: result.project_status?.total_episodes || result.项目状态?.总集数 || result.episodes?.length || 0,
                    division_mode: (result.project_status?.division_mode || result.项目状态?.划分模式) || 'Smart_120s_Cliffhanger'
                },
                episodes: (result.episodes || result.集数 || []).map((e: any) => ({
                    episode_number: e.episode_number || e.集数 || e.number || 0,
                    estimated_duration: e.estimated_duration || e.预计时长 || "",
                    boundaries: e.boundaries || e.边界 || { start_text_anchor: "", end_text_anchor: "" },
                    narrative_structure: e.narrative_structure || e.叙事结构 || { opening_scene: "", core_conflict: "", ending_cliffhanger: "" }
                }))
            };
        });
    }

    async partitionIntoChapters(script: string): Promise<Chapter[]> {
        return await withRetry(async () => {
            const content = await this.chat([
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
            const content = await this.chat([
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
- \`name\` 字段必须简洁，仅包含资产名称。
- **所有 \`prompt\` 字段（\`visual_anchor_prompt\`）必须输出为中文的提示词。**

---

你是一位顶级的制片人与美术指导。你的任务是通读全剧本，提取核心的角色与场景资产。
必须返回标准的 JSON 格式：
{
  "scenes": [{ 
    "scene_id": "s1", 
    "name": "场景名", 
    "description": "环境、氛围的中文详细描述", 
    "core_lighting": "光影设定的中文描述",
    "visual_anchor_prompt": "场景的详细中文提示词，专注建筑、光影与氛围"
  }],
  "characters": [
    {
      "Role_ID": "姓名_年龄阶段或版本 (如: Mark_Childhood)",
      "Narrative_Weight": "Level 1 (Core) / Level 2 (Supporting)",
      "Scene_Coverage": {
        "Total_Scenes": 0,
        "Scene_IDs": ["S01", "S02"]
      },
      "Core_Profile": {
        "Name": "角色中文名",
        "Age": "该阶段的具体年龄或年龄段 (如: 8岁)",
        "Gender": "生理性别",
        "Nationality_Ethnicity": "国籍或族裔背景",
        "Personality": "该阶段的性格关键词描述",
        "Occupation": "该阶段的职业或身份背景 (如: 小学生)",
        "Timeline": "该阶段所处的时代坐标 (e.g., 1998)"
      },
      "Visual_Reference": {
        "Outfit": "基于该阶段剧情的服装材质与款式详细描述",
        "Physical_Traits": "该年龄段的核心骨骼/面部/身体特征描述 (中性表情视角)"
      }
    }
  ]
}

### 角色提取附加规则（跨年龄/跨状态裂变提取）：
如果角色在剧中跨越了不同年龄或状态，必须独立提取。如：“Mark_Childhood”、“Mark_MiddleAge”。

请从以下长剧本中提取全局核心资产：\n\n${script}`
                }
            ], true);
            const result = parseJSONRobust(content, { characters: [], scenes: [] });

            const characters = (result.characters || result.角色 || result.Character_Analysis || []).map((c: any) => {
                const char_id = c.Role_ID || c.char_id || c.id || generateId();
                const name = c.Core_Profile?.Name || c.name || c.姓名 || "未知角色";

                const age = c.Core_Profile?.Age || c.age || '';
                const gender = c.Core_Profile?.Gender || c.gender || '';
                const ethnicity = c.Core_Profile?.Nationality_Ethnicity || '';
                const personality = c.Core_Profile?.Personality || c.personality || '';
                const outfit = c.Visual_Reference?.Outfit || c.outfit || '';
                const traits = c.Visual_Reference?.Physical_Traits || c.physical_traits || '';

                const description = c.description || c.描述 || `${age} ${gender}，${ethnicity}。${personality}。身穿${outfit}。特征：${traits}`;

                return {
                    id: char_id,
                    char_id: char_id,
                    name: name,
                    description: description,
                    consistency_seed_prompt: "",
                    physical_core: c.physical_core || { gender_age: age, facial_features: traits, hair_style: "", distinguishing_marks: "" },
                    costume_id: c.costume_id || { top: outfit, bottom: "", accessories: "" },
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
                    visual_anchor_prompt: typeof (s.visual_anchor_prompt || s.提示词 || s.prompt) === 'object'
                        ? JSON.stringify(s.visual_anchor_prompt || s.提示词 || s.prompt, null, 2)
                        : (s.visual_anchor_prompt || s.提示词 || s.prompt || ""),
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

    private normalizeShotType(val: string): string {
        if (!val) return "MS";
        const v = val.toLowerCase();
        if (v.includes("特写") || v.includes("cu") || v.includes("close up")) return "CU";
        if (v.includes("中景") || v.includes("ms") || v.includes("medium")) return "MS";
        if (v.includes("全景") || v.includes("ls") || v.includes("long shot") || v.includes("wide")) return "LS";
        if (v.includes("主观") || v.includes("pov")) return "POV";
        return val;
    }

    private normalizeCameraAngle(val: string): string {
        if (!val) return "Cinematic Eye-level";
        const v = val.toLowerCase();
        if (v.includes("平视") || v.includes("eye") || v.includes("standard")) return "Cinematic Eye-level";
        if (v.includes("低角度") || v.includes("仰拍") || v.includes("low")) return "Low Angle";
        if (v.includes("高角度") || v.includes("俯拍") || v.includes("high")) return "High Angle";
        if (v.includes("鸟瞰") || v.includes("bird")) return "Bird Eye View";
        if (v.includes("极端低") || v.includes("extreme low")) return "Extreme Low Angle";
        if (v.includes("荷兰") || v.includes("dutch")) return "Dutch Angle";
        return val;
    }

    async generateStoryboard(script: string, characters: any[], scenes: any[]): Promise<{ metadata: ProjectMetadata; initial_script: any[] }> {
        const charList = characters.map(c => `${c.name} (${c.id || c.char_id}): ${c.description || ''}`).join('\n');
        const sceneList = scenes.map(s => `${s.name} (${s.id || s.scene_id}): ${s.description || ''}`).join('\n');

        return await withRetry(async () => {
            const content = await this.chat([
                {
                    role: 'system',
                    content: `## 【最高优先级语言规则 - MANDATORY LANGUAGE RULE】
**严格遵守以下规则，不可违反：**
- \`description\` 对象内所有字段（\`shot_type\`, \`camera_angle\`, \`camera_movement\`, \`content\`）**必须全部使用中文**。
- \`lyric_line\` 字段**必须使用中文**。

---

## 影视分镜快速拆解系统 (Rapid Storyboard Breakdown System)

### 1. 核心任务
你是一位高效的电影执行导演。你的任务是快速将剧本转化为分镜脚本。为了保证生成速度，你只需要提取最核心的视觉与叙事要素。

### 2. 字段规范
必须严格返回 JSON：
{
  "metadata": { "bpm": 120, "energy_level": "High", "overall_mood": "Tense" },
  "shots": [
    {
      "shot_number": 1,
      "characters": ["角色ID"],
      "scene": "场景ID",
      "description": {
        "shot_type": "景别 (如: 全景, 特写, 中景)",
        "camera_angle": "机位角度 (如: 平视, 仰拍, 俯拍)",
        "camera_movement": "运镜 (如: 固定, 推, 拉, 摇, 移)",
        "content": "画面内容详细描述 (必须包含具体的动作、构图细节)"
      },
      "ai_prompts": {
        "image_generation_prompt": "基于该分镜画面的详细中文绘画提示词，包含光影、构图、角色神态与环境细节",
        "video_generation_prompt": "描述画面中动态变化的详细中文提示词，专注动作幅度与物理交互"
      },
      "lyric_line": "台词/对白原文",
      "script_content": "该分镜对应的剧本原文内容",
      "image_description": "画面的纯视觉描述",
      "dialogue": "角色对白",
      "action_state": "角色当前动作状态详细描述",
      "narrative_function": "该镜头的叙事功能或隐喻意义"
    }
  ]
}

## 强制约束
- \`characters\` 和 \`scene\` 必须引用提供的资产 ID。
- 必须为每一个镜头生成详细的 \`ai_prompts\`，这对于后续渲染至关重要。`
                },
                {
                    role: 'user',
                    content: `角色资产：\n${charList}\n\n场景资产：\n${sceneList}\n\n剧本：\n${script}\n\n请按核心分镜规则拆解并返回 JSON。`
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
                    shot_type: this.normalizeShotType(s.shot_type || s.description?.shot_type || s.镜头类型 || s.景别 || "MS"),
                    camera_angle: this.normalizeCameraAngle(s.camera_angle || s.description?.camera_angle || s.拍摄角度 || s.角度 || "Cinematic Eye-level"),
                    camera_movement: s.camera_movement || s.description?.camera_movement || s.镜头运动 || s.运镜 || "Static",
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
            const content = await this.chat([
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
            const content = await this.chat([
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
            const content = await this.chat([
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `资产：${name}\n描述：${description}` }
            ]);
            return content;
        });
    }

    async generateImagePrompt(item: StoryboardItem, characters: any[], scene: any | undefined, _env: any | undefined, context: GlobalContext): Promise<string> {
        // Filter characters actually present in this shot
        const shotChars = characters.filter(c => item.character_ids?.includes(c.char_id));

        const characterContext = shotChars.length > 0
            ? shotChars.map(c => {
                let dna = c.consistency_seed_prompt || c.description || "";
                // If it's JSON, we want to make sure the AI treats it as a protocol
                return `【角色: ${c.name}】\n视觉 DNA 协议:\n${dna}`;
            }).join('\n\n')
            : "无特定角色";

        const sceneContext = scene ? `【场景: ${scene.name}】\n视觉锚点:\n${scene.visual_anchor_prompt || scene.description || ""}` : "默认场景";

        return await withRetry(async () => {
            const content = await this.chat([
                {
                    role: 'system',
                    content: `你是一位顶级电影摄影师与 AI 提示词架构师。
你的任务是根据提供的“角色视觉 DNA 协议”和“场景视觉锚点”，编写一段中文生图提示词。

## 严格执行规则：
1. **身份一致性锁 (Identity Lock)**：必须严格遵循 DNA 中的面部、发型、服装和体态描述。如果 DNA 是 JSON 格式，请深度解析其中的 Identity_Consistency_Protocol。
2. **视觉宪法 (Visual Constitution)**：必须包含指定的景别 (${item.shot_type})、拍摄角度 (${item.camera_angle}) 和全局视觉风格 (${context.visual_style_preset})。
3. **物理仿真**：描述光影如何作用于 DNA 中定义的材质（如服装面料、皮肤质感）。
4. **禁止词**：严禁出现文字、水印、拼接感、多头、肢体畸形。

请直接输出这段用于生图的中文提示词。`
                },
                {
                    role: 'user',
                    content: `## 资产上下文
${characterContext}

${sceneContext}

## 画面动作描述
${item.action_description}

## 本镜头要求
景别：${item.shot_type}
角度：${item.camera_angle}
运镜：${item.camera_movement || '静态'}
`
                }
            ]);
            return content;
        });
    }

    async analyzeShotInsertion(description: string, context: GlobalContext, _surroundingShots: StoryboardItem[]): Promise<StoryboardItem> {
        return await withRetry(async () => {
            const content = await this.chat([
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
            const content = await this.chat([
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

    async generateMovieNarrative(script: string, referenceImage: string): Promise<any> {
        return await withRetry(async () => {
            const prompt = `<role>
You are an award-winning storyboard artist + narrative cinematographer.
Your job: turn a screenplay/script + one reference image into a coherent, continuous story sequence, then output a ready-to-use storyboard grid of key story frames.
</role>
<input>
1A script / screenplay text:
${script}

One reference image (for visual style, characters, environment, tone)
</input>
<non-negotiable rules - continuity & visual consistency>
First, analyze the reference image fully: identify ALL key subjects (person/group/vehicle/object/animal/props/environment elements) and describe spatial relationships, positions (left/right/foreground/background), facing direction, and actions.
Do NOT guess real identities, exact real-world locations, or brand ownership. Stick to visible facts. Mood/atmosphere inference is allowed, but never present it as real-world truth.
Strict visual continuity across ALL frames:
Same characters, same wardrobe/appearance/features
Same environment, architecture, props
Same time-of-day, lighting style, color grade
Only changes allowed: shot size, angle, framing, camera position, character blocking, facial expression, and action progress.
Depth of field must be realistic: deeper in wide shots, shallower in close‑ups with natural bokeh.
Maintain ONE consistent cinematic color grade across the entire storyboard.
Do NOT introduce new characters or major objects not present in the reference image. Tension or drama must come from performance, framing, lighting, or off-screen implication.
</non-negotiable rules - continuity & visual consistency>
<goal>
Translate the provided script into a visual story sequence that follows the plot beat by beat.
Output a clean, editor-friendly storyboard grid that can be directly used for animation, AI video generation, or film production.
</goal>
<step 1 - scene & script breakdown>
Output with clear subheadings:
Subjects: List each key character/object (A/B/C…), describe appearance, wardrobe, relative positions, facing direction, and actions based on the reference image and script.
Environment & Lighting: interior/exterior, spatial layout, background, materials, light direction & quality (hard/soft; key/fill/rim), implied time-of-day, 3–8 vibe/mood keywords.
Visual Anchors: 3–6 fixed visual elements that must stay consistent across all frames (palette, key prop, main light source, weather, texture, signature background).
Script Beats: Summarize the plot in 4–8 sequential story beats (setup → conflict → development → climax → resolution).
</step 1>
<step 2 - story & tone>
Theme: One clear sentence.
Story Summary: One short sentence that connects the script to the visual style.
Emotional Arc: 4 beats (setup → build → turn → payoff) matching the script.
</step 2>
<step 3 - visual storytelling approach>
Shot progression: How you shift shot sizes (wide → medium → close‑up) to follow story tension.
Camera logic: Angle choices (eye-level / low / high) and purpose for each story beat.
Lens & depth: Focal length range, depth of field style (shallow/medium/deep).
Color & light: Consistent palette, contrast level, material rendering, film grain (if applicable).
</step 3>
<step 4 - storyboard keyframes (primary output)>
Output a numbered Keyframe List (default 9–15 frames) that follows the script scene by scene, beat by beat.
Each frame continues the story logically in the same consistent world.
Use this exact format per frame:
[KF# | suggested screen time (sec) | shot type (ELS/LS/MLS/MS/MCU/CU/ECU/Low/High/Insert)]
Composition: subject placement, foreground/mid/background, framing
Story Action: what happens in this frame (matches the script)
Camera: height, angle, position
Lens/DoF: focal length, depth of field, focus point
Lighting & grade: consistent with reference
Sound (optional): atmosphere or foley to support the moment
Hard requirements:
Include at least:
1 establishing wide shot
1 character close-up
1 detail insert / extreme close-up
1 dramatic low or high angle shot
Maintain eyeline match, screen direction, and action continuity.
</step 4>
<step 5 - storyboard grid output (MUST OUTPUT ONE BIG GRID IMAGE)>
You MUST output ONE single, clean storyboard grid image that contains all keyframes in one unified layout.
Default grid: 3×3, 4×3, or 5×3 so every frame fits.
Each panel must be clearly labeled:
KF number + shot type + duration
Labels go in safe margins, never covering subjects.
All panels share:
Same characters, look, environment, lighting, color grade
Realistic depth of field
Photorealistic / cinematic texture matching the reference
After the grid image, list the full prompt breakdown for each keyframe in order so the user can re-render any frame in high quality.
</step 5>
<final output format>
Output in this order:
A) Scene & Script Breakdown
B) Story & Tone
C) Visual Storytelling Approach
D) Storyboard Keyframes (full list)
E) One Unified Storyboard Grid Image (all frames in one grid)
</final output format>。

Return the output as a JSON object:
{
  "breakdown": "Text for Step 1",
  "story_tone": "Text for Step 2",
  "approach": "Text for Step 3",
  "keyframes_text": "Text for Step 4",
  "prompt_breakdown": "Prompt breakdown for each keyframe",
  "image_gen_instruction": "A single optimized prompt for the image engine to generate the 9-grid image."
}`;

            const messages: any[] = [{
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    { type: 'image_url', image_url: { url: referenceImage } }
                ]
            }];

            const text = await this.chat(messages, true);
            const result = parseJSONRobust(text || '', {});

            return {
                breakdown: result.breakdown || "",
                story_tone: result.story_tone || "",
                approach: result.approach || "",
                keyframes: result.keyframes_text || "",
                grid_image_url: "",
                prompt_breakdown: result.prompt_breakdown || ""
            };
        });
    }

    async generateNarrativeGrid(anchorShot: StoryboardItem, script: string, context: GlobalContext): Promise<StoryboardItem[]> {
        return await this.deriveShotsFromAnchor(anchorShot, script, context);
    }
}
