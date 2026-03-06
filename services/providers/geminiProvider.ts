import { Type } from "@google/genai";
import {
    CharacterDNA,
    SceneDNA,
    GlobalContext,
    AspectRatio,
    ProjectMetadata,
    EnvironmentDNA,
    StoryboardItem,
    Episode,
    ProjectStatus,
    Chapter,
    ImageEngine
} from "../../types";
import { withRetry, getAIClient, parseJSONRobust } from "../core";
import { ScriptProvider, ImageProvider, VideoProvider } from "./base";
import { generateId } from "../../utils";

export class GeminiProvider implements ScriptProvider, ImageProvider, VideoProvider {
    private model = "gemini-3-flash-preview";
    private imageModel = "gemini-2.5-flash-image";
    private apiBase?: string;

    updateConfig(config: any) {
        if (config.api_base) this.apiBase = config.api_base;
        if (config.model_name) this.model = config.model_name;
    }

    async chat(messages: any[], jsonMode: boolean = false): Promise<string> {
        return await this.request(messages, jsonMode);
    }

    private async request(messages: any[], jsonMode: boolean = false): Promise<string> {
        const ai = this.getClient();
        const systemMessage = messages.find(m => m.role === 'system');
        const otherMessages = messages.filter(m => m.role !== 'system');

        // Convert messages to Gemini format
        const contents = await Promise.all(otherMessages.map(async (m) => {
            const parts: any[] = [];
            if (Array.isArray(m.content)) {
                for (const item of m.content) {
                    if (item.type === 'text') {
                        parts.push({ text: item.text });
                    } else if (item.type === 'image_url') {
                        const { data, mimeType } = await this.urlToBlob(item.image_url.url);
                        parts.push({ inlineData: { data, mimeType } });
                    }
                }
            } else {
                parts.push({ text: m.content });
            }
            return {
                role: m.role === 'user' ? 'user' : 'model',
                parts
            };
        }));

        const response = await ai.models.generateContent({
            model: this.model,
            contents,
            config: {
                systemInstruction: systemMessage?.content || '',
                responseMimeType: jsonMode ? "application/json" : undefined
            }
        });

        return response.text || '';
    }

