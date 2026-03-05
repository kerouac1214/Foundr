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

export class KimiProvider implements ScriptProvider {
    private model = "moonshot-v1-8k";
    private apiBase = "/moonshot/v1";
    private apiKey = (process.env.KIMI_API_KEY || "").trim();

    updateConfig(config: any) {
        if (config.api_base) this.apiBase = config.api_base;
        if (config.api_key) this.apiKey = config.api_key.trim();
        if (config.model_name) this.model = config.model_name;

        console.log(`[KimiProvider] Config updated. Model: ${this.model}, Key present: ${!!this.apiKey}`);
    }

    private async request(messages: any[], jsonMode: boolean = false, customModel?: string) {
        const targetModel = customModel || this.model;
        try {
            const response = await fetch(`${this.apiBase}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: targetModel,
                    messages,
                    response_format: jsonMode ? { type: "json_object" } : undefined,
                    temperature: 0.3,
                    max_tokens: 16384
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[KimiProvider] Request failed (${targetModel}):`, errorText);
                throw new Error(`Kimi API Error: ${errorText}`);
            }

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (err: any) {
            console.error(`[KimiProvider] Error during request:`, err);
            throw err;
        }
    }

    async chat(messages: any[], jsonMode: boolean = false): Promise<string> {
        // Automatically switch to vision model if images are present
        const hasImage = messages.some(m =>
            Array.isArray(m.content) && m.content.some((c: any) => c.type === 'image_url')
        );

        const targetModel = hasImage ? "moonshot-v1-8k-vision-preview" : this.model;
        if (hasImage && targetModel !== this.model) {
            console.log(`[KimiProvider] Image detected, switching to vision model: ${targetModel}`);
        }

        return await this.request(messages, jsonMode, targetModel);
    }

