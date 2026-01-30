
import { GoogleGenAI, Type } from "@google/genai";
import { GlobalContext, StoryboardItem, CharacterDNA, EnvironmentDNA, ProjectMetadata, AspectRatio, ImageEngine } from "../types";

// RunningHub 配置
const RUNNINGHUB_API_KEY = "b3f9b846ae9641beb40208bcd30425a6";
const RUNNINGHUB_BASE_URL = "https://api.runninghub.cn/external/server/v1/open";
const WORKFLOW_ID = "2004373823144902658";

async function withRetry<T>(fn: () => Promise<T>, retries: number = 3, delay: number = 2000): Promise<T> {
  try { return await fn(); } catch (error: any) {
    if (retries <= 0) throw error;
    const errorMsg = error?.message?.toLowerCase() || "";
    const isRetryable = errorMsg.includes("429") || errorMsg.includes("500") || errorMsg.includes("quota") || errorMsg.includes("fetch") || errorMsg.includes("deadline");
    if (!isRetryable) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay * 2);
  }
}

async function urlToBase64(url: string): Promise<string> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export const extractCharacters = async (storyText: string): Promise<any[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-3-flash-preview";
  return await withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: `分析以下剧本，识别并提取所有主要角色。请确保 description 使用中文。输出 JSON 数组，包含 char_id, name, description。\n剧本：\n${storyText}`,
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
            }
          }
        }
      }
    });
    return JSON.parse(response.text || '{"characters":[]}').characters;
  });
};

export const forgeEnvironmentDNA = async (storyText: string, context: GlobalContext): Promise<EnvironmentDNA> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-3-flash-preview";
  return await withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: `基于剧本内容，为整部片子设计一个核心的视觉锚点场景(Environment DNA)。
      风格预设：[${context.visual_style_preset}]。
      要求：
      1. description, core_lighting, key_elements 使用中文。
      2. visual_anchor_prompt：英文提示词，描述建筑、天气、光影。`,
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
    return JSON.parse(response.text || '{}');
  });
};

export const forgeCharacterDNA = async (draft: any, context: GlobalContext): Promise<CharacterDNA> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-3-flash-preview";
  return await withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: `基于角色简介 [${draft.name}: ${draft.description}]，生成视觉 DNA。风格：[${context.visual_style_preset}]。consistency_seed_prompt 为英文。`,
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
    const dna = JSON.parse(response.text || '{}');
    return { ...dna, char_id: draft.char_id, name: draft.name, description: draft.description, is_anchored: true, seed: Math.floor(Math.random() * 1000000) };
  });
};

export const generateStoryboard = async (storyText: string, characters: CharacterDNA[]): Promise<{ metadata: ProjectMetadata; initial_script: any[] }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = "gemini-3-flash-preview"; 
  const charContext = characters.map(c => `${c.char_id} (${c.name})`).join(', ');
  return await withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: `你是一个导演。请将剧本拆解为分镜脚本。可用角色：[${charContext}]。剧本：\n${storyText}`,
      config: {
        thinkingConfig: { thinkingBudget: 4000 },
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            metadata: {
              type: Type.OBJECT,
              properties: {
                bpm: { type: Type.INTEGER },
                energy_level: { type: Type.STRING },
                overall_mood: { type: Type.STRING }
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
                  character_ids: { type: Type.ARRAY, items: { type: Type.STRING } }
                }
              }
            }
          }
        }
      }
    });
    return JSON.parse(response.text || '{}');
  });
};

export const refineShotPrompt = (item: StoryboardItem, characters: CharacterDNA[], env: EnvironmentDNA, context: GlobalContext): string => {
  const charDetails = characters.map(c => 
    `(Character: ${c.name}, VisualDNA: ${c.consistency_seed_prompt})`
  ).join(' AND ');
  const sceneAnchor = `((Scene Visual Anchor: ${env.visual_anchor_prompt}, Lighting: ${env.core_lighting}, Atmosphere: ${context.visual_style_preset}))`;
  return `${sceneAnchor}, ${charDetails}, ACTION: ${item.action_description}, SHOT: ${item.shot_type} shot, CAMERA: ${item.camera_movement}, masterpiece.`;
};

