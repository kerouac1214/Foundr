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
    insertShotAt: (index: number, shot: StoryboardItem) => void;
    insertShotsBatch: (index: number, shots: StoryboardItem[]) => void;
    toggleSceneReferenceLock: (sceneId: string) => void;
    updateChapterContent: (chapterId: string, content: string) => void;

    // Chapter Selection
    selectedChapterId: string | null;
    setSelectedChapterId: (id: string | null) => void;

    // Actions
    resetProject: () => void;
}

const INITIAL_CONTEXT: GlobalContext = {
    style_package: "Hyper-realistic cinematic photography, Live-action film still, 8k RAW photo, shot on ARRI Alexa 65, realistic skin pores, natural lighting",
    visual_style_preset: "Hyper-realistic cinematic photography, Live-action film still, 8k RAW photo, shot on ARRI Alexa 65, realistic skin pores, natural lighting",
    visual_style_category: 'cinematic',
    visual_style_subcategory_name: '默认',
    core_colors: "Natural lighting, Realistic skin",
    aspect_ratio: '9:16',
    script_engine: 'kimi',
    image_engine: 'nb2',
    video_engine: 'google',
    characters: [],
    scenes: []
};

export const useProjectStore = create<ProjectState>()(
    persist(
        (set) => ({
            script: '',
            setScript: (script) => {
                console.log('Zustand: setScript called, length:', script.length);
                set({ script });
            },

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

            insertShotAt: (index, shot) => set((state) => {
                const newStoryboard = [...state.storyboard];
                newStoryboard.splice(index, 0, shot);
                // Re-number shots to maintain 1-indexed order
                const renumbered = newStoryboard.map((s, i) => ({
                    ...s,
                    shot_number: i + 1
                }));
                return { storyboard: renumbered };
            }),

            insertShotsBatch: (index, shots) => set((state) => {
                const newStoryboard = [...state.storyboard];
                newStoryboard.splice(index, 0, ...shots);
                const renumbered = newStoryboard.map((s, i) => ({
                    ...s,
                    shot_number: i + 1
                }));
                return { storyboard: renumbered };
            }),

            toggleCharacterReferenceLock: (charId) => set((state) => ({
                globalContext: {
                    ...state.globalContext,
                    characters: state.globalContext.characters.map((c) =>
                        c.char_id === charId ? { ...c, is_reference_locked: !c.is_reference_locked } : c
                    )
                }
            })),

            toggleSceneReferenceLock: (sceneId: string) => set((state) => ({
                globalContext: {
                    ...state.globalContext,
                    scenes: state.globalContext.scenes.map((s) =>
                        s.scene_id === sceneId ? { ...s, is_reference_locked: !(s as any).is_reference_locked } : s
                    )
                }
            })),

            updateChapterContent: (chapterId, content) => {
                console.log('Zustand: updateChapterContent called, id:', chapterId, 'length:', content.length);
                set((state) => ({
                    projectMetadata: state.projectMetadata ? {
                        ...state.projectMetadata,
                        chapters: state.projectMetadata.chapters?.map((c) =>
                            c.id === chapterId ? { ...c, content } : c
                        )
                    } : null
                }));
            },

            selectedChapterId: null,
            setSelectedChapterId: (id) => set({ selectedChapterId: id }),

            resetProject: () => set({
                script: '',
                globalContext: INITIAL_CONTEXT,
                projectMetadata: null,
                storyboard: [],
                selectedChapterId: null
            })
        }),
        {
            name: 'foundr-project-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