    async structureEpisodes(script: string): Promise<{ status: ProjectStatus, episodes: Episode[] }> {
        return await withRetry(async () => {
            const content = await this.chat([
                {
                    role: 'system',
                    content: `## 角色设定 (Role)
你是一位好莱坞级别的剧集统筹 (Showrunner) 和剧本编审 (Script Editor)。你的任务是接收长篇剧本文本，并将其合理、精准地拆分为多个独立的集数（Episodes），为后续 banquet 分镜拆解提供结构框架。

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

## 输出要求 (Output)
必须严格返回标准 JSON 格式。`
                },
                {
                    role: 'user',
                    content: `请对以下剧本进行分集处理：
                    ---
                    ${script}
                    ---`
                }
            ], true);
            const result = parseJSONRobust(content, { project_status: {}, episodes: [] });
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
            const content = await this.chat([
                {
                    role: 'system',
                    content: `你是一位顶级的剧集架构师。你的唯一任务是将长篇剧本精准切分为多个章节。

## 核心规则（不可违反）

### 规则1：优先识别原著分集标记
如果剧本中存在明确的分集/章节标记（如"第一集"、"第二集"、"EP1"、"Episode 2"、"第一章"等），
你**必须**严格按照这些标记进行切分。每一个标记对应一个独立的 chapter。**绝对不允许**将多集合并为一个 chapter。

### 规则2：完整保留原文
每个 chapter 的 \`content\` 字段**必须包含该集/章节对应的完整剧本原文**，一字不漏，不可缩写、概括或省略。
content 是剧本原文的**完整拷贝**，不是摘要。

### 规则3：前置内容归入第一章
如果剧本开头有人物介绍、背景设定等前置内容（在第一个分集标记之前），将其归入第一个 chapter 的 content 中。

### 规则4：智能切分（无标记时）
仅当剧本中完全没有任何分集/章节标记时，才按叙事弧线自动切分，目标约 500-800 字一集。

## 输出格式
必须返回标准 JSON：
{
  "chapters": [
    { "id": "1", "title": "章节标题（使用原剧本的分集标题或自拟简短标题）", "summary": "本集核心剧情的一句话概述", "content": "该集完整的剧本原文" },
    { "id": "2", "title": "...", "summary": "...", "content": "..." }
  ]
}

**再次强调：如果剧本有3集标记，你必须输出3个 chapter；有5集标记就输出5个。绝不可少。**`
                },
                {
                    role: 'user',
                    content: `请将以下长剧本切分为章节：\n\n${script}`
                }
            ], true);
            const result = parseJSONRobust(content, { chapters: [] });
            const chapters = result.chapters || result.章节 || result.Chapters || [];
            return chapters.map((c: any) => ({
                id: c.id || generateId(),
                title: c.title || c.标题 || "未命名章节",
                summary: c.summary || c.摘要 || "",
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
            return {
                characters: result.characters || result.Character_Analysis || [],
                scenes: result.scenes || result.Scene_Assets || []
            };
        });
    }

    async extractAssets(script: string, context: GlobalContext): Promise<{ characters: any[]; scenes: any[] }> {
        const stylePreset = context.visual_style_preset || "电影感";

        // === CALL 1: Scene Extraction ===
        const scenes = await withRetry(async () => {
            const content = await this.chat([
                {
                    role: 'system',
                    content: `## 影视资产场景解析系统 (Scene Asset Parsing System)

### 1. 核心角色 (Role)
你是一位顶尖的场景美术指导 (Production Designer)。你的任务是分析剧本，提取所有具备视觉构建价值的"场景资产"，并从空间逻辑、影调氛围、核心道具三个维度进行解构。

### 2. 全局风格基调
本项目的视觉风格预设为：
> ${stylePreset}
场景的视觉提示词必须融合该风格基调。

### 3. 场景提取与去重规则 (Extraction & Logical Rules)
- **资产化命名 (Asset-Based Naming)**：不仅是地点，还需包含内外景 (INT/EXT) 及时间属性 (Time of Day)。
  - 错误示例：客厅
  - 专业示例：INT_MARK_LIVING_ROOM_MIDNIGHT
- **空间分级 (Spatial Hierarchy)**：
  - 核心场景 (Hero Sets)：出现频率高、有关键剧情发生的室内外空间。
  - 过渡场景 (Transition Spaces)：走廊、车内、校门口等连接性空间。
- **智能去重与变体 (De-duplication & Variations)**：
  物理地点相同但陈设/影调发生剧变的，需作为不同资产提取。

### 4. 场景描述维度 (Description Dimensions)
你的描述必须包含以下工业参数：
- **Architecture & Style (建筑与风格)**：如"英式写实主义"、"维多利亚风格"、"极简现代"。
- **Lighting Logic (光影逻辑)**：基于剧本设定时间点的色温描述（如：3000K 暖光 vs 6500K 冷蓝光）。
- **Hero Props (核心道具)**：对剧情有推动作用的关键物品。
- **Sensory Atmosphere (氛围感)**：空间的湿度、整洁度、声音暗示。

### 5. 输出格式 (JSON)
必须严格返回 JSON，包含 "scenes" 数组：
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
      "visual_anchor_prompt": {
        "Instruction_Role": "Master Character Designer & Lead Cinematographer",
        "Reference_Fidelity_Protocol": {
          "Image_Input_Analysis": "If a reference image is uploaded, strictly extract and replicate the following: facial bone structure, skin micro-textures, hair flow, and the specific lighting temperature (e.g., 3000K amber).",
          "Scene_Alignment": "Environment generation must inherit the architectural style and color palette from the reference image to ensure spatial continuity.",
          "Identity_Consistency_Override": "Mandatory 100% adherence to the uploaded subject’s identity. All visual outputs must serve as a direct extension of the provided reference."
        },
        "Identity_Consistency_Protocol": {
          "Target_Subject": "场景的中文详细描述。包含光影和建筑细节。",
          "Identity_Lock": "ATL (Actual-to-Life) consistency. No deviation in architectural features or textures.",
          "Core_Elements": "环境中的核心元素（中文）"
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
    }
  ]
}

### 语言规则
- name, architecture, lighting, atmosphere 使用中文
- visual_anchor_prompt 内的所有值必须为中文
- visual_anchor_prompt 必须是一个 JSON 对象（不是字符串）`
                },
                {
                    role: 'user',
                    content: `请分析以下剧本，提取所有场景资产：\n---\n${script}\n---`
                }
            ], true);
            const result = parseJSONRobust(content, { scenes: [] });
            return (result.scenes || result.Scene_Assets || []).map((s: any) => ({
                scene_id: s.asset_id || s.Asset_ID || s.scene_id,
                name: s.name || s.Visual_Core?.Name,
                description: `风格：${s.architecture || s.Visual_Core?.Architecture || ''}\n氛围：${s.atmosphere || s.Visual_Core?.Atmosphere || ''}`,
                narrative_importance: s.importance || s.Narrative_Importance || 'Hero',
                relevant_scene_ids: s.scene_ids || s.Scene_IDs || [],
                core_lighting: s.lighting || s.Visual_Core?.Lighting || '',
                key_elements: s.key_props || s.Visual_Core?.Key_Props || [],
                visual_anchor_prompt: typeof s.visual_anchor_prompt === 'object'
                    ? JSON.stringify(s.visual_anchor_prompt, null, 2)
                    : (s.visual_anchor_prompt || ''),
                seed: Math.floor(Math.random() * 1000000)
            }));
        });

        // === CALL 2: Character Extraction ===
        const characters = await withRetry(async () => {
            const content = await this.chat([
                {
                    role: 'system',
                    content: `## 角色深度画像提取系统 (Character Deep Profile System)

### 1. 核心任务 (Core Mission)
你是一位专业的剧本分析师和影视制片顾问。你的任务是扫描剧本，利用"名字优先原则"提取所有具备叙事权重的角色，并将其解析为多维度的 JSON 角色画像，为后续的 AI 视觉建模提供精准的资产蓝图。

### 2. 全局风格基调
本项目的视觉风格预设为：
> ${stylePreset}
角色的视觉提示词必须融合该风格基调。

### 3. 提取与资产裂变规则 (Extraction & Asset Fission Rules)
- **名字优先原则**：自动锁定所有具备独立命名的角色。
- **跨年龄/跨状态裂变提取 (Age & State Fission)**：当同一个角色跨越了不同的人生阶段或经历了导致外貌/气质发生根本性改变的重大剧变时，必须将该角色裂变为多个完全独立的视觉角色进行提取。
- **出勤统计**：统计每个独立提取出的角色在剧本中出现的场景总数及场景 ID。

### 4. 角色详细信息字段定义 (Fields Definition)
- Role_ID: 姓名_年龄阶段/状态
- Demographics: 年龄、性别、国籍/族裔
- Profile: 性格特征、职业身份
- Visual_Identity: 穿着描述（材质与层级）、身体及面部核心特征。保持中性表情视角。

### 5. 输出格式 (JSON)
必须严格返回 JSON，包含 "characters" 数组：
{
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

### 6. 运行示例 (以 Mark 为例)
当系统检测到剧本中 Mark 贯穿了不同的人生阶段时，会将其视为完全不同的视觉资产，分别输出至少 3 个独立的角色对象：
- Mark_Childhood: 提取并设计其 8 岁时的资产，描述其幼童的面部比例、特定年代的童装材质及孩童独有的神态特征。
- Mark_MiddleAge: 提取并设计其 35 岁时的资产，描述其作为“完美丈夫”时期的成年骨骼结构、米色针织衫细节及细微的疲惫感。
- Mark_OldAge: 提取并设计其 70 岁时的资产，描述其老年时期的皮肤纹理（老年斑、下垂的眼袋）、苍白的毛发及陈旧的衣物质感。

### 语言规则
- 所有层级的描述及 Name 使用中文。
- **重要 (CRITICAL)**: \`Nationality_Ethnicity\` 必须明确指出角色的人种/国籍（如：Chinese, Asian, Caucasian, etc.）以确保后续 AI 生成图像的一致性。`
                },
                {
                    role: 'user',
                    content: `请分析以下剧本，提取所有角色资产：\n---\n${script}\n---`
                }
            ], true);
            const result = parseJSONRobust(content, { characters: [] });
            return (result.characters || result.Character_Analysis || []).map((c: any) => ({
                char_id: c.Role_ID || c.char_id,
                name: c.Core_Profile?.Name || c.name,
                description: `${c.Core_Profile?.Age || c.age || ''} ${c.Core_Profile?.Gender || c.gender || ''}，${c.Core_Profile?.Nationality_Ethnicity || ''}。${c.Core_Profile?.Personality || c.personality || ''}。身穿${c.Visual_Reference?.Outfit || c.outfit || ''}。特征：${c.Visual_Reference?.Physical_Traits || c.physical_traits || ''}`,
                age: c.Core_Profile?.Age || c.age || '',
                gender: c.Core_Profile?.Gender || c.gender || '',
                personality: c.Core_Profile?.Personality || c.personality || '',
                occupation: c.Core_Profile?.Occupation || c.occupation || '',
                outfit: c.Visual_Reference?.Outfit || c.outfit || '',
                physical_traits: c.Visual_Reference?.Physical_Traits || c.physical_traits || '',
                consistency_seed_prompt: '',
                seed: Math.floor(Math.random() * 1000000)
            }));
        });

        return { characters, scenes };
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
            const content = await this.chat([
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
你是一位顶级的**电影分镜导演 (Storyboard Director)** 和 **AI 视频生成专家**。你的任务是将剧本转化为工业级的分镜脚本，精确拆解视听语言，并为 AI 图像工具和 AI 视频模型分别提供极其精准的中文生成指令。

### 2. 拆解准则 (Deconstruction Rules)
- **视听语言的精确性 (Cinematic Precision)**：明确景别（如：CU, MS, WS, POV）和机位角度（如：Eye-level, Low-angle, High-angle）。
- **动作离散化演算法 (Action Decomposition & Temporal Discretization)**：
  - **任何具有叙事权重的动态瞬间（如：进门、摔倒、开火、反应）严禁合并在单一分镜中。**
  - 你必须按照“预备 (Anticipation) -> 接触/核心 (Contact/Core) -> 结果/反应 (Result/Reaction)”的逻辑至少拆解为 3 个分镜。
  - **黄金案例 (The Gold Standard)**：
    - 剧本：女主下车时不慎崴脚摔倒。
    - 拆解分镜 1：【中景/MS】镜头对准车门打开，女主的一只脚踏出车外（预备）。
    - 拆解分镜 2：【特写/CU/极低角度】脚踝扭曲的瞬间，高跟鞋跟断裂触地（核心接触）。
    - 拆解分镜 3：【全景/WS】女主跌坐在地上，手撑着草坪，痛苦地看着车内（结果/反应）。
- **光圈与景深优先 (Aperture & Depth of Field)**：静态帧必须设定焦段和光圈（如：50mm f/1.8 浅景深，或 24mm f/8 极深景深），严禁在图像生成提示词中出现“运镜”指令。
- **AI 去描述化原则 (AI Prompt Generalization)**：在提示词中，绝对禁止使用角色的具体名字。将剧中人物替换为泛化词汇（如：A 32yo man, A blond 25yo woman）。
- **强制视觉约束 (Mandatory Constraints)**：严禁使用任何形式的拼接图、多面板、九宫格、分屏或对比图。画面必须是无边框的，不能有画框或留白边缘。图像中绝对不能包含任何文字、字母、排版、标志、水印或海报元素（绿色的二进制代码必须作为视觉粒子特效融入画面，而不能作为排版文字覆盖在图片上）。
- **提示词双轨制 (Dual-Prompting System)**：
    - **Image Prompt**：专注画面构图、人物泛化特征、光影、材质、相机参数与胶片质感。
    - **Video Prompt**：专注画面内物理元素的运动和镜头极其微小的推拉摇移。你必须在视频提示词中注入物理规律自动推演指令，包含：
        *   **流体动力学 (Fluid Dynamics)**：如液体流动、烟雾扩散的真实感。
        *   **重力与加速度 (Gravity & Acceleration)**：物体下落、抛物线的物理真实性。
        *   **碰撞与形变 (Collision & Deformation)**：物体接触时的碰撞反馈、软体形变效果。
        *   **动力学一致性 (Kinetic Consistency)**：确保运动符合真实世界物理常数。

### 3. 可选资产 (Available Assets)
- **Characters**: [${charContext}]
- **Scenes**: [${sceneContext}]

### 4. 输出格式与语言要求 (Output & Language Requirements)
- **分镜数量限制**：每次请求最多输出 **12 个** shots，超出部分省略，以确保完整的 JSON 输出。
- **语言强制**：返回的 JSON 中，\`description\` 对象内的所有字段（\`content\`, \`shot_type\`, \`camera_angle\`, 等）以及 \`lyric_line\` **必须全部使用中文**表达。\`ai_prompts\` 也必须使用中文。
必须严格返回标准的 JSON 格式：
{
  "metadata": { "bpm": 120, "energy_level": "High", "overall_mood": "Tense", "transitions": [] },
  "episode": 1,
  "shots": [
    {
      "shot_number": 1,
      "characters": ["角色ID"],
      "scene": "场景ID",
      "description": {
        "shot_type": "景别",
        "camera_angle": "机位角度",
        "camera_movement": "运镜",
        "lens_and_aperture": "焦段与光圈",
        "lighting": "光影设定",
        "content": "画面内容描述",
        "sound_design": "音效设计"
      },
      "lyric_line": "台词 (分镜对应部分)",
      "ai_prompts": {
        "image_generation_prompt": "中文自然语言静态提示词",
        "video_generation_prompt": "中文自然语言动态提示词 (包含物理仿真指令)"
      },
      "script_content": "剧本详细内容原文",
      "image_description": "画面视觉描述",
      "dialogue": "角色台词 (若有)",
      "action_state": "角色当前动作状态详细描述",
      "narrative_function": "该镜头的叙事功能或隐喻意义",
      "time_coord": "时间坐标 (如: 夜晚)",
      "era_coord": "年代坐标 (如: 现代)",
      "date_coord": "日期坐标 (如: 普通工作日)"
    }
  ]
}`
                },
                {
                    role: 'user',
                    content: `请根据以下剧本解析分镜：
                    ---
                    ${script}
                    ---`
                }
            ], true);
            const result = parseJSONRobust(content, { metadata: {}, shots: [] });

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
            const content = await this.chat([
                {
                    role: 'system',
                    content: `Generate a character design JSON. Use this internal structure:
                    {
                        "consistency_seed_prompt": "...",
                        "description": "..."
                    }`
                },
                {
                    role: 'user',
                    content: `Generate character DNA for [${draft.name}]. Context: ${draft.description}. Style: [${context.visual_style_preset}].
                    The consistency_seed_prompt MUST follow this EXACT JSON structure. Fill in the bracketed parts with Chinese descriptions based on the character's context.

                    {
                      "Instruction_Role": "Master Character Designer & Lead Cinematographer",
                      "Reference_Fidelity_Protocol": {
                        "Image_Input_Analysis": "If a reference image is uploaded, strictly extract and replicate the following: facial bone structure, skin micro-textures, hair flow, and the specific lighting temperature (e.g., 3000K amber).",
                        "Scene_Alignment": "Environment generation must inherit the architectural style and color palette from the reference image to ensure spatial continuity.",
                        "Identity_Consistency_Override": "Mandatory 100% adherence to the uploaded subject’s identity. All visual outputs must serve as a direct extension of the provided reference."
                      },
                      "Identity_Consistency_Protocol": {
                        "Target_Subject": "[角色的详细中文描述。**必须指出人种/民族**]",
                        "Identity_Lock": "ATL (Actual-to-Life) 物理一致性。角色面部特征与参考图保持 100% 严苛一致。",
                        "Core_Elements": "[来自参考图及上下文的特定服装细节、颜色、材质和道具（中文）]"
                      },
                      "Master_Layout_Grid": {
                        "Canvas_Division": "Professional character reference sheet. Aspect ratio 16:9.",
                        "Left_Zone": "One prominent, high-fidelity full-body photo (主图全身照). Shot on 35mm lens, ARRI Alexa 65 aesthetic.",
                        "Top_Right_Zone": "3-view technical full-body orthographic drawings (全身照三视图: Front, Side, Back) for modeling reference.",
                        "Bottom_Right_Zone": "3-view face close-up technical drawings (面部特写三视图: Front, 45-degree, Profile) focusing on texture and facial details."
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

                    IMPORTANT: Return ONLY valid JSON containing \`consistency_seed_prompt\` (as a JSON string representing the object above) and \`description\` (Brief Chinese summary). Do not wrap the JSON object inside the consistency_seed_prompt field with string quotes manually, just output the nested JSON object, I will stringify it later. Wait, no, output \`consistency_seed_prompt\` as the fully formed JSON object above. We will stringify it.`
                }
            ], true);
            const dna = parseJSONRobust(content, {});
            // Ensure consistency_seed_prompt is a string even if the model returns an object
            if (dna.consistency_seed_prompt && typeof dna.consistency_seed_prompt === 'object') {
                dna.consistency_seed_prompt = JSON.stringify(dna.consistency_seed_prompt, null, 2);
            }
            const forgedPrompt = dna.consistency_seed_prompt || '';
            console.log(`[Forge Character] ${draft.name}: prompt length = ${typeof forgedPrompt === 'string' ? forgedPrompt.length : 'object'}`);

            return {
                ...dna,
                char_id: draft.char_id,
                name: draft.name,
                description: draft.description || dna.description,
                // Priority: forge JSON prompt > extraction plain text prompt > empty
                consistency_seed_prompt: forgedPrompt || draft.consistency_seed_prompt || '',
                is_anchored: true,
                seed: Math.floor(Math.random() * 1000000)
            };
        });
    }