    private async urlToBlob(url: string): Promise<{ data: string, mimeType: string }> {
        let fetchUrl = url;
        // Proxy RunningHub images through local dev server to avoid CORS
        if (url.includes('rh-images-1252422369.cos.ap-beijing.myqcloud.com')) {
            fetchUrl = url.replace('https://rh-images-1252422369.cos.ap-beijing.myqcloud.com', '/rh-images');
        }

        const resp = await fetch(fetchUrl);
        if (!resp.ok) throw new Error(`Failed to fetch image from ${url}`);
        const blob = await resp.blob();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64data = (reader.result as string).split(',')[1];
                resolve({
                    data: base64data,
                    mimeType: blob.type
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    private getClient() {
        return getAIClient(this.apiBase);
    }

    async structureEpisodes(script: string): Promise<{ status: ProjectStatus, episodes: Episode[] }> {
        return await withRetry(async () => {
            const text = await this.chat([
                {
                    role: 'user',
                    content: `## 角色设定 (Role)
你是一位好莱坞级别的剧集统筹 (Showrunner) 和剧本编审 (Script Editor)。你的任务是接收长篇剧本文本，并将其合理、精准地拆分为多个独立的集数（Episodes），为后续的工业化分镜拆解提供结构框架。

## 核心分集法则 (Episodic Division Rules)
1. 优先法则：尊重原著 (Explicit Markers)
如果用户上传的剧本中包含明确的分集标识（如：“第一集”、“第二集”、“EP1”、“Episode 2”等），必须绝对服从原剧本的物理分割，不得擅自合并或拆分。

2. 智能法则：120秒悬念切割 (Smart 120s Cliffhanger Cut)
如果剧本为连续长文本，无明确分集标识，请启动“智能分集模式”。
- 时长估算：每集的目标屏幕时长约为 120秒（在剧本中通常对应约 40-60 个分镜，或约 500-800 字的中等密度动作/台词描述）。
- 剧情优先 (Narrative First)：时长仅为参考线。切分点绝对不能落在平淡的过渡戏中。必须寻找目标时长附近的以下三个“黄金切分点”：
  - 悬念钩子 (Cliffhanger)：揭示了一个惊人秘密、角色面临突发生死危机、或门外传来了不可弥散的敲门声。
  - 情绪高潮 (Emotional Climax)：角色爆发强烈的冲突，或做出了不可挽回的决定。
  - 视觉奇观/反转 (Visual Twist)：如剧本中某处画面突然崩塌、机械鸟坠落等强烈反差时刻。

## 提取与总结要求 (Summary Requirements)
- 为切分出的每一集提取“起幅（开场）”和“落幅（结尾钩子）”的剧情描述。
- 明确标注每一集的核心戏剧冲突，以便后续分镜导演把握该集的整体节奏。

## 目标剧本 (Target Script)
"""
${script}
"""

## 输出要求 (Output)
必须严格返回标准 JSON 格式。`
                }
            ], true);

            const result = parseJSONRobust(text || '', { project_status: {}, episodes: [] });
            return {
                status: {
                    total_episodes: result.project_status?.total_episodes || result.项目状态?.总集数 || result.episodes?.length || 0,
                    division_mode: (result.project_status?.division_mode || result.项目状态?.划分模式) === 'Original_Script_Markers' ? 'Original_Script_Markers' : 'Smart_120s_Cliffhanger'
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
            const text = await this.chat([
                {
                    role: 'system',
                    content: `你是一位顶级的漫剧编剧与架构师。你的任务是将长篇内容（如小说、长篇剧本）切分为具备独立叙事弧线的章节。
                    每个章节必须包含：id, title, summary, content。`
                },
                { role: 'user', content: `请将以下长剧本切分为章节：\n\n${script}` }
            ], true);
            const result = parseJSONRobust(text || '', { chapters: [] });
            const chapters = result.chapters || result.章节 || [];
            return chapters.map((c: any) => ({ ...c, episode_ids: [] }));
        });
    }

    async extractGlobalAssets(script: string, context: GlobalContext): Promise<{ characters: any[], scenes: any[] }> {
        const stylePreset = context.visual_style_preset || "电影感";
        return await withRetry(async () => {
            const text = await this.chat([
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
- **所有 \`prompt\` 字段必须输出为中文的提示词。**

---

你是一位顶级的制片人与美术指导。你的任务是通读全剧本，提取出在全剧中反复出现、具有核心地位的角色与场景资产，以确保全剧制作的一致性。`
                },
                { role: 'user', content: `请从以下长剧本中提取全局核心角色与关键场景：\n\n${script}` }
            ], true);
            const result = parseJSONRobust(text || '', { characters: [], scenes: [] });
            return {
                characters: result.characters || result.Character_Analysis || [],
                scenes: result.scenes || result.Scene_Assets || []
            };
        });
    }

    async extractAssets(script: string, context: GlobalContext): Promise<{ characters: any[]; scenes: any[] }> {
        const stylePreset = context.visual_style_preset || "电影感";
        return await withRetry(async () => {
            const text = await this.chat([
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
- \`name\` 字段必须简洁，仅包含角色/场景名称。
- **所有 \`prompt\` 字段必须输出为中文的提示词。**

---

## 影视资产解析系统 (Asset Parsing System)

### 1. 核心角色 (Role)
你是一位顶尖的**场景美术指导 (Production Designer)** 和**角色设计师 (Character Concept Artist)**。你的任务是分析剧本，提取所有具备视觉构建价值的“角色资产”与“场景资产”。

### 2. 场景提取与去重规则 (Scene Asset Rules)
- **资产化命名 (Asset-Based Naming)**：不仅是地点，还需包含显式的内外景 (INT/EXT) 及时间属性 (Time of Day)。
  - 格式：\`INT/EXT_地点名称_时间段\` (例如：\`INT_MARK_LIVING_ROOM_MIDNIGHT\`)
- **空间分级 (Spatial Hierarchy)**：标注为 Hero (核心场景) 或 Transition (过渡场景)。
- **物理去重**：物理地点相同但陈设/影调发生剧变的，需作为不同资产提取。

### 3. 场景描述维度 (Description Dimensions)
- **Architecture & Style (建筑与风格)**：如“英式写实主义”、“维多利亚风格”。
- **Lighting Logic (光影逻辑)**：基于剧本的时间点，提供色温描述 (如：3000K 暖光 vs 6500K 冷蓝光)。
- **Hero Props (核心道具)**：对剧情有推动作用的关键物品。
- **Sensory Atmosphere (氛围感)**：空间的湿度、整洁度、叙事氛围 (如：诡异的完美、压抑的温馨)。

### 4. 角色解析规则 (Character Asset Rules)
- **名字优先原则**：自动锁定所有具备独立命名的角色。
- **跨年龄/跨状态裂变提取 (Age & State Fission)**：当同一个角色跨越了不同的人生阶段或经历了导致外貌/气质发生根本性改变的重大剧变时，必须将该角色裂变为多个完全独立的视觉角色进行提取。

### 5. 目标剧本 (Target Script)
"""
${script}
"""

### 6. 输出格式 (JSON)
必须严格返回 JSON，包含 "characters" 和 "scenes" 数组：
{
  "scenes": [
    {
      "asset_id": "INT/EXT_地点名称_时间段",
      "importance": "Hero / Transition",
      "scene_ids": ["S01", "S03"],
      "name": "场景中文名称",
      "architecture": "空间布局与装修风格描述",
      "lighting": "光影基调与主色调描述",
      "key_props": ["道具1", "道具2"],
      "atmosphere": "叙事氛围描述",
      "visual_anchor_prompt": "场景的详细中文提示词，专注建筑、光影与氛围"
    }
  ],
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

### 7. 语言规则
- 所有层级的描述及 Name 使用中文。
- **重要 (CRITICAL)**: \`Nationality_Ethnicity\` 必须明确指出角色的人种/国籍（如：Chinese, Asian, Caucasian, etc.）以确保后续 AI 生成图像的一致性。`
                }
            ], true);

            const result = parseJSONRobust(text || '', { characters: [], scenes: [] });

            // Map Scene Assets back to SceneDNA structure
            const mappedScenes = (result.scenes || []).map((s: any) => ({
                scene_id: s.asset_id || s.scene_id,
                name: s.name,
                description: `风格：${s.architecture}\n氛围：${s.atmosphere}`,
                narrative_importance: s.importance || 'Hero',
                relevant_scene_ids: s.scene_ids || [],
                core_lighting: s.lighting,
                key_elements: s.key_props || [],
                visual_anchor_prompt: typeof s.visual_anchor_prompt === 'object'
                    ? JSON.stringify(s.visual_anchor_prompt, null, 2)
                    : (s.visual_anchor_prompt || ''),
                seed: Math.floor(Math.random() * 1000000)
            }));

            const characters = (result.characters || result.Character_Analysis || []).map((c: any) => {
                const char_id = c.Role_ID || c.char_id;
                const name = c.Core_Profile?.Name || c.name;
                const age = c.Core_Profile?.Age || c.age || '';
                const gender = c.Core_Profile?.Gender || c.gender || '';
                const ethnicity = c.Core_Profile?.Nationality_Ethnicity || '';
                const personality = c.Core_Profile?.Personality || c.personality || '';
                const outfit = c.Visual_Reference?.Outfit || c.outfit || '';
                const traits = c.Visual_Reference?.Physical_Traits || c.physical_traits || '';

                const description = c.description || `${age} ${gender}，${ethnicity}。${personality}。身穿${outfit}。特征：${traits}`;

                return {
                    char_id: char_id,
                    name: name,
                    description: description,
                    consistency_seed_prompt: '',
                    physical_core: { gender_age: age, facial_features: traits, hair_style: "", distinguishing_marks: "" },
                    costume_id: { top: outfit, bottom: "", accessories: "" },
                    seed: Math.floor(Math.random() * 1000000)
                };
            });

            return { characters: characters, scenes: mappedScenes };
        });
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
        const charContext = characters.map(c => `${c.char_id}(Name: ${c.name}, Description: ${c.description})`).join(', ');
        const sceneContext = scenes.map(s => `${s.scene_id}(Name: ${s.name}, Description: ${s.description}, Lighting: ${s.core_lighting})`).join(', ');

        return await withRetry(async () => {
            const text = await this.chat([
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
                    content: `角色资产：\n${charContext}\n\n场景资产：\n${sceneContext}\n\n剧本：\n${script}\n\n请按核心分镜规则拆解并返回 JSON。`
                }
            ], true);

            const result = parseJSONRobust(text || '', { metadata: {}, shots: [] });

            const metadata: ProjectMetadata = {
                id: '',
                bpm: result.metadata?.bpm || result.元数据?.bpm || 120,
                energy_level: result.metadata?.energy_level || result.元数据?.能量等级 || 'Medium',
                overall_mood: result.metadata?.overall_mood || result.元数据?.整体氛围 || 'Neutral',
                transitions: Array.isArray(result.metadata?.transitions || result.元数据?.转场) ? (result.metadata?.transitions || result.元数据?.转场) : []
            };

            const shots = result.shots || result.分镜 || result.镜号 || result.Storyboard_Items || [];
            const initial_script = shots.map((s: any) => {
                const imgPrompt = s.ai_prompts?.image_generation_prompt || s.提示词 || s.image_prompt || s.prompt || s.image_generation_prompt || "";
                const vidPrompt = s.ai_prompts?.video_generation_prompt || s.视频提示词 || s.video_prompt || s.video_generation_prompt || imgPrompt;

                return {
                    shot_number: s.shot_number || s.序号 || 0,
                    shot_type: this.normalizeShotType(s.shot_type || s.description?.shot_type || s.镜头类型 || s.景别 || "MS"),
                    camera_angle: this.normalizeCameraAngle(s.camera_angle || s.description?.camera_angle || s.拍摄角度 || s.角度 || "Cinematic Eye-level"),
                    camera_movement: s.camera_movement || s.description?.camera_movement || s.镜头运动 || s.运镜 || "Static",
                    lens_and_aperture: s.lens_and_aperture || s.description?.lens_and_aperture || s.光圈焦段 || s.焦段 || "35mm f/2.8",
                    lighting_vibe: s.lighting_vibe || s.description?.lighting || s.光影氛围 || s.光影 || "Natural",
                    action_description: s.action_description || s.description?.content || s.description?.action || s.画面内容描述 || s.画面描述 || "",
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
                    image_description: s.image_description || s.画面视觉描述 || s.画面描述 || "",
                    dialogue: s.dialogue || s.台词 || "",
                    action_state: s.action_state || s.角色当前动作状态详细描述 || s.动作状态 || "",
                    narrative_function: s.narrative_function || s.该镜头的叙事功能或隐喻意义 || s.叙事功能 || ""
                };
            });

            return { metadata, initial_script };
        });
    }

    async forgeCharacterDNA(draft: any, context: GlobalContext): Promise<CharacterDNA> {
        return await withRetry(async () => {
            const prompt = `Generate a professional character design prompt based on the following template.
      Target Character Name: [${draft.name}]
      Context: ${draft.description}
      Artistic Style Style: [${context.visual_style_preset}]
      
      ${draft.reference_image_url ? 'A reference image is provided. YOU MUST analyze the image and describe the character\'s hair, facial features, and EXACT costume (top, bottom, accessories) in the "Target_Subject" and "Core_Elements" fields.' : ''}

      The consistency_seed_prompt MUST follow this EXACT modular structure(filling in the brackets):
            {
              "Instruction_Role": "Master Character Designer & Lead Cinematographer",
              "Reference_Fidelity_Protocol": {
                "Image_Input_Analysis": "If a reference image is uploaded, strictly extract and replicate the following: facial bone structure, skin micro-textures, hair flow, and the specific lighting temperature (e.g., 3000K amber).",
                "Scene_Alignment": "Environment generation must inherit the architectural style and color palette from the reference image to ensure spatial continuity.",
                "Identity_Consistency_Override": "Mandatory 100% adherence to the uploaded subject’s identity. All visual outputs must serve as a direct extension of the provided reference."
              },
              "Identity_Consistency_Protocol": {
                "Target_Subject": "[角色的详细中文描述。包含人种、发型、面部特征以及参考图中可见的视觉细节。]",
                "Identity_Lock": "ATL (Actual-to-Life) 物理一致性。角色面部特征与参考图保持 100% 严苛一致。",
                "Core_Elements": "[来自参考图及上下文的特定服装细节、颜色、材质和道具（中文）]"
              },
              "Master_Layout_Grid": {
                "Canvas_Division": "Professional character reference sheet. Aspect ratio 16:9.",
                "Left_Zone": "One prominent, high-fidelity portrait or master shot. Shot on 35mm lens, ARRI Alexa 65 aesthetic.",
                "Top_Right_Zone": "3-view technical orthographic drawings (Front, Side, Back) for modeling reference.",
                "Bottom_Right_Zone": "Asset Detail Cluster: 3 close-up shots focusing on texture, lighting, and neutral facial details."
              },
              "Visual_Style_Module": {
                "Style_Definition": "Hyper-realistic cinematic photography, Live-action film still, 8k RAW photo, ATL (Actual-to-Life) logic.",
                "Rendering_Specifics": "16:9 aspect ratio, 4k, ultra-detailed skin textures, natural subsurface scattering, soft cinematic lighting.",
                "Background": "Solid neutral grey studio background, zero environmental interference."
              },
              "Technical_Override": {
                "Keywords": "ATL, realistic, photorealistic, ultra-high fidelity, 8k UHD, film grain, realistic fabric micro-textures.",
                "Negative_Prompt": "anime, cartoon, 3d render, CGI, stylized, plastic, doll-like, inconsistent with reference image, messy composition."
              }
            }

      Return a JSON object with:
            1. consistency_seed_prompt: The filled -in JSON string above.
      2. physical_core: { gender_age, facial_features, hair_style, distinguishing_marks } extracted from text/image.
      3. costume_id: { top, bottom, accessories } extracted from text/image.
      4. description: Brief Chinese summary of the character's look.`;

            const messages: any[] = [
                { role: 'user', content: prompt }
            ];

            if (draft.reference_image_url) {
                messages[0].content = [
                    { type: 'text', text: prompt },
                    { type: 'image_url', image_url: { url: draft.reference_image_url } }
                ];
            }

            const text = await this.chat(messages, true);
            const dna = parseJSONRobust(text || '', {});

            // Ensure consistency_seed_prompt is a string even if the model returns an object
            if (dna.consistency_seed_prompt && typeof dna.consistency_seed_prompt === 'object') {
                dna.consistency_seed_prompt = JSON.stringify(dna.consistency_seed_prompt, null, 2);
            }

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
            const prompt = `Generate a professional environment concept design prompt based on this template.
      Scene Name: [${draft.name}]
      Description: ${draft.description}
      Style Preset: [${context.visual_style_preset}]
      
      The visual_anchor_prompt MUST follow this EXACT modular structure (filling in the brackets):
      {
        "Instruction_Role": "Master Character Designer & Lead Cinematographer",
        "Reference_Fidelity_Protocol": {
          "Image_Input_Analysis": "If a reference image is uploaded, strictly extract and replicate the following: facial bone structure, skin micro-textures, hair flow, and the specific lighting temperature (e.g., 3000K amber).",
          "Scene_Alignment": "Environment generation must inherit the architectural style and color palette from the reference image to ensure spatial continuity.",
          "Identity_Consistency_Override": "Mandatory 100% adherence to the uploaded subject’s identity. All visual outputs must serve as a direct extension of the provided reference."
        },
        "Identity_Consistency_Protocol": {
          "Target_Subject": "[场景 ${draft.name} 的准确物理描述（中文）。包含光影和建筑细节。]",
          "Identity_Lock": "ATL (Actual-to-Life) 物理一致性。建筑特征与参考图完全一致。",
          "Core_Elements": "[环境中的核心视觉元素（中文）]"
        },
        "Master_Layout_Grid": {
          "Canvas_Division": "Professional scene reference sheet. Aspect ratio 16:9.",
          "Left_Zone": "One prominent, high-fidelity master shot. Shot on 35mm lens, ARRI Alexa 65 aesthetic.",
          "Top_Right_Zone": "Technical layout blueprint / schematic for spatial reference.",
          "Bottom_Right_Zone": "Asset Detail Cluster: 3 close-up shots focusing on texture, lighting, and key props."
        },
        "Visual_Style_Module": {
          "Style_Definition": "Hyper-realistic cinematic photography, Live-action film still, 8k RAW photo, ATL (Actual-to-Life) logic.",
          "Rendering_Specifics": "16:9 aspect ratio, 4k, ultra-detailed textures, natural subsurface scattering, soft cinematic lighting.",
          "Background": "Solid neutral dark grey background, zero environmental interference."
        },
        "Technical_Override": {
          "Keywords": "ATL, realistic, photorealistic, ultra-high fidelity, 8k UHD, film grain, realistic textures.",
          "Negative_Prompt": "anime, cartoon, 3d render, CGI, stylized, plastic, doll-like, inconsistent with reference image, messy composition."
        }
      }

      Return a JSON with:
      1. visual_anchor_prompt: The filled-in JSON string above.
      2. core_lighting: Chinese description of lighting.
      3. key_elements: Array of strings.
      4. description: Evocative atmospheric summary in Chinese.`;

            const messages: any[] = [
                { role: 'user', content: prompt }
            ];

            if (draft.reference_image_url) {
                messages[0].content = [
                    { type: 'text', text: prompt },
                    { type: 'image_url', image_url: { url: draft.reference_image_url } }
                ];
            }

            const text = await this.chat(messages, true);
            const dna = parseJSONRobust(text || '', {});

            // Ensure visual_anchor_prompt is a string
            if (dna.visual_anchor_prompt && typeof dna.visual_anchor_prompt === 'object') {
                dna.visual_anchor_prompt = JSON.stringify(dna.visual_anchor_prompt, null, 2);
            }

            return {
                ...dna,
                scene_id: draft.scene_id,
                name: draft.name,
                description: draft.description,
                seed: Math.floor(Math.random() * 1000000)
            };
        });
    }

    async refineAssetDNA(name: string, description: string, type: 'character' | 'scene', context: GlobalContext, referenceImage?: string): Promise<string> {
        return await withRetry(async () => {
            const template = type === 'character' ? {
                "Instruction_Role": "Master Character Designer & Lead Cinematographer",
                "Reference_Fidelity_Protocol": {
                    "Image_Input_Analysis": "If a reference image is uploaded, strictly extract and replicate the following: facial bone structure, skin micro-textures, hair flow, and the specific lighting temperature (e.g., 3000K amber).",
                    "Scene_Alignment": "Environment generation must inherit the architectural style and color palette from the reference image to ensure spatial continuity.",
                    "Identity_Consistency_Override": "Mandatory 100% adherence to the uploaded subject’s identity. All visual outputs must serve as a direct extension of the provided reference."
                },
                "Identity_Consistency_Protocol": {
                    "Target_Subject": "[角色的详细体态与特征描述（中文）。明确人种/民族、面部特征及参考图中可见的服装细节。]",
                    "Identity_Lock": "ATL (Actual-to-Life) consistency. No deviation in facial features or costume textures.",
                    "Core_Elements": "[Specific clothing items, colors, and props from the image and context]"
                },
                "Master_Layout_Grid": {
                    "Canvas_Division": "Professional character reference sheet. Aspect ratio 16:9.",
                    "Left_Zone": "One prominent, high-fidelity portrait or master shot. Shot on 35mm lens, ARRI Alexa 65 aesthetic.",
                    "Top_Right_Zone": "3-view technical orthographic drawings (Front, Side, Back) for modeling reference.",
                    "Bottom_Right_Zone": "Asset Detail Cluster: 3 close-up shots focusing on texture, lighting, and neutral facial details."
                },
                "Visual_Style_Module": {
                    "Style_Definition": "Hyper-realistic cinematic photography, Live-action film still, 8k RAW photo, ATL (Actual-to-Life) logic.",
                    "Rendering_Specifics": "16:9 aspect ratio, 4k, ultra-detailed textures, natural subsurface scattering, soft cinematic lighting.",
                    "Background": "Solid neutral grey studio background, zero environmental interference."
                },
                "Technical_Override": {
                    "Keywords": "ATL, realistic, photorealistic, ultra-high fidelity, 8k UHD, film grain, realistic textures.",
                    "Negative_Prompt": "anime, cartoon, 3d render, CGI, stylized, plastic, doll-like, inconsistent with reference image, messy composition."
                }
            } : {
                "Instruction_Role": "Master Character Designer & Lead Cinematographer",
                "Reference_Fidelity_Protocol": {
                    "Image_Input_Analysis": "Analyze the reference image and replicate the lighting, material textures, and architectural style.",
                    "Scene_Alignment": "Environment generation must inherit the architectural style and color palette from the reference image to ensure spatial continuity.",
                    "Identity_Consistency_Override": "Mandatory 100% adherence to the uploaded subject’s identity."
                },
                "Identity_Consistency_Protocol": {
                    "Target_Subject": "[场景的详细物理描述（中文）。包含光影和建筑细节。]",
                    "Identity_Lock": "ATL (Actual-to-Life) 物理一致性。",
                    "Core_Elements": "[来自参考图和上下文的核心环境元素（中文）]"
                },
                "Master_Layout_Grid": {
                    "Canvas_Division": "Professional scene reference sheet. Aspect ratio 16:9.",
                    "Left_Zone": "One prominent, high-fidelity master shot.",
                    "Top_Right_Zone": "Technical layout blueprint / schematic.",
                    "Bottom_Right_Zone": "Asset Detail Cluster: 3 close-up shots focusing on texture, lighting, and key props."
                },
                "Visual_Style_Module": {
                    "Style_Definition": "Hyper-realistic cinematic photography, ATL logic.",
                    "Rendering_Specifics": "16:9 aspect ratio, 4k, ultra-detailed textures.",
                    "Background": "Solid neutral dark grey background."
                },
                "Technical_Override": {
                    "Keywords": "ATL, realistic, photorealistic, 8k UHD.",
                    "Negative_Prompt": "anime, cartoon, stylized, plastic."
                }
            };

            const prompt = `You are an AI prompt engineer specializing in high-fidelity Visual DNA.
                Your goal is to refine the provided [Description] into a professional JSON prompt structure.
                ${referenceImage ? 'A reference image is provided. YOU MUST analyze visual details (clothing, facial features, lighting, textures) from this image and incorporate them.' : ''}
                
                Asset Name: ${name}
                New Description: ${description}
                Type: ${type}
                ${referenceImage ? `Reference Image URL: ${referenceImage}` : ''}
                
                Refine this into the following JSON structure. Fill in the bracketed parts with Chinese descriptions.
                ${JSON.stringify(template, null, 2)}
                
                IMPORTANT: Return ONLY valid JSON representing the fully filled-in structure.`;

            const messages: any[] = [
                { role: 'user', content: prompt }
            ];

            if (referenceImage) {
                messages[0].content = [
                    { type: 'text', text: prompt },
                    { type: 'image_url', image_url: { url: referenceImage } }
                ];
            }

            const text = await this.chat(messages, true);
            const result = parseJSONRobust(text || '', {});
            return typeof result === 'object' ? JSON.stringify(result, null, 2) : (text || '');
        });
    }

    async generateImage(
        prompt: string,
        options: {
            seed?: number,
            aspect_ratio: AspectRatio,
            image_engine?: ImageEngine,
            reference_image_url?: string
        }
    ): Promise<{ preview_url: string }> {
        const ai = this.getClient();
        return await withRetry(async () => {
            const response = await ai.models.generateContent({
                model: this.imageModel,
                contents: {
                    parts: [
                        { text: `${prompt}${options.seed ? ` --seed ${options.seed}` : ''}` },
                        ...(options.reference_image_url ? [{
                            inlineData: {
                                data: options.reference_image_url.split(',')[1] || options.reference_image_url,
                                mimeType: 'image/png' // Assuming PNG or base64
                            }
                        }] : [])
                    ]
                },
                config: { imageConfig: { aspectRatio: options.aspect_ratio } }
            });
            const part = response.candidates?.[0]?.content.parts.find(p => p.inlineData);
            if (part?.inlineData) return { preview_url: `data:image/png;base64,${part.inlineData.data}` };
            throw new Error("Gemini Image Engine failed to produce data.");
        }, 5, 5000);
    }

    async generateVideo(
        prompt: string,
        options: {
            aspect_ratio: AspectRatio,
            video_engine?: string,
            source_image_url?: string
        }
    ): Promise<{ video_url: string }> {
        const ai = this.getClient();
        return await withRetry(async () => {
            let operation = await ai.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                prompt: `Cinematic: ${prompt}`,
                config: {
                    numberOfVideos: 1,
                    resolution: '720p',
                    aspectRatio: options.aspect_ratio === '16:9' ? '16:9' : '9:16'
                }
            });

            while (!operation.done) {
                await new Promise(resolve => setTimeout(resolve, 10000));
                operation = await ai.operations.getVideosOperation({ operation: operation });
            }

            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (!downloadLink) throw new Error("Failed to get video URI");

            const proxyUrl = downloadLink.replace('https://generativelanguage.googleapis.com', 'https://rough-mode-92f3.kerouac1214.workers.dev/google');
            const videoResp = await fetch(`${proxyUrl}&key=${process.env.API_KEY}`);
            if (!videoResp.ok) throw new Error(`Video download failed: ${videoResp.statusText}`);

            const blob = await videoResp.blob();
            return { video_url: URL.createObjectURL(blob) };
        });
    }

