
export interface CharacterDNA {
  char_id: string;
  name: string;
  is_anchored: boolean;
  description: string;
  physical_core: {
    gender_age: string;
    facial_features: string;
    hair_style: string;
    distinguishing_marks: string;
  };
  costume_id: {
    top: string;
    bottom: string;
    accessories: string;
  };
  consistency_seed_prompt: string;
  preview_url?: string;
  seed: number;
  // Voice Asset Fields
  voice_ref_audio_url?: string; // Base64 or URL of uploaded reference audio
  voice_sample_text?: string;   // Text to speak
  voice_preview_url?: string;   // URL of generated voice
  /** 用于一致性参考的图片 URL */
  reference_image_url?: string;
  /** 是否锁定此角色的视觉参考 */
  is_reference_locked?: boolean;
}

export interface SceneDNA {
  scene_id: string;
  name: string;
  description: string;
  visual_anchor_prompt: string;
  core_lighting: string;
  key_elements: string[];
  preview_url?: string;
  seed: number;
  /** 场景参考图 */
  reference_image_url?: string;
}

export interface EnvironmentDNA {
  description: string;
  visual_anchor_prompt: string;
  core_lighting: string;
  key_elements: string[];
  preview_url?: string;
}

export type AspectRatio = '16:9' | '9:16' | '4:3' | '1:1';
export type AIEngine = 'google' | 'runninghub' | 'modelscope' | 'kimi' | 'nb_pro' | 'qwen2512' | 'z_image';
export type ImageEngine = AIEngine;

export interface GlobalContext {
  style_package: string;
  visual_style_preset: string;
  visual_style_category: string;
  visual_style_subcategory_name: string;
  core_colors: string;
  aspect_ratio: AspectRatio;
  script_engine: AIEngine;
  image_engine: ImageEngine;
  video_engine: AIEngine;
  /** 引擎配置，如自定义 API 地址等 */
  engine_configs?: Record<string, {
    api_base?: string;
    model_name?: string;
    api_key_override?: string;
  }>;
  characters: CharacterDNA[];
  scenes: SceneDNA[];
  environment?: EnvironmentDNA; // 保留用于兼容旧数据
}

export interface BatchProgress {
  total: number;
  current: number;
  succeeded: number;
  failed: number;
  currentShotNumber?: number;
  currentShotPreview?: string;
  operation: 'photo' | 'video';
  startTime: number;
  message?: string;
}

export interface ProjectMetadata {
  id: string;
  bpm: number;
  energy_level: string;
  overall_mood: string;
  transitions: number[];
}

export interface StoryboardItem {
  id: string;
  shot_number: number;
  timestamp: string;
  duration: number;
  shot_type: 'CU' | 'MS' | 'LS' | 'POV';
  action_description: string;
  visual_content: string;
  camera_movement: string;
  audio_cue: string;
  lyric_line: string;
  seed: number;
  character_ids: string[];
  scene_id?: string;
  preview_url?: string;
  video_url?: string;
  video_status?: 'idle' | 'generating' | 'ready';
  /** 是否锁定，锁定后批量操作会跳过此镜头 */
  isLocked?: boolean;
  /** 图片渲染状态 */
  render_status?: 'idle' | 'rendering' | 'done';
  /** 生成图片的实际提示词 */
  image_prompt?: string;
  /** 扩展元数据：运镜、灯光等 */
  camera_angle?: string;
  lighting_vibe?: string;
  composition?: string;
  /** 最终渲染参考图 (一旦生成满意的图可锁定为参考) */
  reference_image_url?: string;
  /** 候选图片 (First-Frame Selection) */
  candidate_image_urls?: string[];
}

export interface AppState {
  lyrics: string;
  isAnalyzing: boolean;
  progress: number;
  statusMessage: string;
  /** 
   * 工作流阶段:
   * idle -> script_ready -> assets_extracted -> assets_rendered -> images_ready -> finalized
   */
  phase: 'idle' | 'script_ready' | 'assets_extracted' | 'assets_rendered' | 'images_ready' | 'finalized';
  project: {
    metadata: ProjectMetadata;
    storyboard: StoryboardItem[];
  } | null;
  global_context: GlobalContext;
  error: string | null;
  /** 视图: 剧本 -> 分镜 -> 资产 -> 画面 -> 成片 */
  activeView: 'context' | 'storyboard' | 'foundry' | 'images' | 'video_master';
}