    async forgeSceneDNA(draft: any, context: GlobalContext): Promise<SceneDNA> {
        return await withRetry(async () => {
            const content = await this.chat([
                {
                    role: 'system',
                    content: `Generate an environment concept JSON. Use this internal structure:
                    {
                        "visual_anchor_prompt": "...",
                        "description": "..."
                    }`
                },
                {
                    role: 'user',
                    content: `Generate scene DNA for [${draft.name}]. Description: ${draft.description}. Style: [${context.visual_style_preset}].
                    The visual_anchor_prompt MUST follow this EXACT JSON structure. Fill in the bracketed parts with Chinese descriptions based on the scene's context.

                    {
                      "Instruction_Role": "Master Character Designer & Lead Cinematographer",
                      "Reference_Fidelity_Protocol": {
                        "Image_Input_Analysis": "If a reference image is uploaded, strictly extract and replicate the following: facial bone structure, skin micro-textures, hair flow, and the specific lighting temperature (e.g., 3000K amber).",
                        "Scene_Alignment": "Environment generation must inherit the architectural style and color palette from the reference image to ensure spatial continuity.",
                        "Identity_Consistency_Override": "Mandatory 100% adherence to the uploaded subject’s identity. All visual outputs must serve as a direct extension of the provided reference."
                      },
                      "Identity_Consistency_Protocol": {
                        "Target_Subject": "[场景的详细中文描述。包含光影和建筑细节。]",
                        "Identity_Lock": "ATL (Actual-to-Life) 物理一致性。",
                        "Core_Elements": "[环境中的核心视觉元素（中文）]"
                      },
                      "Master_Layout_Grid": {
                        "Canvas_Division": "Professional scene reference sheet. Aspect ratio 16:9.",
                        "Left_Zone": "One prominent, high-fidelity master shot. Shot on 35mm lens, ARRI Alexa 65 aesthetic.",
                        "Top_Right_Zone": "Technical layout blueprint / schematic for spatial reference.",
                        "Bottom_Right_Zone": "3 close-up shots focusing on texture, lighting, and key props."
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

                    IMPORTANT: Return ONLY valid JSON containing \`visual_anchor_prompt\` (as a fully formed nested JSON object representing the structure above) and \`description\` (Brief Chinese summary). Do not wrap the JSON object inside the visual_anchor_prompt field with string quotes manually! We will stringify it.`
                }
            ], true);
            const dna = parseJSONRobust(content, {});

            // Ensure visual_anchor_prompt is a string
            if (dna.visual_anchor_prompt && typeof dna.visual_anchor_prompt === 'object') {
                dna.visual_anchor_prompt = JSON.stringify(dna.visual_anchor_prompt, null, 2);
            }

            const forgedScenePrompt = dna.visual_anchor_prompt || '';
            return {
                ...dna,
                scene_id: draft.scene_id,
                name: draft.name,
                description: draft.description || dna.description,
                visual_anchor_prompt: forgedScenePrompt || draft.visual_anchor_prompt || '',
                core_lighting: draft.core_lighting || dna.core_lighting || '',
                key_elements: draft.key_elements || dna.key_elements || [],
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
                    "Identity_Lock": "ATL (Actual-to-Life) 一致性。",
                    "Core_Elements": "[参考图及上下文中提到的特有特征或道具（中文）]"
                },
                "Master_Layout_Grid": {
                    "Canvas_Division": "Professional character reference sheet. Aspect ratio 16:9.",
                    "Left_Zone": "One prominent, high-fidelity full-body photo (主图全身照). Shot on 35mm lens, ARRI Alexa 65 aesthetic.",
                    "Top_Right_Zone": "3-view technical full-body orthographic drawings (全身照三视图: Front, Side, Back) for modeling reference.",
                    "Bottom_Right_Zone": "3-view face close-up technical drawings (面部特写三视图: Front, 45-degree, Profile) focusing on texture and facial details."
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
                    "Target_Subject": "[场景的详细中文描述。包含光影和建筑细节。]",
                    "Identity_Lock": "ATL (Actual-to-Life) 一致性。",
                    "Core_Elements": "[环境中的核心视觉元素（中文）]"
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

            const content = await this.chat([
                {
                    role: 'system',
                    content: `You are an AI prompt engineer specializing in high-fidelity Visual DNA.
                    Your goal is to refine the provided [Description] into a professional JSON prompt structure.
                    ${referenceImage ? 'A reference image is provided. Prioritize extracting visual details from this image.' : ''}
                    Return ONLY the refined JSON string representing the prompt.`
                },
                {
                    role: 'user',
                    content: `Asset Name: ${name}
                    New Description: ${description}
                    Type: ${type}
                    Reference Image URL: ${referenceImage || 'None'}
                    
                    Refine this into the following JSON structure. Fill in the bracketed parts with Chinese descriptions.
                    ${JSON.stringify(template, null, 2)}
                    
                    IMPORTANT: Return ONLY valid JSON representing the fully filled-in structure. do not include any other text.`
                }
            ], true);

            const result = parseJSONRobust(content, {});
            return typeof result === 'object' ? JSON.stringify(result, null, 2) : content;
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
                try {
                    const parsed = JSON.parse(c.consistency_seed_prompt);
                    physicalDesc = parsed.Identity_Consistency_Protocol?.Target_Subject || c.description;
                } catch (e) { }

                let imageRef = "";
                if (c.preview_url) {
                    imageRef = `[Reference: Image ${imageIndex++}]`;
                }

                return `- Character ${c.name} ${imageRef}: ${physicalDesc}`;
            }).join('\n')
            : "No specific characters.";

        let scenePhysicalDesc = scene?.description || "";
        if (scene && scene.visual_anchor_prompt) {
            try {
                const parsed = JSON.parse(scene.visual_anchor_prompt);
                scenePhysicalDesc = parsed.Scene_Profile?.Theme_Description || scene.description;
            } catch (e) { }
        }

        let sceneImageRef = "";
        if (scene?.preview_url) {
            sceneImageRef = `[Reference: Image ${imageIndex++}]`;
        }

        const sceneDesc = scene ?
            `Scene: ${scene.name} ${sceneImageRef}. Theme: ${scenePhysicalDesc}.` :
            `Environment: ${env?.visual_anchor_prompt || 'Generic Background'}.`;

        return await withRetry(async () => {
            return await this.request([
                {
                    role: 'system',
                    content: `你是一位顶级电影美术指导。请输出一段详细的、具有电影感的中文提示词，用于生成静态电影剧照。`
                },
                {
                    role: 'user',
                    content: `Create a structured, high-fidelity film still prompt based on:
                    
                    1. ACTION: ${item.action_description}
                    2. SHOT TYPE: ${item.shot_type}, ${item.camera_angle || 'Eye-level'}, ${item.camera_movement || 'Static'}
                    3. LIGHTING/VIBE: ${item.lighting_vibe || 'Cinematic'}, ${item.composition || 'Balanced'}
                    
                    CHARACTERS IN SHOT:
                    ${charDesc}
                    
                    SETTING:
                    ${sceneDesc}
                    
                    VISUAL STYLE PRESET:
                    ${context.visual_style_preset}
                    
                    REQUIREMENTS:
                    - 使用流畅的描述性中文编写一段连续的电影画面提示词。
                    - **强制视觉约束**：严禁使用任何形式的拼接图、多面板、九宫格、分屏或对比图。画面必须是无边框的，不能有画框或留白边缘。图像中绝对不能包含任何文字、字母、排版、标志、水印或海报元素（绿色的二进制代码必须作为视觉粒子特效融入画面，而不能作为排版文字覆盖在图片上）。
                    - 重要：如果任何角色或场景带有 [Reference: Image X] 标签，你必须明确在提示词开头指出他们来自该参考图。
                      示例：“参考图1中的角色和参考图2中的角色正在参考图3的场景中互动。”
                    - 空间关系：根据剧情的动作，明确定义角色的具体位置布局（例如：“参考图1的角色站在画面左侧，面向坐在右侧的参考图2角色”）。
                    - **镜头表现**：你必须在描述中明确体现所选的 **景别** (${item.shot_type}) 和 **拍摄角度** (${item.camera_angle || 'Eye-level'})。
                    - 在建立布局和参考图关联后，继续无缝描述他们的动作、表情、天气、光影和构图。
                    - 仅输出最终的提示词字符串。`
                }
            ]);
        });
    }

    async analyzeShotInsertion(description: string, context: GlobalContext, _surroundingShots: StoryboardItem[]): Promise<StoryboardItem> {
        const stylePreset = context.visual_style_preset || "电影感";
        const charactersList = context.characters.map(c => `- ${c.name} (ID: ${c.char_id}): ${c.description || '无描述'}`).join('\n');
        const scenesList = context.scenes.map(s => `- ${s.name} (ID: ${s.scene_id}): ${s.description || '无描述'}`).join('\n');

        return await withRetry(async () => {
            const content = await this.chat([
                {
                    role: 'system',
                    content: `## 【最高优先级：全局风格宪法 - VISUAL STYLE CONSTITUTION】
**本项目遵循以下视觉风格预设作为视觉基调：**
> ${stylePreset}
**你必须在生成分镜描述和提示词时完全融合该风格。**

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
  "image_prompt": "中文 Stable Diffusion 提示词，融合风格、角色特征 and 场景元素",
  "character_ids": ["角色ID列表"],
  "scene_id": "场景ID"
}

请确保：
1. 从可用资产中匹配最合适的 character_ids 和 scene_id。如果描述中没有提到特定资产，请根据上下文推断或保持为空。
2. image_prompt 必须使用自然、流畅的中文，包含环境、光影、人物体态和风格基调。`
                },
                {
                    role: 'user',
                    content: `用户描述：${description}`
                }
            ], true);

            const result = parseJSONRobust(content, {
                shot_type: 'MS',
                camera_angle: 'Eye Level',
                camera_movement: 'Static',
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
            const content = await this.chat([
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
必须返回标准的 JSON 对象，包含一个 "results" 键，其值为包含 4 个分镜项的数组，顺序为 [前一镜头2, 前一镜头1, 后一镜头1, 后一镜头2]。
每个对象格式：
{
  "shot_type": "WS/MS/CU/POV 等",
  "camera_angle": "Eye Level/Low Angle 等",
  "camera_movement": "Static/Dolly In 等",
  "composition": "过肩镜头/正反打/主观镜头/低角度/高角度/景深镜头/浅景深/标准构图",
  "action_description": "中文详细画面动作描述 (必须严格保持角色一致性)",
  "image_prompt": "中文 Stable Diffusion 提示词，继承全局风格和种子镜头的视觉基调",
  "character_ids": ["角色ID列表"],
  "scene_id": "场景ID"
}

请确保推导出的镜头在叙事上与“视觉种子”紧密衔接，补完动作的起因、过程或结果。`
                },
                {
                    role: 'user',
                    content: `请围绕种子镜头推导前后各 2 个关键瞬间。`
                }
            ], true);

            const results = parseJSONRobust(content, []);
            let shotsArray: any[] = [];
            if (Array.isArray(results)) {
                shotsArray = results;
            } else if (results && typeof results === 'object' && Array.isArray(results.results)) {
                shotsArray = results.results;
            } else if (results && typeof results === 'object' && Array.isArray(results.shots)) {
                shotsArray = results.shots;
            }

            if (shotsArray.length === 0) return [];

            return shotsArray.map((res: any, index: number) => ({
                id: generateId(),
                shot_number: 0,
                timestamp: '00:00',
                duration: 3,
                shot_type: res.shot_type || 'MS',
                camera_angle: res.camera_angle || 'Eye Level',
                camera_movement: res.camera_movement || 'Static',
                composition: res.composition || 'Standard', // Added composition
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

    async deriveNarrativeTrinity(anchorShot: StoryboardItem, script: string, context: GlobalContext): Promise<StoryboardItem[]> {
        return [];
    }

    async generateNarrativeGrid(anchorShot: StoryboardItem, script: string, context: GlobalContext): Promise<StoryboardItem[]> {
        return [];
    }
}