    async generateImagePrompt(
        item: StoryboardItem,
        characters: any[],
        scene: any | undefined,
        env: any | undefined,
        context: GlobalContext
    ): Promise<string> {
        let imageIndex = 1;

        const charsInShot = characters.filter(c => item.character_ids && item.character_ids.includes(c.char_id));
        const charDesc = charsInShot.length > 0
            ? charsInShot.map((c) => {
                let physicalDesc = c.description || "";
                let costumeDesc = "";
                try {
                    const parsed = JSON.parse(c.consistency_seed_prompt);
                    physicalDesc = parsed.Identity_Consistency_Protocol?.Target_Subject || c.description;
                    costumeDesc = parsed.Identity_Consistency_Protocol?.Core_Elements ? `(Costume: ${parsed.Identity_Consistency_Protocol.Core_Elements})` : "";
                } catch (e) { }

                let imageRef = "";
                if (c.preview_url) {
                    imageRef = `[Reference: Image ${imageIndex++}]`;
                }

                return `- Character ${c.name} ${imageRef}: ${physicalDesc} ${costumeDesc}`;
            }).join('\n')
            : "No specific characters.";

        let scenePhysicalDesc = scene?.description || "";
        let sceneElements = "";
        if (scene && scene.visual_anchor_prompt) {
            try {
                const parsed = JSON.parse(scene.visual_anchor_prompt);
                scenePhysicalDesc = parsed.Identity_Consistency_Protocol?.Target_Subject || scene.description;
                sceneElements = parsed.Identity_Consistency_Protocol?.Core_Elements ? `(Elements: ${parsed.Identity_Consistency_Protocol.Core_Elements})` : "";
            } catch (e) { }
        }

        let sceneImageRef = "";
        if (scene?.preview_url) {
            sceneImageRef = `[Reference: Image ${imageIndex++}]`;
        }

        const sceneDesc = scene ?
            `Scene: ${scene.name} ${sceneImageRef}. Theme: ${scenePhysicalDesc}. ${sceneElements}` :
            `Environment: ${env?.visual_anchor_prompt || 'Generic Background'}.`;

        return await withRetry(async () => {
            const prompt = `You are a High-End Cinema Prompt Engineer.
Create a structured, high-fidelity film still prompt based on these layers:

1. **SUBJECT & ACTION**: ${item.action_description}
2. **CHARACTER/SCENE DESCRIPTIONS**:
CHARACTERS IN SHOT:
${charDesc}

SETTING:
${sceneDesc}

3. **CINEMATOGRAPHY & LIGHTING**:
- Shot Type: ${item.shot_type}
- Camera Movement: ${item.camera_movement || 'Static'}
- Angle: ${item.camera_angle || 'Cinematic Eye-level'}
- Lighting: ${item.lighting_vibe || 'Natural soft light'}
- Composition: ${item.composition || 'Rule of thirds'}
4. **ARTISTIC STYLE**: ${context.visual_style_preset}

Requirements:
- Write a continuous Chinese prompt describing the cinematic action.
- **强制视觉约束 (Mandatory Constraints)**：严禁使用任何形式的拼接图、多面板、九宫格、分屏或对比图。画面必须是无边框的，不能有画框或留白边缘。图像中绝对不能包含任何文字、字母、排版、标志、水印或海报元素（绿色的二进制代码必须作为视觉粒子特效融入画面，而不能作为排版文字覆盖在图片上）。
- CRITICAL IDENTITY LOCK: You MUST explicitly start your prompt by stating that the subjects are from the provided reference images.
  Example: "参考图1中的角色（穿着参考图中的标志性服装）和参考图2中的角色正在参考图3的场景中互动。"
- COSTUME CONSISTENCY: Pay extreme attention to the (Costume: ...) details and ensure they are mentioned as being preserved from the reference image.
- SPATIAL RELATIONSHIP: Based on the plot's ACTION, explicitly define the exact positional layout of the characters (e.g., "参考图1的角色站在画面左侧，面向坐在右侧的参考图2角色")。
- **CINEMATOGRAPHY RECENTERING**: You MUST explicitly incorporate the specified **Shot Type** (${item.shot_type}) and **Angle** (${item.camera_angle || 'Cinematic Eye-level'}) into the Chinese description (e.g., "这是一个典型的[景别]镜头，采用[角度]拍摄...").
- After establishing the layout and image references, continue seamlessly describing their action, expressions, the weather, lighting, and framing based on the parameters above using descriptive Chinese.
- Output ONLY the final prompt string.`;

            const messages: any[] = [
                { role: 'user', content: prompt }
            ];

            // Add reference images if they exist
            if (scene?.preview_url || charsInShot.some(c => c.preview_url)) {
                const parts: any[] = [{ type: 'text', text: prompt }];
                if (scene?.preview_url) {
                    parts.push({ type: 'image_url', image_url: { url: scene.preview_url } });
                }
                charsInShot.filter(c => c.preview_url).forEach(c => {
                    parts.push({ type: 'image_url', image_url: { url: c.preview_url } });
                });
                messages[0].content = parts;
            }

            return await this.chat(messages);
        });
    }

