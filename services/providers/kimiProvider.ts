import {
    CharacterDNA,
    SceneDNA,
    GlobalContext,
    ProjectMetadata,
    StoryboardItem,
    EnvironmentDNA
} from "../../types";
import { withRetry, parseJSONRobust } from "../core";
import { ScriptProvider } from "./base";

export class KimiProvider implements ScriptProvider {
    private model = "kimi-latest";
    private apiBase = "https://api.moonshot.cn/v1";
    private apiKey = process.env.KIMI_API_KEY || "sk-WFJSU8061nxUTfet2ZrFqtGjGejGOsnvERjbEybWvN3MxGfo";

    updateConfig(config: any) {
        if (config.api_base) this.apiBase = config.api_base;
        if (config.api_key) this.apiKey = config.api_key;
        if (config.model_name) this.model = config.model_name;
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
                response_format: jsonMode ? { type: "json_object" } : undefined,
                temperature: 0.3
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Kimi API Error: ${error}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    async extractAssets(script: string): Promise<{ characters: any[]; scenes: any[] }> {
        return await withRetry(async () => {
            const content = await this.request([
                {
                    role: 'system',
                    content: `YOU ARE AN EXPERT SCRIPT SUPERVISOR. Output MUST be valid JSON.
                    
                    EXTRACTION PROTOCOL:
                    1. CHARACTERS:
                       - Scan for DIALOGUE SPEAKERS (e.g., "陈霄：", "苏晴："). If a name appears before a colon, they ARE a character.
                       - Scan for names in ACTION descriptions.
                       - Keep Chinese names exactly as they appear.
                    
                    2. SCENES (CRITICAL):
                       - A SCENE is a physical LOCATION or ENVIRONMENT (e.g., "咖啡馆", "办公室", "雨后的街道").
                       - STICK TO REAL LOCATIONS.
                       - !!! STERN WARNING !!!: DO NOT EXTRACT TIMESTAMPS, DURATIONS, OR SHOT NUMBERS AS SCENES.
                       - If you see "开篇3秒", "5秒", "Shot 1", etc., these are NOT scenes. IGNORE THEM.
                       - If the entire script takes place in one location, only extract ONE scene.
                    
                    3. DATA QUALITY:
                       - Duplicate names must be merged.
                       - IDs should be short, descriptive, and unique (e.g., "char_chen_xiao", "scene_cafe").`
                },
                {
                    role: 'user',
                    content: `Extract characters and scenes from this script in JSON format with "characters" (char_id, name, description) and "scenes" (scene_id, name, description) arrays:
                    ---
                    ${script}
                    ---`
                }
            ], true);
            return parseJSONRobust(content, { characters: [], scenes: [] });
        });
    }

    async generateStoryboard(script: string, characters: any[], scenes: any[]): Promise<{ metadata: ProjectMetadata; initial_script: any[] }> {
        const charContext = characters.map(c => `${c.char_id} (Name: ${c.name})`).join(', ');
        const sceneContext = scenes.map(s => `${s.scene_id} (Name: ${s.name})`).join(', ');

        return await withRetry(async () => {
            const content = await this.request([
                {
                    role: 'system',
                    content: `You are a High-End Film Director. Break down the script into a master shot list in JSON format.
                    STRICTLY USE ONLY THE PROVIDED ENTITIES.
                    
                    Available Characters: [${charContext}].
                    Available Scenes: [${sceneContext}].`
                },
                {
                    role: 'user',
                    content: `Analyze this script and return a JSON with "metadata" (bpm, energy_level, overall_mood, transitions) and "initial_script" (array of shots with shot_type, action_description, lyric_line, camera_movement, camera_angle, lighting_vibe, composition, character_ids, scene_id).
                    
                    Script:
                    ---
                    ${script}
                    ---`
                }
            ], true);
            const result = parseJSONRobust(content, { metadata: {}, initial_script: [] });
            const metadata: ProjectMetadata = {
                id: '',
                bpm: result.metadata?.bpm || 120,
                energy_level: result.metadata?.energy_level || 'Medium',
                overall_mood: result.metadata?.overall_mood || 'Neutral',
                transitions: Array.isArray(result.metadata?.transitions) ? result.metadata.transitions : []
            };
            return { metadata, initial_script: result.initial_script || [] };
        });
    }

    async forgeCharacterDNA(draft: any, context: GlobalContext): Promise<CharacterDNA> {
        return await withRetry(async () => {
            const content = await this.request([
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
                    The consistency_seed_prompt MUST follow this EXACT JSON structure. Fill in the bracketed parts with English descriptions based on the character's context.

                    {
                      "Instruction_Role": "Master Character Designer & Concept Architect",
                      "Identity_Consistency_Protocol": {
                        "Target_Subject": "[Precise physical description of ${draft.name} in English. YOU MUST SPECIFY RACE/NATIONALITY/ETHNICITY (e.g., Asian, Caucasian, Chinese, etc.)]",
                        "Identity_Lock": "Mandatory 100% facial and costume consistency across all views. Ensure the same character identity in every sub-panel.",
                        "Core_Elements": "[Unique traits or props mentioned in context, translated to English]"
                      },
                      "Master_Layout_Grid": {
                        "Canvas_Division": "Professional character reference sheet split-view. Aspect ratio 16:9.",
                        "Left_Zone": "One prominent, high-fidelity full-body portrait representing the character's overall vibe.",
                        "Top_Right_Zone": "3-view technical orthographic drawings (Front, Side, Back) for modeling reference.",
                        "Bottom_Right_Zone": "Expression Cluster: 3 distinct facial close-up shots showing different emotions."
                      },
                      "Visual_Style_Module": {
                        "Style_Definition": "[${context.visual_style_preset} translated to English if needed]",
                        "Rendering_Specifics": "16:9 aspect ratio, 4k, ultra-detailed, soft cinematic lighting, neutral studio background",
                        "Background": "Solid neutral grey or white studio background, zero environmental interference."
                      },
                      "Anatomy_&_Ratio_Override": {
                        "Proportion_Scale": "1:8.5",
                        "Posture": "Clean A-Pose, high waistline, clear silhouette."
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
            return { ...dna, char_id: draft.char_id, name: draft.name, description: draft.description, is_anchored: true, seed: Math.floor(Math.random() * 1000000) };
        });
    }

    async forgeSceneDNA(draft: any, context: GlobalContext): Promise<SceneDNA> {
        return await withRetry(async () => {
            const content = await this.request([
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
                    The visual_anchor_prompt MUST follow this EXACT JSON structure. Fill in the bracketed parts with English descriptions based on the scene's context.

                    {
                      "Instruction_Role": "Senior Environment Concept Artist & Level Designer",
                      "Scene_Profile": {
                        "Subject_Name": "[Translate ${draft.name} to English]",
                        "Theme_Description": "[Core description of the scene's atmosphere and structure in English]",
                        "Key_Elements": "[Must include specific props/elements mentioned, e.g., cannons, neon signs, etc., in English]"
                      },
                      "Master_Layout_Architecture": {
                        "Canvas_Division": "Professional environment breakdown sheet with multiple viewports.",
                        "Left_Main_Section": {
                            "Top_Left": "Primary cinematic concept view (Eye-level perspective).",
                            "Bottom_Left": "High-angle isometric view showing the overall structure and layout."
                        },
                        "Middle_Top_Section": "Technical architectural blueprint/schematic drawing on aged paper.",
                        "Right_Detail_Section": {
                            "UI_Elements": "Decorative nameplate with '[${draft.name}]' and a horizontal color palette swatch.",
                            "Detail_Grid": "4 small square frames at the bottom-right showing individual asset close-ups (e.g., textures, machinery, specific props)."
                        }
                      },
                      "Visual_Style_Module": {
                        "Art_Style": "[${context.visual_style_preset} translated to English if needed]",
                        "Rendering_Specifics": "High-fidelity textures, cinematic lighting with golden hour glow, metallic reflections, intricate mechanical details.",
                        "Background": "Solid neutral dark grey background to make the assets pop."
                      },
                      "Technical_Constraints": "Maintain 100% material and color consistency across all views. Ensure the blueprint matches the 3D structure shown in the main views."
                    }

                    IMPORTANT: Return ONLY valid JSON containing \`visual_anchor_prompt\` (as a fully formed nested JSON object representing the structure above) and \`description\` (Brief Chinese summary). Do not wrap the JSON object inside the visual_anchor_prompt field with string quotes manually! We will stringify it.`
                }
            ], true);
            const dna = parseJSONRobust(content, {});

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
                    content: `You are a High-End Cinema Prompt Engineer. Output ONLY a single, detailed English prompt string for generating a film still.`
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
                    - Write a continuous English prompt describing the cinematic action.
                    - CRITICAL: If any character or scene has a [Reference: Image X] tag, you MUST explicitly start your prompt by stating they are from that image.
                      Example: "The character from Image 1 and the character from Image 2 are interacting in the environment from Image 3."
                    - SPATIAL RELATIONSHIP: Based on the plot's ACTION, explicitly define the exact positional layout of the characters (e.g., "The character from Image 1 is standing on the left side of the frame, facing the character from Image 2 who is seated right").
                    - After establishing the layout and image references, continue seamlessly describing their action, expressions, the weather, lighting, and framing based on the parameters above.
                    - Output ONLY the final prompt string.`
                }
            ]);
        });
    }
}
