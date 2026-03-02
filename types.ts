
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
  /** 用于一致性参考的图片 URL (确认过的形象) */
  reference_image_url?: string;
  /** 是否锁定此角色的视觉参考 */
  is_reference_locked?: boolean;
  /** 候选参考图库 (用于生成引导) */
  candidate_reference_images?: string[];
}

export interface SceneDNA {
  scene_id: string; // This corresponds to Asset_ID (e.g. INT_...)
  name: string;
  description: string; // Space and Atmosphere
  narrative_importance: 'Hero' | 'Transition';
  relevant_scene_ids: string[]; // List of S01, S02... that use this asset
  visual_anchor_prompt: string;
  core_lighting: string;
  key_elements: string[];
  preview_url?: string;
  seed: number;
  /** 场景参考图 (确认过的场景形象) */
  reference_image_url?: string;
  /** 候选场景参考图库 */
  candidate_reference_images?: string[];
}

export interface EnvironmentDNA {
  description: string;
  visual_anchor_prompt: string;
  core_lighting: string;
  key_elements: string[];
  preview_url?: string;
}

export type LifecycleStatus = 'draft' | 'analyzing' | 'structured' | 'production' | 'completed';
export type AnalysisMode = 'Single_Episode' | 'Full_Script';

export interface Chapter {
  id: string;
  title: string;
  summary: string;
  content: string;
  episode_ids: number[]; // References to Episode IDs within this chapter
}
export type AspectRatio = '16:9' | '9:16' | '4:3' | '1:1';
export type AIEngine = 'google' | 'runninghub' | 'modelscope' | 'kimi' | 'glm5' | 'nb2' | 'nb_pro' | 'qwen2512' | 'z_image' | 'wan2_2' | 'vidu_q2' | 'seedance_1_5';
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
    api_key?: string;
    model_name?: string;
    api_key_override?: string;
    [key: string]: any;
  }>;
  characters: CharacterDNA[];
  scenes: SceneDNA[];
  environment?: EnvironmentDNA; // 保留用于兼容旧数据
}

export interface BatchTask {
  id: string; // shotId
  type: 'photo' | 'video';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  retryCount: number;
  addedTime: number;
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

export interface Episode {
  episode_number: number;
  estimated_duration: string;
  boundaries: {
    start_text_anchor: string;
    end_text_anchor: string;
  };
  narrative_structure: {
    opening_scene: string;
    core_conflict: string;
    ending_cliffhanger: string;
  };
}

export interface ProjectStatus {
  total_episodes: number;
  division_mode: 'Original_Script_Markers' | 'Smart_120s_Cliffhanger';
}

export interface ProjectMetadata {
  id: string;
  name?: string;
  full_script?: string;
  analysis_mode?: AnalysisMode;
  bpm: number;
  energy_level: string;
  overall_mood: string;
  lifecycle_status?: LifecycleStatus;
  status?: ProjectStatus; // Episodic status
  chapters?: Chapter[];
  episodes?: Episode[];
  transitions: number[];
}

export interface StoryboardItem {
  id: string;
  shot_number: number;
  timestamp: string;
  duration: number;
  shot_type: string; // Made string for more cinematic labels like WS
  camera_angle?: string;
  camera_movement: string;
  lens_and_aperture?: string; // New: 85mm f/1.4
  lighting_vibe?: string;
  action_description: string;
  visual_content?: string;
  sound_design?: string; // New: Audio & Ambience
  lyric_line: string;
  seed: number;
  character_ids: string[];
  scene_id?: string;
  ai_prompts?: {
    image_generation_prompt: string;
    video_generation_prompt: string;
  };
  preview_url?: string;
  video_url?: string;
  video_engine?: AIEngine;
  video_status?: 'idle' | 'generating' | 'ready';
  isLocked?: boolean;
  isImageLocked?: boolean;
  render_status?: 'idle' | 'rendering' | 'done';
  image_prompt?: string;
  video_prompt?: string;
  composition?: string;
  reference_image_url?: string;
  candidate_image_urls?: string[];

  // Detailed Narrative Metadata
  script_content?: string;     // 剧本内容
  image_description?: string;  // 画面描述
  dialogue?: string;           // 台词
  action_state?: string;       // 动作状态
  narrative_function?: string; // 叙事功能
  time_coord?: string;         // 时间坐标
  era_coord?: string;          // 年代坐标
  date_coord?: string;         // 日期坐标
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