    async analyzeShotInsertion(description: string, context: GlobalContext, _surroundingShots: StoryboardItem[]): Promise<StoryboardItem> {
        const stylePreset = context.visual_style_preset || "电影感";
        const charactersList = context.characters.map(c => `- ${c.name} (ID: ${c.char_id}): ${c.description || '无描述'}`).join('\n');
        const scenesList = context.scenes.map(s => `- ${s.name} (ID: ${s.scene_id}): ${s.description || '无描述'}`).join('\n');

        return await withRetry(async () => {
            const text = await this.chat([
                {
                    role: 'system',
                    content: `## 【最高优先级：全局风格宪法 - VISUAL STYLE CONSTITUTION】
本项目遵循以下视觉风格预设作为视觉基调：
> ${stylePreset}
你必须在生成分镜描述和提示词时完全融合该风格。

---

## 任务说明 (Task)
你是一位顶级的分镜导演。用户希望在现有的分镜序列中插入一个新分镜。你需要根据用户的自然语言描述，结合现有的角色和场景资产，生成一个完整的分镜脚本项。

## 可用资产 (Available Assets)
### 角色 (Characters):
${charactersList || '暂无全局角色资产'}

### 场景 (Scenes):
${scenesList || '暂无全局场景资产'}

## 输出要求 (Output)
必须返回标准的 JSON 格式：
{
  "shot_type": "特写/中景/全景等 (使用缩写如 WS/MS/CU/ECU)",
  "camera_angle": "平视/仰视/俯视等",
  "camera_movement": "推/拉/摇/移/固定等",
  "composition": "过肩镜头/正反打/主观镜头/低角度/高角度/景深镜头/浅景深/标准构图",
  "action_description": "中文详细画面动作描述",
  "image_prompt": "中文 Stable Diffusion 提示词，融合风格、角色特征和场景元素",
  "character_ids": ["角色ID列表"],
  "scene_id": "场景ID"
}

请确保：
1. 从可用资产中匹配最合适的 character_ids 和 scene_id。如果描述中没有提到特定资产，请根据上下文推断或保持为空。
2. image_prompt 必须使用自然、流畅的中文，包含环境、光影、人物体态和风格宪法。`
                },
                { role: 'user', content: `插入分镜描述: ${description}` }
            ], true);

            const result = parseJSONRobust(text || '', {
                shot_type: 'MS',
                camera_angle: 'Eye Level',
                camera_movement: 'Static',
                composition: 'Standard',
                action_description: description,
                image_prompt: '',
                character_ids: [],
                scene_id: ''
            });

            return {
                id: generateId(),
                shot_number: 0,
                timestamp: '00:00',
                duration: 3,
                shot_type: result.shot_type,
                camera_angle: result.camera_angle,
                camera_movement: result.camera_movement,
                composition: result.composition || 'Standard',
                action_description: result.action_description,
                character_ids: result.character_ids || [],
                scene_id: result.scene_id || '',
                image_prompt: result.image_prompt,
                seed: Math.floor(Math.random() * 1000000),
                lyric_line: '',
                render_status: 'idle',
                isLocked: false
            } as StoryboardItem;
        });
    }

