import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
    ProjectMetadata,
    StoryboardItem,
    GlobalContext,
    CharacterDNA,
    SceneDNA,
    EnvironmentDNA,
    AspectRatio,
    ImageEngine
} from '../types';

interface ProjectState {
    // Script
    script: string;
    setScript: (script: string) => void;

    // Global Context (Characters, Scenes, Style)
    globalContext: GlobalContext;
    updateGlobalContext: (updates: Partial<GlobalContext>) => void;

    // Project Data (Storyboard, Metadata)
    projectMetadata: ProjectMetadata | null;
    storyboard: StoryboardItem[];
    setProjectMetadata: (metadata: ProjectMetadata) => void;
    setStoryboard: (storyboard: StoryboardItem[]) => void;
    updateShot: (id: string, updates: Partial<StoryboardItem>) => void;
    updateCharacter: (charId: string, updates: Partial<CharacterDNA>) => void;
    updateScene: (sceneId: string, updates: Partial<SceneDNA>) => void;
    updateEnvironment: (updates: Partial<EnvironmentDNA>) => void;
    toggleCharacterReferenceLock: (charId: string) => void;
    toggleSceneReferenceLock: (sceneId: string) => void;

    // Actions
    resetProject: () => void;
}

const INITIAL_CONTEXT: GlobalContext = {
    style_package: "高对比度，细节丰富",
    visual_style_preset: "Cinematic, 8k resolution, highly detailed",
    visual_style_category: 'cinematic',
    visual_style_subcategory_name: '默认',
    core_colors: "电影感, 高对比, 细腻质感",
    aspect_ratio: '16:9',
    script_engine: 'google',
    image_engine: 'nb_pro',
    video_engine: 'google',
    characters: [],
    scenes: []
};

export const useProjectStore = create<ProjectState>()(
    persist(
        (set) => ({
            script: '',
            setScript: (script) => set({ script }),

            globalContext: INITIAL_CONTEXT,
            updateGlobalContext: (updates) => set((state) => ({
                globalContext: { ...state.globalContext, ...updates }
            })),

            projectMetadata: null,
            storyboard: [],

            setProjectMetadata: (metadata) => set({ projectMetadata: metadata }),
            setStoryboard: (storyboard) => set({ storyboard }),
            updateShot: (id, updates) => set((state) => ({
                storyboard: state.storyboard.map((item) =>
                    item.id === id ? { ...item, ...updates } : item
                )
            })),

            updateCharacter: (charId, updates) => set((state) => ({
                globalContext: {
                    ...state.globalContext,
                    characters: state.globalContext.characters.map((c) =>
                        c.char_id === charId ? { ...c, ...updates } : c
                    )
                }
            })),

            updateScene: (sceneId, updates) => set((state) => ({
                globalContext: {
                    ...state.globalContext,
                    scenes: state.globalContext.scenes.map((s) =>
                        s.scene_id === sceneId ? { ...s, ...updates } : s
                    )
                }
            })),

            updateEnvironment: (updates) => set((state) => ({
                globalContext: {
                    ...state.globalContext,
                    environment: state.globalContext.environment ? { ...state.globalContext.environment, ...updates } : undefined
                }
            })),

            toggleCharacterReferenceLock: (charId) => set((state) => ({
                globalContext: {
                    ...state.globalContext,
                    characters: state.globalContext.characters.map((c) =>
                        c.char_id === charId ? { ...c, is_reference_locked: !c.is_reference_locked } : c
                    )
                }
            })),

            toggleSceneReferenceLock: (sceneId) => set((state) => ({
                globalContext: {
                    ...state.globalContext,
                    scenes: state.globalContext.scenes.map((s) =>
                        s.scene_id === sceneId ? { ...s, is_reference_locked: !(s as any).is_reference_locked } : s
                    )
                }
            })),

            resetProject: () => set({
                script: '',
                globalContext: INITIAL_CONTEXT,
                projectMetadata: null,
                storyboard: []
            })
        }),
        {
            name: 'foundr-project-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
