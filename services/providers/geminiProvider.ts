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
    Chapter
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

    private getClient() {
        return getAIClient(this.apiBase);
    }

    async structureEpisodes(script: string): Promise<{ status: ProjectStatus, episodes: Episode[] }> {
        const ai = this.getClient();
        return await withRetry(async () => {
            const response = await ai.models.generateContent({
                model: this.model,
                contents: `## 角色设定 (Role)
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
必须严格返回标准 JSON 格式。`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            project_status: {
                                type: Type.OBJECT,
                                properties: {
                                    total_episodes: { type: Type.INTEGER },
                                    division_mode: { type: Type.STRING }
                                }
                            },
                            episodes: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        episode_number: { type: Type.INTEGER },
                                        estimated_duration: { type: Type.STRING },
                                        boundaries: {
                                            type: Type.OBJECT,
                                            properties: {
                                                start_text_anchor: { type: Type.STRING },
                                                end_text_anchor: { type: Type.STRING }
                                            }
                                        },
                                        narrative_structure: {
                                            type: Type.OBJECT,
                                            properties: {
                                                opening_scene: { type: Type.STRING },
                                                core_conflict: { type: Type.STRING },
                                                ending_cliffhanger: { type: Type.STRING }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
            const result = parseJSONRobust(response.text || '', { project_status: {}, episodes: [] });
            return {
                status: {
                    total_episodes: result.project_status?.total_episodes || 0,
                    division_mode: result.project_status?.division_mode === 'Original_Script_Markers' ? 'Original_Script_Markers' : 'Smart_120s_Cliffhanger'
                },
                episodes: result.episodes || []
            };
        });
    }

    async partitionIntoChapters(script: string): Promise<Chapter[]> {
        const ai = this.getClient();
        return await withRetry(async () => {
            const response = await ai.models.generateContent({
                model: this.model,
                contents: [{ role: 'user', parts: [{ text: `请将以下长剧本切分为章节：\n\n${script}` }] }],
                config: {
                    systemInstruction: `你是一位顶级的漫剧编剧与架构师。你的任务是将长篇内容（如小说、长篇剧本）切分为具备独立叙事弧线的章节。
                    每个章节必须包含：id, title, summary, content。`,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            chapters: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        id: { type: Type.STRING },
                                        title: { type: Type.STRING },
                                        summary: { type: Type.STRING },
                                        content: { type: Type.STRING }
                                    },
                                    required: ["id", "title", "summary", "content"]
                                }
                            }
                        }
                    }
                }
            });
            const result = parseJSONRobust(response.text || '', { chapters: [] });
            return result.chapters.map((c: any) => ({ ...c, episode_ids: [] }));
        });
    }

    async extractGlobalAssets(script: string, context: GlobalContext): Promise<{ characters: any[], scenes: any[] }> {
        const stylePreset = context.visual_style_preset || "电影感";
        const ai = this.getClient();
        return await withRetry(async () => {
            const response = await ai.models.generateContent({
                model: this.model,
                contents: [{ role: 'user', parts: [{ text: `请从以下长剧本中提取全局核心角色与关键场景：\n\n${script}` }] }],
                config: {
                    systemInstruction: `## 【最高优先级：全局风格宪法 - VISUAL STYLE CONSTITUTION】
**本项目遵循以下视觉风格预设作为视觉基调：**
> ${stylePreset}
**你必须在设计资产时融合该风格，但重点应放在资产本身的物理特征细节上。**

---

## 【最高优先级语言规则 - MANDATORY LANGUAGE RULE】
**你必须严格遵守以下指示，不可违反：**
- 所有 \`name\` 和 \`description\` 字段内容**必须使用中文**。
- \`name\` 字段必须简洁，仅包含资产名称，不得包含任何描述。
- **所有 \`prompt\` 字段必须输出为纯英文的 Stable Diffusion 提示词。**

---

你是一位顶级的制片人与美术指导。你的任务是通读全剧本，提取出在全剧中反复出现、具有核心地位的角色与场景资产，以确保全剧制作的一致性。`,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            characters: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        char_id: { type: Type.STRING },
                                        name: { type: Type.STRING },
                                        description: { type: Type.STRING },
                                        consistency_seed_prompt: { type: Type.STRING, description: "English prompt for character identity" }
                                    }
                                }
                            },
                            scenes: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        scene_id: { type: Type.STRING },
                                        name: { type: Type.STRING },
                                        description: { type: Type.STRING },
                                        core_lighting: { type: Type.STRING },
                                        visual_anchor_prompt: { type: Type.STRING, description: "English prompt for environmental anchor" }
                                    }
                                }
                            }
                        }
                    }
                }
            });
            return parseJSONRobust(response.text || '', { characters: [], scenes: [] });
        });
    }

    async extractAssets(script: string, context: GlobalContext): Promise<{ characters: any[]; scenes: any[] }> {
        const stylePreset = context.visual_style_preset || "电影感";
        const ai = this.getClient();
        return await withRetry(async () => {
            const response = await ai.models.generateContent({
                model: this.model,
                contents: `## 【最高优先级：全局风格宪法 - VISUAL STYLE CONSTITUTION】
**本项目遵循以下视觉风格预设作为视觉基调：**
> ${stylePreset}
**你必须在设计资产时融合该风格，但重点应放在资产本身的物理特征细节上。**

---

## 【最高优先级语言规则 - MANDATORY LANGUAGE RULE】
**你必须严格遵守以下指示，不可违反：**
- 所有 \`name\` 和 \`description\` 字段内容**必须使用中文**。
- \`name\` 字段必须简洁，仅包含角色/场景名称。
- **所有 \`prompt\` 字段必须输出为纯英文的 Stable Diffusion 提示词。**

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
- **身份一致性 (Identity Lock)**：提取角色的核心物理特征，确保在不同场景下的面部与服装一致性。
- **视觉关键词**：提取角色的年龄、肤色、发型、核心服装细节。
- **视觉 DNA 格式**：\`consistency_seed_prompt\` 和 \`visual_anchor_prompt\` 必须输出为极其详细的、符合特定架构的英文 JSON 字符串（包含 Instruction_Role, Reference_Fidelity_Protocol, Identity_Consistency_Protocol, Master_Layout_Grid, Visual_Style_Module, Technical_Override）。

### 5. 目标剧本 (Target Script)
"""
${script}
"""

### 6. 输出要求
请严格按照要求的 JSON 格式返回。所有描述性内容必须为中文。`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            characters: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        char_id: { type: Type.STRING },
                                        name: { type: Type.STRING },
                                        description: { type: Type.STRING },
                                        consistency_seed_prompt: { type: Type.STRING, description: "English prompt for character identity" }
                                    },
                                    required: ["char_id", "name", "description", "consistency_seed_prompt"]
                                }
                            },
                            scenes: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        asset_id: { type: Type.STRING },
                                        importance: { type: Type.STRING },
                                        scene_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
                                        name: { type: Type.STRING },
                                        architecture: { type: Type.STRING },
                                        lighting: { type: Type.STRING },
                                        key_props: { type: Type.ARRAY, items: { type: Type.STRING } },
                                        atmosphere: { type: Type.STRING },
                                        visual_anchor_prompt: { type: Type.STRING, description: "English prompt for environmental anchor" }
                                    },
                                    required: ["asset_id", "importance", "name", "architecture", "lighting", "key_props", "atmosphere", "visual_anchor_prompt"]
                                }
                            }
                        }
                    }
                }
            });
            const result = parseJSONRobust(response.text || '', { characters: [], scenes: [] });

            // Map Scene Assets back to SceneDNA structure
            const mappedScenes = (result.scenes || []).map((s: any) => ({
                scene_id: s.asset_id || s.scene_id,
                name: s.name,
                description: `风格：${s.architecture}\n氛围：${s.atmosphere}`,
                narrative_importance: s.importance || 'Hero',
                relevant_scene_ids: s.scene_ids || [],
                core_lighting: s.lighting,
                key_elements: s.key_props || [],
                visual_anchor_prompt: s.visual_anchor_prompt || '',
                seed: Math.floor(Math.random() * 1000000)
            }));

            const mappedCharacters = (result.characters || []).map((c: any) => ({
                ...c,
                consistency_seed_prompt: c.consistency_seed_prompt || '',
                seed: Math.floor(Math.random() * 1000000)
            }));

            return { characters: mappedCharacters, scenes: mappedScenes };
        });
    }

    async generateStoryboard(script: string, characters: any[], scenes: any[]): Promise<{ metadata: ProjectMetadata; initial_script: any[] }> {
        const ai = this.getClient();
        const charContext = characters.map(c => `${c.char_id}(Name: ${c.name}, Description: ${c.description})`).join(', ');
        const sceneContext = scenes.map(s => `${s.scene_id}(Name: ${s.name}, Description: ${s.description}, Lighting: ${s.core_lighting})`).join(', ');

        return await withRetry(async () => {
            const response = await ai.models.generateContent({
                model: this.model,
                contents: `## 影视分镜与 AI 提示词系统 (Storyboard & AI Prompting System)

### 1. 核心角色 (Role)
你是一位顶级的**电影分镜导演 (Storyboard Director)** 和 **AI 视频生成专家**。你的任务是将剧本转化为工业级的分镜脚本，精确拆解视听语言，并为 AI 图像工具和 AI 视频模型分别提供极其精准的纯英文生成指令。

### 2. 拆解准则 (Deconstruction Rules)
- **视听语言的精确性 (Cinematic Precision)**：明确景别（如：CU, MS, WS, POV）和机位角度（如：Eye-level, Low-angle, High-angle）。
- **光圈与景深优先 (Aperture & Depth of Field)**：静态帧必须设定焦段和光圈（如：50mm f/1.8 浅景深，或 24mm f/8 极深景深），**严禁在图像生成提示词中出现“运镜”指令**。
- **AI 去描述化原则 (AI Prompt Generalization)**：在提示词中，**绝对禁止使用角色的具体名字**。将剧中人物替换为泛化词汇（如：A 32yo man, A blond 25yo woman），以便用户配合垫图使用。
- **提示词双轨制 (Dual-Prompting System)**：
    - **Image Prompt**：专注画面构图、人物泛化特征、光影（基于场景 Lighting）、材质、相机参数与胶片质感。
    - **Video Prompt**：专注画面内物理元素的运动（如：蒸汽上升、眼皮微动、手指摩挲）和镜头的极其微小的推拉摇移（如：Slow pan right, subtle dolly in）。

### 3. 可选资产 (Available Assets)
- **Characters**: [${charContext}]
- **Scenes**: [${sceneContext}]

### 4. 目标剧本 (Target Script)
"""
${script}
"""

### 5. 约束限制 (Constraints)
- **ID 强绑定**：在 "shots" 数组中，"scene" 必须严格填入上表提供的 \`scene_id\` (例如：\`s1\`)，"characters" 必须填入 \`char_id\` 数组。
- **严禁使用名称**：绝对不要在 "scene" 或 "characters" 字段中填入名称（如 "客厅"），必须仅使用 ID。如果无法对应，请根据上下文关联最匹配的 ID。
- **分镜数量限制**：每次请求最多输出 **12 个** shots，超出部分省略，以确保完整的 JSON 输出。
- **全中文描述强制要求**：在返回的 JSON 中，\`description\` 对象下的所有字段（包括 \`shot_type\`, \`camera_angle\`, \`camera_movement\`, \`lens_and_aperture\`, \`lighting\`, \`content\`, \`sound_design\`）以及 \`lyric_line\`，**必须全部使用中文**进行详细描述，绝不能输出英文。
- **输出格式**：确保逻辑连贯，输出必须为合规 successful JSON。`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            metadata: {
                                type: Type.OBJECT,
                                properties: {
                                    bpm: { type: Type.INTEGER },
                                    energy_level: { type: Type.STRING },
                                    overall_mood: { type: Type.STRING },
                                    transitions: { type: Type.ARRAY, items: { type: Type.INTEGER } }
                                }
                            },
                            episode: { type: Type.INTEGER },
                            shots: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        shot_number: { type: Type.INTEGER },
                                        characters: { type: Type.ARRAY, items: { type: Type.STRING } },
                                        scene: { type: Type.STRING },
                                        description: {
                                            type: Type.OBJECT,
                                            properties: {
                                                shot_type: { type: Type.STRING },
                                                camera_angle: { type: Type.STRING },
                                                camera_movement: { type: Type.STRING },
                                                lens_and_aperture: { type: Type.STRING },
                                                lighting: { type: Type.STRING },
                                                content: { type: Type.STRING },
                                                sound_design: { type: Type.STRING }
                                            }
                                        },
                                        lyric_line: { type: Type.STRING },
                                        ai_prompts: {
                                            type: Type.OBJECT,
                                            properties: {
                                                image_generation_prompt: { type: Type.STRING },
                                                video_generation_prompt: { type: Type.STRING }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
            const result = parseJSONRobust(response.text || '', { metadata: {}, shots: [] });

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
        const ai = this.getClient();
        return await withRetry(async () => {
            const response = await ai.models.generateContent({
                model: this.model,
                contents: `Generate a professional character design prompt based on the following template.
      Target Character Name: [${draft.name}]
            Context: ${draft.description}
      Artistic Style: [${context.visual_style_preset}]
      
      The consistency_seed_prompt MUST follow this EXACT modular structure(filling in the brackets):
            {
              "Instruction_Role": "Master Character Designer & Lead Cinematographer",
              "Reference_Fidelity_Protocol": {
                "Image_Input_Analysis": "If a reference image is uploaded, strictly extract and replicate the following: facial bone structure, skin micro-textures, hair flow, and the specific lighting temperature (e.g., 3000K amber).",
                "Scene_Alignment": "Environment generation must inherit the architectural style and color palette from the reference image to ensure spatial continuity.",
                "Identity_Consistency_Override": "Mandatory 100% adherence to the uploaded subject’s identity. All visual outputs must serve as a direct extension of the provided reference."
              },
              "Identity_Consistency_Protocol": {
                "Target_Subject": "[Precise physical description of ${draft.name} in English. YOU MUST SPECIFY RACE/NATIONALITY/ETHNICITY (e.g., Asian, Caucasian, Chinese, etc.)]",
                "Identity_Lock": "ATL (Actual-to-Life) consistency. No deviation in facial features or costume textures.",
                "Core_Elements": "[Unique traits or props mentioned in context, translated to English]"
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
      2. description: Brief Chinese summary of the character's look.`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            physical_core: {
                                type: Type.OBJECT,
                                properties: {
                                    gender_age: { type: Type.STRING },
                                    facial_features: { type: Type.STRING },
                                    hair_style: { type: Type.STRING },
                                    distinguishing_marks: { type: Type.STRING }
                                }
                            },
                            costume_id: {
                                type: Type.OBJECT,
                                properties: {
                                    top: { type: Type.STRING },
                                    bottom: { type: Type.STRING },
                                    accessories: { type: Type.STRING }
                                }
                            },
                            consistency_seed_prompt: { type: Type.STRING }
                        }
                    }
                }
            });
            const dna = parseJSONRobust(response.text || '', {});
            return { ...dna, char_id: draft.char_id, name: draft.name, description: draft.description, is_anchored: true, seed: Math.floor(Math.random() * 1000000) };
        });
    }

    async forgeSceneDNA(draft: any, context: GlobalContext): Promise<SceneDNA> {
        const ai = this.getClient();
        return await withRetry(async () => {
            const response = await ai.models.generateContent({
                model: this.model,
                contents: `Generate a professional environment concept design prompt based on this template.
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
          "Target_Subject": "[Precise physical description of the scene ${draft.name} in English. Include lighting and architecture.]",
          "Identity_Lock": "ATL (Actual-to-Life) consistency. No deviation in architectural features or textures.",
          "Core_Elements": "[Key environmental elements in English]"
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
      4. description: Evocative atmospheric summary in Chinese.`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            description: { type: Type.STRING },
                            visual_anchor_prompt: { type: Type.STRING },
                            core_lighting: { type: Type.STRING },
                            key_elements: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ["description", "visual_anchor_prompt", "core_lighting", "key_elements"]
                    }
                }
            });
            const dna = parseJSONRobust(response.text || '', {});
            return {
                ...dna,
                scene_id: draft.scene_id,
                name: draft.name,
                description: draft.description,
                seed: Math.floor(Math.random() * 1000000)
            };
        });
    }

    async generateImage(prompt: string, seed: number, aspectRatio: AspectRatio): Promise<string> {
        const ai = this.getClient();
        return await withRetry(async () => {
            const response = await ai.models.generateContent({
                model: this.imageModel,
                contents: { parts: [{ text: `${prompt} --seed ${seed}` }] },
                config: { imageConfig: { aspectRatio } }
            });
            const part = response.candidates?.[0]?.content.parts.find(p => p.inlineData);
            if (part?.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
            throw new Error("Gemini Image Engine failed to produce data.");
        }, 5, 5000);
    }

    async generateVideo(prompt: string, aspectRatio: AspectRatio): Promise<string> {
        const ai = this.getClient();
        return await withRetry(async () => {
            let operation = await ai.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                prompt: `Cinematic: ${prompt}`,
                config: {
                    numberOfVideos: 1,
                    resolution: '720p',
                    aspectRatio: aspectRatio === '16:9' ? '16:9' : '9:16'
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
            return URL.createObjectURL(blob);
        });
    }

    async generateImagePrompt(
        item: StoryboardItem,
        characters: any[],
        scene: any | undefined,
        env: any | undefined,
        context: GlobalContext
    ): Promise<string> {
        const ai = this.getClient();
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
            const response = await ai.models.generateContent({
                model: this.model,
                contents: `You are a High-End Cinema Prompt Engineer.
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
- Write a continuous English prompt describing the cinematic action.
- CRITICAL: If any character or scene has a [Reference: Image X] tag, you MUST explicitly start your prompt by stating they are from that image.
  Example: "The character from Image 1 and the character from Image 2 are interacting in the environment from Image 3."
- SPATIAL RELATIONSHIP: Based on the plot's ACTION, explicitly define the exact positional layout of the characters (e.g., "The character from Image 1 is standing on the left side of the frame, facing the character from Image 2 who is seated right").
- After establishing the layout and image references, continue seamlessly describing their action, expressions, the weather, lighting, and framing based on the parameters above.
- Output ONLY the final prompt string.`,
            });
            return response.text ? response.text.trim() : '';
        });
    }

    async analyzeShotInsertion(description: string, context: GlobalContext, _surroundingShots: StoryboardItem[]): Promise<StoryboardItem> {
        const ai = this.getClient();
        const stylePreset = context.visual_style_preset || "电影感";
        const charactersList = context.characters.map(c => `- ${c.name} (ID: ${c.char_id}): ${c.description || '无描述'}`).join('\n');
        const scenesList = context.scenes.map(s => `- ${s.name} (ID: ${s.scene_id}): ${s.description || '无描述'}`).join('\n');

        return await withRetry(async () => {
            const response = await ai.models.generateContent({
                model: this.model,
                contents: `## 【最高优先级：全局风格宪法 - VISUAL STYLE CONSTITUTION】
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
  "action_description": "中文详细画面动作描述",
  "image_prompt": "English Stable Diffusion prompt, combining style, character features, and scene elements",
  "character_ids": ["角色ID列表"],
  "scene_id": "场景ID"
}

请确保：
1. 从可用资产中匹配最合适的 character_ids 和 scene_id。如果描述中没有提到特定资产，请根据上下文推断或保持为空。
2. image_prompt 必须是纯英文，且包含环境、光影、人物体态和风格宪法。`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            shot_type: { type: Type.STRING },
                            camera_angle: { type: Type.STRING },
                            camera_movement: { type: Type.STRING },
                            action_description: { type: Type.STRING },
                            image_prompt: { type: Type.STRING },
                            character_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
                            scene_id: { type: Type.STRING }
                        }
                    }
                }
            });

            const result = parseJSONRobust(response.text || '', {
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
        const ai = this.getClient();
        const stylePreset = context.visual_style_preset || "电影感";
        const charactersList = context.characters.map(c => `- ${c.name} (ID: ${c.char_id}): ${c.description || '无描述'}`).join('\n');
        const scenesList = context.scenes.map(s => `- ${s.name} (ID: ${s.scene_id}): ${s.description || '无描述'}`).join('\n');

        return await withRetry(async () => {
            const response = await ai.models.generateContent({
                model: this.model,
                contents: `## 【最高优先级：全局风格宪法 - VISUAL STYLE CONSTITUTION】
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

请确保推导出的镜头在叙事上与“视觉种子”紧密衔接，补完动作的起因、过程或结果。`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                shot_type: { type: Type.STRING },
                                camera_angle: { type: Type.STRING },
                                camera_movement: { type: Type.STRING },
                                action_description: { type: Type.STRING },
                                image_prompt: { type: Type.STRING },
                                character_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
                                scene_id: { type: Type.STRING }
                            },
                            required: ["shot_type", "camera_angle", "camera_movement", "action_description", "image_prompt"]
                        }
                    }
                }
            });

            const results = parseJSONRobust(response.text || '', []);
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
}
