
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
}

export interface EnvironmentDNA {
  description: string;
  visual_anchor_prompt: string;
  core_lighting: string;
  key_elements: string[];
  preview_url?: string;
}

export type AspectRatio = '16:9' | '9:16' | '4:3';
export type ImageEngine = 'google' | 'runninghub';

export interface GlobalContext {
  style_package: string;
  visual_style_preset: string;
  visual_style_category: string;
  visual_style_subcategory_name: string;
  core_colors: string;
  aspect_ratio: AspectRatio;
  image_engine: ImageEngine;
  characters: CharacterDNA[];
  environment?: EnvironmentDNA;
}

export interface ProjectMetadata {
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
  preview_url?: string;
  video_url?: string;
  video_status?: 'idle' | 'generating' | 'ready';
}

export interface AppState {
  lyrics: string;
  isAnalyzing: boolean;
  progress: number;
  statusMessage: string;
  phase: 'idle' | 'extracting_assets' | 'assets_ready' | 'generating_script' | 'script_ready' | 'producing' | 'video_production' | 'finalized';
  project: {
    metadata: ProjectMetadata;
    storyboard: StoryboardItem[];
  } | null;
  global_context: GlobalContext;
  error: string | null;
  activeView: 'context' | 'foundry' | 'storyboard' | 'video_master';
}