// RunningHub 调用核心优化
export const generateVisualPreviewRunningHub = async (
    prompt: string, 
    aspectRatio: AspectRatio, 
    refImages?: string[] 
): Promise<string> => {
  const headers = {
    "apikey": RUNNINGHUB_API_KEY,
    "Content-Type": "application/json"
  };

  const [width, height] = aspectRatio === '16:9' ? [1024, 576] : aspectRatio === '9:16' ? [576, 1024] : [1024, 1024];

  // 构造输入数据，匹配多图参考需求
  // 注意：键名 "prompt", "image_ref_1", "image_ref_2" 等需与您 ComfyUI 的 API 节点输入键名一致
  const inputData: any = {
    "prompt": prompt,
    "negative_prompt": "easynegative, worst quality, low quality, watermark, text, signature",
    "width": width,
    "height": height
  };

  if (refImages && refImages.length > 0) {
      // 自动将参考图注入 input_data
      // 这里假设您的工作流接受 "image_input" 或类似命名的键
      for(let i=0; i < refImages.length; i++) {
          const key = i === 0 ? "image_input" : `image_input_${i+1}`;
          // 如果是 data:image 格式则裁剪，RunningHub API 需要纯 base64 字符串
          const base64 = refImages[i].includes('base64,') ? refImages[i].split('base64,')[1] : refImages[i];
          inputData[key] = base64;
      }
  }

  const body = {
    workflow_id: WORKFLOW_ID,
    input_data: inputData
  };

  console.log("RunningHub Request Payload:", body);

  try {
    const submitResp = await fetch(`${RUNNINGHUB_BASE_URL}/run`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      mode: 'cors' // 显式请求跨域
    });

    if (!submitResp.ok) {
        const errorText = await submitResp.text();
        console.error("RunningHub API HTTP Error:", submitResp.status, errorText);
        throw new Error(`RunningHub HTTP ${submitResp.status}: ${errorText}`);
    }
    
    const result = await submitResp.json();
    if (result.code !== 0) {
      console.error("RunningHub Business Error:", result);
      throw new Error(`RunningHub Error [${result.code}]: ${result.msg}`);
    }

    const task_id = result.data.task_id;
    console.log("RunningHub Task Started:", task_id);

    let attempts = 0;
    while (attempts < 60) {
      await new Promise(r => setTimeout(r, 4000));
      const checkResp = await fetch(`${RUNNINGHUB_BASE_URL}/task/status?task_id=${task_id}`, { headers });
      if (!checkResp.ok) continue;
      
      const statusResult = await checkResp.json();
      const { status, output_url, msg } = statusResult.data || {};
      
      if (status === "SUCCESS" && output_url) {
        console.log("RunningHub Task Success:", output_url);
        // 转为 base64 避免预览失效
        const finalResp = await fetch(output_url);
        const finalBlob = await finalResp.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(finalBlob);
        });
      } else if (status === "FAILED") {
        throw new Error(`RunningHub Task Execution Failed: ${msg || 'Unknown failure in workflow nodes'}`);
      }
      attempts++;
    }
    throw new Error("RunningHub Task Polling Timeout (240s)");
  } catch (err: any) {
    if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        throw new Error("网络连接失败 (Failed to fetch)。这通常是由于 CORS 跨域限制或 RunningHub 域名无法访问导致的。请检查网络或联系 RunningHub 开启 CORS 权限。");
    }
    throw err;
  }
};

export const generateVisualPreviewGoogle = async (prompt: string, seed: number, aspectRatio: AspectRatio): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return await withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: `${prompt} --seed ${seed}` }] },
      config: { imageConfig: { aspectRatio } }
    });
    const part = response.candidates?.[0]?.content.parts.find(p => p.inlineData);
    if (part?.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    throw new Error("Gemini Image Engine failed to produce data.");
  });
};

export const generateVisualPreview = async (
  engine: ImageEngine,
  prompt: string,
  seed: number,
  aspectRatio: AspectRatio,
  refImages?: string[]
): Promise<string> => {
  if (engine === 'runninghub') {
    return await generateVisualPreviewRunningHub(prompt, aspectRatio, refImages);
  } else {
    return await generateVisualPreviewGoogle(prompt, seed, aspectRatio);
  }
};

export const generateVideoForShot = async (prompt: string, aspectRatio: AspectRatio): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
    operation = await ai.operations.getVideosOperation({operation: operation});
  }
  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  const videoResp = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  const blob = await videoResp.blob();
  return URL.createObjectURL(blob);
};
