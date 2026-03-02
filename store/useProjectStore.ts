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
    ImageEngine,
    BatchTask
} from '../types';
import { generateId } from '../utils';
import { idbStorage } from '../utils/idbStorage';

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
    deleteShotImage: (shotId: string, url: string) => void;
    setShotPreviewImage: (shotId: string, url: string, lock?: boolean) => void;

    // Chapter Selection
    selectedChapterId: string | null;
    setSelectedChapterId: (id: string | null) => void;

    // Actions
    resetProject: () => void;
    addCharacter: (name: string) => string;
    addScene: (name: string) => string;

    // Batch Queue
    batchQueue: BatchTask[];
    addToBatchQueue: (tasks: BatchTask[]) => void;
    updateBatchTask: (id: string, type: 'photo' | 'video', updates: Partial<BatchTask>) => void;
    removeFromBatchQueue: (id: string, type: 'photo' | 'video') => void;
    clearBatchQueue: () => void;
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
    video_engine: 'wan2_2',
    characters: [],
    scenes: [],
    engine_configs: {
        glm5: {
            api_key: 'sk-af4be68bfa884fe29cdfc988b6eb656f',
            enable_thinking: true
        } as any
    }
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

            deleteShotImage: (shotId, url) => set((state) => ({
                storyboard: state.storyboard.map((item) =>
                    item.id === shotId
                        ? {
                            ...item,
                            candidate_image_urls: item.candidate_image_urls?.filter((u) => u !== url),
                            preview_url: item.preview_url === url ? (item.candidate_image_urls?.filter((u) => u !== url)[0] || '') : item.preview_url
                        }
                        : item
                )
            })),

            setShotPreviewImage: (shotId, url, lock) => set((state) => ({
                storyboard: state.storyboard.map((item) =>
                    item.id === shotId
                        ? {
                            ...item,
                            preview_url: url,
                            isImageLocked: lock !== undefined ? lock : item.isImageLocked
                        }
                        : item
                )
            })),

            selectedChapterId: null,
            setSelectedChapterId: (id) => set({ selectedChapterId: id }),

            resetProject: () => set({
                script: '',
                globalContext: INITIAL_CONTEXT,
                projectMetadata: null,
                storyboard: [],
                selectedChapterId: null,
                batchQueue: []
            }),

            addCharacter: (name) => {
                const id = generateId();
                const newChar: CharacterDNA = {
                    char_id: id,
                    name,
                    is_anchored: false,
                    description: '',
                    physical_core: { gender_age: '', facial_features: '', hair_style: '', distinguishing_marks: '' },
                    costume_id: { top: '', bottom: '', accessories: '' },
                    consistency_seed_prompt: '',
                    seed: Math.floor(Math.random() * 1000000)
                };
                set((state) => ({
                    globalContext: {
                        ...state.globalContext,
                        characters: [...state.globalContext.characters, newChar]
                    }
                }));
                return id;
            },

            addScene: (name) => {
                const id = generateId();
                const newScene: SceneDNA = {
                    scene_id: id,
                    name,
                    description: '',
                    narrative_importance: 'Transition',
                    relevant_scene_ids: [],
                    visual_anchor_prompt: '',
                    core_lighting: '',
                    key_elements: [],
                    seed: Math.floor(Math.random() * 1000000)
                };
                set((state) => ({
                    globalContext: {
                        ...state.globalContext,
                        scenes: [...state.globalContext.scenes, newScene]
                    }
                }));
                return id;
            },

            batchQueue: [],
            addToBatchQueue: (tasks) => set((state) => {
                // Avoid duplicates: check if task with same ID and Type already exists
                const newTasks = tasks.filter(nt =>
                    !state.batchQueue.some(ot => ot.id === nt.id && ot.type === nt.type)
                );
                return { batchQueue: [...state.batchQueue, ...newTasks] };
            }),
            updateBatchTask: (id, type, updates) => set((state) => ({
                batchQueue: state.batchQueue.map((t) =>
                    (t.id === id && t.type === type) ? { ...t, ...updates } : t
                )
            })),
            removeFromBatchQueue: (id, type) => set((state) => ({
                batchQueue: state.batchQueue.filter((t) => !(t.id === id && t.type === type))
            })),
            clearBatchQueue: () => set({ batchQueue: [] }),
        }),
        {
            name: 'foundr-project-storage',
            storage: createJSONStorage(() => idbStorage),
            partialize: (state) => {
                const { batchQueue, ...rest } = state;
                return rest;
            }
        }
    )
);