    async deriveShotsFromAnchor(anchorShot: StoryboardItem, script: string, context: GlobalContext): Promise<StoryboardItem[]> {
        const stylePreset = context.visual_style_preset || "电影感";
        const charactersList = context.characters.map(c => `- ${c.name} (ID: ${c.char_id}): ${c.description || '无描述'}`).join('\n');
        const scenesList = context.scenes.map(s => `- ${s.name} (ID: ${s.scene_id}): ${s.description || '无描述'}`).join('\n');

        return await withRetry(async () => {
            const text = await this.chat([
                {
                    role: 'system',
                    content: `## 【最高优先级：全局风格宪法 - VISUAL STYLE CONSTITUTION】
本项目遵循以下视觉风格预设作为视觉基调：
> ${stylePreset}
你必须在生成分镜推导时完全融合该风格。

---

## 任务说明 (Task)
你是一位顶级的电影导演和剧本分析师。用户已经生成了一个核心分镜（种子镜头），你需要基于这个镜头的内容、角色的状态、以及整个故事的大纲，逻辑推演出该镜头**之前**最关键的 2 个瞬间和**之后**最关键的 2 个瞬间。

## 视觉种子 (Seed Shot)
- 画面描述: ${anchorShot.action_description}
- 镜头类型: ${anchorShot.shot_type}
- 场景ID: ${anchorShot.scene_id}
- 角色IDs: ${anchorShot.character_ids?.join(', ') || '无'}

## 故事背景 (Full Script Context)
${script.slice(0, 2000)}${script.length > 2000 ? '...' : ''}

## 可用资产 (Available Assets)
### 角色 (Characters):
${charactersList}

### 场景 (Scenes):
${scenesList}

## 输出要求 (Output)
必须返回一个包含 4 个分镜项的数组，顺序为 [前一镜头2, 前一镜头1, 后一镜头1, 后一镜头2]。

请确保推导出的镜头在叙事上与“视觉种子”紧密衔接，补完动作的起因、过程或结果。`
                }
            ], true);

            const results = parseJSONRobust(text || '', []);
            if (!Array.isArray(results)) return [];

            return results.map((res: any) => ({
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
                image_prompt: res.image_prompt,
                seed: Math.floor(Math.random() * 1000000),
                lyric_line: '',
                render_status: 'idle',
                isLocked: false
            } as StoryboardItem));
        });
    }

