import { Type } from "@google/genai";
import {
    CharacterDNA,
    SceneDNA,
    GlobalContext,
    AspectRatio,
    ProjectMetadata,
    EnvironmentDNA,
    StoryboardItem
} from "../../types";
import { withRetry, getAIClient, parseJSONRobust } from "../core";
import { ScriptProvider, ImageProvider, VideoProvider } from "./base";

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

    async extractAssets(script: string): Promise<{ characters: any[]; scenes: any[] }> {
        const ai = this.getClient();
        return await withRetry(async () => {
            const response = await ai.models.generateContent({
                model: this.model,
                contents: `YOU ARE AN EXPERT SCRIPT SUPERVISOR.
Your task is to extract all Characters and Scenes with 100% precision.

EXTRACTION PROTOCOL:
1. CHARACTERS:
   - Scan for DIALOGUE SPEAKERS (e.g., "陈霄：", "苏晴："). If a name appears before a colon, they ARE a character.
   - Scan for names in ACTION descriptions.
   - Keep Chinese names exactly as they appear.

2. SCENES (CRITICAL):
   - A SCENE is a physical LOCATION or ENVIRONMENT (e.g., "咖啡馆", "办公室", "室内").
   - STICK TO REAL LOCATIONS.
   - !!! DO NOT EXTRACT TIMESTAMPS, DURATIONS, OR SHOT NUMBERS AS SCENES !!!
   - Examples of what NOT to extract: "开篇3秒", "5秒", "Shot 1".
   - If the entire script takes place in one location, only extract ONE scene.

3. DATA QUALITY:
   - Duplicate names must be merged.
   - IDs should be short, descriptive, and unique.

TARGET SCRIPT:
"""
${script}
"""

OUTPUT: return a JSON with "characters" and "scenes" arrays.`,
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
                                        description: { type: Type.STRING }
                                    },
                                    required: ["char_id", "name", "description"]
                                }
                            },
                            scenes: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        scene_id: { type: Type.STRING },
                                        name: { type: Type.STRING },
                                        description: { type: Type.STRING }
                                    },
                                    required: ["scene_id", "name", "description"]
                                }
                            }
                        }
                    }
                }
            });
            return parseJSONRobust(response.text || '', { characters: [], scenes: [] });
        });
    }

    async generateStoryboard(script: string, characters: any[], scenes: any[]): Promise<{ metadata: ProjectMetadata; initial_script: any[] }> {
        const ai = this.getClient();
        const charContext = characters.map(c => `${c.char_id} (Name: ${c.name})`).join(', ');
        const sceneContext = scenes.map(s => `${s.scene_id} (Name: ${s.name})`).join(', ');

        return await withRetry(async () => {
            const response = await ai.models.generateContent({
                model: this.model,
                contents: `You are a High-End Film Director and Cinematographer.
      Break down the script into a master shot list. 
      STRICTLY USE ONLY THE PROVIDED ENTITIES.

      Available Characters: [${charContext}].
      Available Scenes: [${sceneContext}].

      Target Script:
      """
      ${script}
      """

      Storyboard Requirements:
      - action_description: Detailed visual staging and composition IN CHINESE (Simplified).
      - lyric_line: The dialogue for this shot. MUST BE VERBATIM FROM SCRIPT.
      - camera_movement: Dolly In, Dolly Out, Pan, Tilt, Orbit, Fixed.
      - shot_type: CU, MS, LS, POV.
      - lighting_vibe: Atmospheric lighting in Chinese.
      
      STRICT CONSTRAINTS:
      1. ONLY use character_ids provided in "Available Characters". DO NOT invent new characters.
      2. ONLY use scene_ids provided in "Available Scenes". DO NOT invent new scenes.
      3. Ensure logic continuity between shots.`,
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
                            initial_script: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        shot_type: { type: Type.STRING, enum: ['CU', 'MS', 'LS', 'POV'] },
                                        action_description: { type: Type.STRING },
                                        lyric_line: { type: Type.STRING },
                                        camera_movement: { type: Type.STRING },
                                        camera_angle: { type: Type.STRING },
                                        lighting_vibe: { type: Type.STRING },
                                        composition: { type: Type.STRING },
                                        character_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
                                        scene_id: { type: Type.STRING }
                                    }
                                }
                            }
                        }
                    }
                }
            });
            const result = parseJSONRobust(response.text || '', { metadata: {}, initial_script: [] });

            // Sanitization
            const metadata: ProjectMetadata = {
                id: '', // Set by caller
                bpm: result.metadata?.bpm || 120,
                energy_level: result.metadata?.energy_level || 'Medium',
                overall_mood: result.metadata?.overall_mood || 'Neutral',
                transitions: Array.isArray(result.metadata?.transitions) ? result.metadata.transitions : []
            };

            return { metadata, initial_script: result.initial_script || [] };
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
      
      The consistency_seed_prompt MUST follow this EXACT modular structure (filling in the brackets):
      {
        "Instruction_Role": "Master Character Designer & Concept Architect",
        "Identity_Consistency_Protocol": {
          "Target_Subject": "[Precise physical description of ${draft.name} based on context. YOU MUST SPECIFY RACE/NATIONALITY/ETHNICITY (e.g., Asian, Caucasian, Chinese, etc.)]",
          "Identity_Lock": "Mandatory 100% facial and costume consistency across all views. Ensure the same character identity in every sub-panel.",
          "Core_Elements": "[Unique traits or props mentioned in context]"
        },
        "Master_Layout_Grid": {
          "Canvas_Division": "Professional character reference sheet split-view. Aspect ratio 16:9.",
          "Left_Zone": "One prominent, high-fidelity full-body portrait representing the character's overall vibe.",
          "Top_Right_Zone": "3-view technical orthographic drawings (Front, Side, Back) for modeling reference.",
          "Bottom_Right_Zone": "Expression Cluster: 3 distinct facial close-up shots showing different emotions."
        },
        "Visual_Style_Module": {
          "Style_Definition": "[${context.visual_style_preset}]",
          "Rendering_Specifics": "16:9 aspect ratio, 4k, ultra-detailed, soft cinematic lighting, neutral studio background",
          "Background": "Solid neutral grey or white studio background, zero environmental interference."
        },
        "Anatomy_&_Ratio_Override": {
          "Proportion_Scale": "1:8.5",
          "Posture": "Clean A-Pose, high waistline, clear silhouette."
        }
      }

      Return a JSON object with:
      1. consistency_seed_prompt: The filled-in JSON string above.
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
}