    async deriveNarrativeTrinity(anchorShot: StoryboardItem, script: string, context: GlobalContext, userPrompt?: string): Promise<StoryboardItem[]> {
        const stylePreset = context.visual_style_preset || "电影感";
        const charactersList = context.characters.map(c => `- ${c.name} (ID: ${c.char_id}): ${c.description || '无描述'}`).join('\n');
        const scenesList = context.scenes.map(s => `- ${s.name} (ID: ${s.scene_id}): ${s.description || '无描述'}`).join('\n');

        const derivationInstruction = userPrompt
            ? `## 【导演指令：最高优先级 - DIRECTOR'S DIRECTIVE】\n本轮推导必须严格遵循以下导演意图：\n> ${userPrompt}\n请根据该指令，结合上下文推导后续分镜。`
            : `你是一位顶级分镜导演。基于给定的“核心分镜”，请推导出与其紧密关联的 **3 个连续分镜**。这 3 个分镜应构成一个完整的微型叙事弧（如：起因 -> 发展 -> 结果），其中核心分镜是该弧线的灵感来源。`;

        return await withRetry(async () => {
            const text = await this.chat([
                {
                    role: 'system',
                    content: `## 【最高优先级：全局风格宪法 - VISUAL STYLE CONSTITUTION】
本项目遵循以下视觉风格预设作为视觉基调：
> ${stylePreset}
你必须在生成分镜推导时完全融合该风格。

---

## 任务说明 (Task)
${derivationInstruction}

## 视觉种子 (Seed Shot)
- 画面描述: ${anchorShot.action_description}
- 镜头类型: ${anchorShot.shot_type}
- 场景ID: ${anchorShot.scene_id}
- 角色IDs: ${anchorShot.character_ids?.join(', ') || '无'}

## 故事背景 (Script Context)
${script.slice(0, 1500)}${script.length > 1500 ? '...' : ''}

## 可用资产 (Available Assets)
### 角色 (Characters):
${charactersList}
### 场景 (Scenes):
${scenesList}

## 输出要求 (Output)
必须返回一个包含 3 个分镜项的 JSON 数组。
 image_prompt 必须使用流畅的中文自然语言。`
                }
            ], true);

            const results = parseJSONRobust(text || '', []);
            return results.map((res: any) => ({
                id: generateId(),
                shot_number: 0,
                timestamp: '00:00',
                duration: 3,
                shot_type: res.shot_type || 'MS',
                camera_angle: res.camera_angle || 'Eye Level',
                camera_movement: res.camera_movement || 'Static',
                composition: res.composition || 'Standard',
                action_description: res.action_description,
                character_ids: res.character_ids || anchorShot.character_ids || [],
                scene_id: res.scene_id || anchorShot.scene_id || '',
                image_prompt: res.image_prompt,
                seed: Math.floor(Math.random() * 1000000),
                lyric_line: '',
                render_status: 'idle',
                isLocked: false
            } as StoryboardItem));
        });
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

            // Generate the grid image using the image engine
            let grid_image_url = "";
            if (result.image_gen_instruction) {
                const imgResult = await this.generateImage(result.image_gen_instruction, {
                    seed: Math.floor(Math.random() * 1000000),
                    aspect_ratio: "16:9"
                });
                grid_image_url = imgResult.preview_url;
            }

            return {
                breakdown: result.breakdown || "",
                story_tone: result.story_tone || "",
                approach: result.approach || "",
                keyframes: result.keyframes_text || "",
                grid_image_url: grid_image_url,
                prompt_breakdown: result.prompt_breakdown || ""
            };
        });
    }

    async generateNarrativeGrid(anchorShot: StoryboardItem, script: string, context: GlobalContext): Promise<StoryboardItem[]> {
        const stylePreset = context.visual_style_preset || "电影感";
        const charactersList = context.characters.map(c => `- ${c.name} (ID: ${c.char_id}): ${c.description || '无描述'}`).join('\n');

        return await withRetry(async () => {
            const text = await this.chat([
                {
                    role: 'system',
                    content: `## 【叙事九宫格生成 - NARRATIVE 9-GRID GENERATION】
你是一位大师级视觉叙事专家。请根据提供的“种子瞬间”，将其扩展为一个包含 **9 个分镜** 的完整剧情片段。
这 9 个分镜必须涵盖：
1. 建立镜头 (Establishing)
2. 细节/特写 (Detail/CU)
3. 反应镜头 (Reaction)
4. 核心动作展开 (Action Progression)
5. 情绪高潮 (Emotional Climax)
6. 结果 (Resolution)

## 视觉种子 (Seed Shot)
- 画面描述: ${anchorShot.action_description}
- 场景ID: ${anchorShot.scene_id}

## 故事背景 (Script Context)
${script.slice(0, 1500)}

## 输出要求 (Output)
返回一个包含 9 个分镜项的 JSON 数组。
image_prompt 必须使用极高质量的、描述光影和情感的中文自然语言。`
                }
            ], true);

            const results = parseJSONRobust(text || '', []);
            return results.map((res: any, idx: number) => ({
                id: generateId(),
                shot_number: idx + 1,
                timestamp: '00:00',
                duration: 2,
                shot_type: res.shot_type || 'MS',
                camera_angle: res.camera_angle || 'Eye Level',
                camera_movement: res.camera_movement || 'Static',
                action_description: res.action_description,
                character_ids: res.character_ids || anchorShot.character_ids || [],
                scene_id: res.scene_id || anchorShot.scene_id || '',
                image_prompt: res.image_prompt,
                seed: Math.floor(Math.random() * 1000000),
                lyric_line: '',
                render_status: 'idle',
                isLocked: false
            } as StoryboardItem));
        });
    }
}
