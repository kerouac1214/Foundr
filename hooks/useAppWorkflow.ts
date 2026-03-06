import { useRef } from 'react';
import { useProjectStore, INITIAL_CONTEXT } from '../store/useProjectStore';
import { useUIStore } from '../store/useUIStore';
import {
    forgeSceneDNA,
    forgeEnvironmentDNA,
    forgeCharacterDNA,
    refineShotPrompt,
    applyStyleConstitution,
    generateImagePrompt,
    generateVisualPreview,
    generateVideoForShot,
    analyzeShotInsertion,
    deriveShotsFromAnchor,
    deriveNarrativeTrinity,
    generateNarrativeGrid
} from '../services/geminiService';
import { extractAssets, generateStoryboard, structureEpisodes, partitionIntoChapters, extractGlobalAssets, refineAssetDNA } from '../services/scriptAnalysisService';
import { videoSynthesisService } from '../services/videoSynthesisService';
import { AssetDBService } from '../services/dbService';
import { StoryboardItem, Episode, ProjectStatus, ProjectMetadata, Chapter, AnalysisMode, BatchTask } from '../types';
import { generateId } from '../utils';
import JSZip from 'jszip';
import { useEffect, useCallback } from 'react';

export const useAppWorkflow = () => {
    const planningInProgressRef = useRef(false);

    // Store Access
    const {
        script,
        globalContext,
        updateGlobalContext,
        setProjectMetadata,
        setStoryboard,
        updateShot,
        updateCharacter,
        updateScene,
        updateEnvironment,
        insertShotAt,
        insertShotsBatch,
        projectMetadata,
        storyboard,
        setSelectedChapterId,
        setScript,
        updateChapter,
        batchQueue,
        addToBatchQueue,
        updateBatchTask,
        removeFromBatchQueue,
        clearBatchQueue,
        resetAssetsAndStoryboards
    } = useProjectStore();

    const {
        setIsAnalyzing,
        setProgress,
        setStatusMessage,
        setError,
        setActiveView,
        showToast,
        setBatchProgress
    } = useUIStore();

    const batchCancelledRef = useRef(false);

    const cancelBatch = () => {
        batchCancelledRef.current = true;
    };

    // Helper for error handling
    const handleError = (error: any) => {
        console.error(error);
        setIsAnalyzing(false);
        setError(error instanceof Error ? error.message : String(error));
    };

    // ========== Task Queue Worker ==========
    const processBatchQueue = async () => {
        const state = useProjectStore.getState();
        const queue = state.batchQueue;
        if (queue.length === 0 || batchCancelledRef.current) return;

        // Count currently processing tasks
        const processingCount = queue.filter(t => t.status === 'processing').length;
        const availableSlots = 3 - processingCount;

        if (availableSlots <= 0) return;

        // Find pending tasks to fill slots
        const pendingTasks = queue.filter(t => t.status === 'pending').slice(0, availableSlots);

        if (pendingTasks.length === 0 && processingCount === 0) {
            // Queue is effectively empty or all failed/done
            return;
        }

        // Start pending tasks in parallel
        pendingTasks.forEach(async (task) => {
            const currentStoryboard = useProjectStore.getState().storyboard;
            const shotIndex = currentStoryboard.findIndex(s => s.id === task.id);

            if (shotIndex === -1) {
                removeFromBatchQueue(task.id, task.type);
                processBatchQueue();
                return;
            }

            updateBatchTask(task.id, task.type, { status: 'processing' });

            try {
                if (task.type === 'photo') {
                    await renderSinglePhoto(shotIndex);
                } else {
                    await renderSingleVideo(shotIndex);
                }
                removeFromBatchQueue(task.id, task.type);
                showToast(`镜号 ${currentStoryboard[shotIndex].shot_number} ${task.type === 'photo' ? '画面' : '视频'}渲染成功`, 'success');
            } catch (err: any) {
                console.error(`Queue Task Failed:`, err);
                updateBatchTask(task.id, task.type, {
                    status: 'failed',
                    error: err.message,
                    retryCount: task.retryCount + 1
                });
            } finally {
                // When a task finishes, trigger next check
                if (!batchCancelledRef.current) {
                    processBatchQueue();
                }
            }
        });
    };

    // ========== Step 1: Analyze Script & Generate Storyboard ==========
    const handleEpisodicStructuring = async (targetScript: string): Promise<{ status: ProjectStatus, episodes: Episode[] } | null> => {
        try {
            setError(null);
            setStatusMessage('分镜规划：正在分析本集内容与其叙事结构...');
            setProgress(10);

            const result = await structureEpisodes(targetScript, globalContext.script_engine);

            setStatusMessage(`分析完成：共切分为 ${result.status.total_episodes} 集 (${result.status.division_mode === 'Original_Script_Markers' ? '遵循原著' : '智能悬念切分'})`);
            setProgress(100);

            return result;
        } catch (err: any) {
            setError(err.message || '剧集统筹失败');
            return null;
        }
    };

    const hydrateAllAssets = useCallback(async () => {
        const state = useProjectStore.getState();
        const projectId = state.projectMetadata?.id;
        if (!projectId) return;

        console.log('[Hydration] Starting full hydration for project:', projectId);
        try {
            const assets = await AssetDBService.getAllProjectAssets(projectId);
            if (assets.length === 0) {
                console.log('[Hydration] No assets to hydrate');
                return;
            }
            console.log(`[Hydration] Found ${assets.length} assets in IndexedDB`);

            // 1. Hydrate Scenes & Characters in Global Context
            const currentContext = state.globalContext;

            // Helper to safely create blob URL
            const getSafeUrl = (data: any) => {
                if (!data) return '';
                try {
                    return URL.createObjectURL(data);
                } catch (e) {
                    console.warn('[Hydration] createObjectURL failed', e);
                    return '';
                }
            };

            const updatedScenes = currentContext.scenes.map(scene => {
                const asset = assets.find(a => a.id === `scene_${scene.scene_id}`);
                return asset ? { ...scene, preview_url: getSafeUrl(asset.data) } : scene;
            });

            const updatedChars = currentContext.characters.map(char => {
                const asset = assets.find(a => a.id === `char_${char.char_id}`);
                return asset ? { ...char, preview_url: getSafeUrl(asset.data) } : char;
            });

            updateGlobalContext({ scenes: updatedScenes, characters: updatedChars });

            // 2. Hydrate Storyboard
            const currentStoryboard = state.storyboard;
            const hydratedStoryboard = await Promise.all(currentStoryboard.map(async (item) => {
                const photoAsset = assets.find(a => a.id === AssetDBService.getDeterministicId('photo', item.id))
                    || assets.find(a => a.id === `shot_${item.id}`);
                const videoAsset = assets.find(a => a.id === AssetDBService.getDeterministicId('video', item.id));

                const hydratedCandidates = await Promise.all((item.candidate_image_urls || []).map(async (existingUrl, i) => {
                    const candId = AssetDBService.getDeterministicId('candidate', item.id, i);
                    const candAsset = assets.find(a => a.id === candId);
                    return candAsset ? getSafeUrl(candAsset.data) : existingUrl;
                }));

                return {
                    ...item,
                    preview_url: photoAsset ? getSafeUrl(photoAsset.data) : item.preview_url,
                    video_url: videoAsset ? getSafeUrl(videoAsset.data) : item.video_url,
                    candidate_image_urls: hydratedCandidates.filter((u): u is string => u !== null)
                };
            }));

            setStoryboard(hydratedStoryboard);
            console.log('[Hydration] Full hydration completed');
        } catch (err) {
            console.error('[Hydration] Failed:', err);
        }
    }, [updateGlobalContext, setStoryboard, projectMetadata?.id]);

    // Auto-resume queue if tasks exist
    useEffect(() => {
        if (batchQueue.some(t => t.status === 'pending' || t.status === 'processing')) {
            // If they were 'processing', reset to 'pending' to ensure they actually run
            const tasksToReset = batchQueue.filter(t => t.status === 'processing');
            tasksToReset.forEach(t => updateBatchTask(t.id, t.type, { status: 'pending' }));

            console.log('[Queue] Auto-resuming batch queue...');
            processBatchQueue();
        }
    }, []); // Only on mount

    const handleGenerateStoryboard = async (chapterId?: string) => {
        const targetScript = chapterId
            ? projectMetadata?.chapters?.find(c => c.id === chapterId)?.content
            : script;

        if (!targetScript) {
            showToast('未检测到剧本内容，请重试或检查输入', 'error');
            return;
        }

        try {
            setIsAnalyzing(true);
            setError(null);

            // Check for cached storyboard in background planning
            const currentChapter = projectMetadata?.chapters?.find(c => c.id === chapterId);
            if (currentChapter?.storyboard && currentChapter.storyboard.length > 0) {
                console.log(`[Storyboard] Using cached background planning for Chapter: ${currentChapter.title}`);
                setStoryboard(currentChapter.storyboard);
                setIsAnalyzing(false);
                setActiveView('storyboard');
                return;
            }

            // Step 1: Episodic Structuring (Existing logic)
            console.log('[Storyboard] Step 1: Episodic structuring...');
            const episodicData = await handleEpisodicStructuring(targetScript);

            if (!episodicData) {
                setIsAnalyzing(false);
                showToast('剧集统筹分析失败，请检查剧本内容后重试', 'error');
                return;
            }
            console.log('[Storyboard] Step 1 OK:', episodicData.status);

            // Step 2: Extract Assets (Use Global if available, else local)
            let characters = globalContext.characters;
            let scenes = globalContext.scenes;

            if (characters.length === 0 || scenes.length === 0) {
                console.log('[Storyboard] Step 2: Extracting local assets...');
                setStatusMessage('正在提取分集资产...');
                const localAssets = await extractAssets(script, globalContext, globalContext.script_engine);
                characters = localAssets.characters;
                scenes = localAssets.scenes;
                console.log(`[Storyboard] Step 2 OK: ${characters.length} chars, ${scenes.length} scenes`);
            } else {
                console.log(`[Storyboard] Step 2: Using global assets (${characters.length} chars, ${scenes.length} scenes)`);
                setStatusMessage('正在加载全局资产一致性锚点...');
            }

            // Step 3: Generate Storyboard
            setStatusMessage('导演视角：正在规划分镜脚本与制片参数...');
            setProgress(60);

            // Add Chapter context if available
            let enrichedScript = targetScript;
            const chapter = projectMetadata?.chapters?.find(c => c.id === chapterId);
            if (chapter) {
                enrichedScript = `[CHAPTER CONTEXT: ${chapter.title}]\nSummary: ${chapter.summary}\n\nScript:\n${targetScript}`;
            }

            console.log('[Storyboard] Step 3: Generating storyboard...');
            const result = await generateStoryboard(enrichedScript, characters, scenes, globalContext.script_engine);
            const metadata = result?.metadata || {};
            const initial_script = Array.isArray(result?.initial_script) ? result.initial_script : [];

            console.log(`[Storyboard] Step 3 Result: ${initial_script.length} shots returned`);

            if (initial_script.length === 0) {
                console.error('[Storyboard] Failed: No shots returned by AI');
                showToast('AI 未能生成分镜脚本，可能是剧本太短、格式不符或当前 API 响应异常。请检查剧本或更换模型后重试。', 'error');
                setIsAnalyzing(false);
                return;
            }

            // Merge Episodic Data into Metadata
            const finalMetadata: ProjectMetadata = {
                ...projectMetadata,   // Preserve chapters, full_script, analysis_mode, name, etc.
                ...metadata,          // Let AI-returned fields override
                id: projectMetadata?.id || generateId(),
                analysis_mode: projectMetadata?.analysis_mode || 'Single_Episode',
                status: episodicData.status,
                episodes: episodicData.episodes,
                chapters: projectMetadata?.chapters || [],
            };

            setProjectMetadata(finalMetadata);
            setStoryboard(initial_script.map((item: any, idx: number) => {
                // Failsafe: If scene_id is a name instead of ID, try to find the ID
                let resolvedSceneId = item.scene_id;
                if (resolvedSceneId && !scenes.some(s => s.scene_id === resolvedSceneId)) {
                    const match = scenes.find(s => s.name === resolvedSceneId || s.name?.includes(resolvedSceneId));
                    if (match) resolvedSceneId = match.scene_id;
                }

                return {
                    ...item,
                    id: generateId(),
                    shot_number: idx + 1,
                    scene_id: resolvedSceneId,
                    timestamp: '00:00:00',
                    duration: 3,
                    video_status: 'idle',
                    render_status: 'idle',
                    seed: Math.floor(Math.random() * 1000000)
                };
            }));

            // Always update global context to ensure Assets tab matches the storyboard
            updateGlobalContext({
                characters: characters.map((c: any) => ({
                    ...c,
                    is_anchored: false,
                    physical_core: c.physical_core || { gender_age: '', facial_features: '', hair_style: '', distinguishing_marks: '' },
                    costume_id: c.costume_id || { top: '', bottom: '', accessories: '' },
                    // PRESERVE extraction prompts — do NOT clear them!
                    consistency_seed_prompt: c.consistency_seed_prompt || '',
                    seed: c.seed || Math.floor(Math.random() * 1000000)
                })),
                scenes: scenes.map((s: any) => ({
                    ...s,
                    is_anchored: false,
                    // PRESERVE extraction prompts — do NOT clear them!
                    visual_anchor_prompt: s.visual_anchor_prompt || '',
                    seed: s.seed || Math.floor(Math.random() * 1000000)
                }))
            });

            setStatusMessage('准备就绪');
            setProgress(100);
            setActiveView('storyboard');
            showToast('分镜脚本与剧集架构已生成', 'success');
        } catch (err: any) {
            console.error('[Storyboard] FAILED:', err);
            setError(err.message || '分镜生成失败，请检查 AI 引擎配置或重试');
            showToast(`分镜生成失败: ${err.message || '未知错误'}`, 'error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleFullScriptAnalysis = async () => {
        // CRITICAL: Always read the freshest script directly from the store,
        // not from the hook's potentially stale closure.
        const freshScript = useProjectStore.getState().script;

        if (!freshScript || freshScript.trim().length === 0) {
            console.warn('[Full Analysis] Failed: script is empty or whitespace only.');
            showToast('未检测到有效剧本内容。请在左侧编辑器中输入全剧本后再点击“全剧架构分析”。', 'error');
            return;
        }

        // Clear chapter selection so the ScriptEditor shows the full script,
        // not a single chapter, after analysis completes.
        setSelectedChapterId(null);

        try {
            // CRITICAL: Capture the fresh script before clearing the state
            const freshScriptForAnalysis = freshScript;

            // Step 0: Clear previous state to prevent pollution
            console.log('[Full Analysis] Step 0: Resetting project state...');
            const { resetProject, setScript } = useProjectStore.getState();
            resetProject();

            // CRITICAL: Restore the script immediately so it doesn't disappear from the editor
            setScript(freshScriptForAnalysis);

            setIsAnalyzing(true);
            setError(null);
            setStatusMessage('Step 1 / 全剧架构分析：正在进行章节切分...');
            setProgress(10);

            // Step 1 ONLY: Partition Chapters
            console.log('[Full Analysis] Step 1: Partitioning Chapters...');
            const result = await partitionIntoChapters(freshScriptForAnalysis, INITIAL_CONTEXT.script_engine);
            const chapters = Array.isArray(result) ? result : [];

            console.log('[Full Analysis] Step 1 Result:', chapters.length, 'chapters found');

            if (chapters.length === 0) {
                console.error('[Full Analysis] Failed: No chapters returned by AI');
                showToast('章节切分失败：AI 未返回有效章节。可能是剧本太短，或当前模型 API 响应异常，请尝试更换模型。', 'error');
                setIsAnalyzing(false);
                return;
            }

            // Initialize Project Metadata (Chapter structure only, no assets yet)
            const finalMetadata: ProjectMetadata = {
                id: generateId(), // Force NEW project ID for fresh analysis
                name: projectMetadata?.name || '未命名项目',
                full_script: freshScript,
                analysis_mode: 'Full_Script',
                bpm: 120,
                energy_level: 'Medium',
                overall_mood: 'Neural',
                chapters: chapters.map(c => ({
                    ...c,
                    id: c.id || generateId(),
                    title: c.title || '未命名章节',
                    content: c.content || ''
                })),
                transitions: []
            };

            // Clear previous state to prevent pollution
            setStoryboard([]);
            updateGlobalContext({ characters: [], scenes: [] });
            clearBatchQueue();

            setProjectMetadata(finalMetadata);

            setStatusMessage(`架构分析完成：共切分为 ${chapters.length} 个章节`);
            setProgress(100);
            setActiveView('episodes');
            showToast(`全剧已切分为 ${chapters.length} 个章节。请进入 Step 2 提取角色与场景资产。`, 'success');
        } catch (err: any) {
            setError(err.message || '全剧分析失败');
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Orchestrated Generation: Reset -> Extract -> Foundry -> Background Planning
    const handleOrchestratedGeneration = async (chapterId: string) => {
        setSelectedChapterId(chapterId);

        console.log('[Orchestrated] User requested fresh storyboard. Resetting all assets and storyboards...');

        // 1. Force reset existing assets and storyboards to ensure absolute consistency
        resetAssetsAndStoryboards();

        // 2. Always trigger Step 2 extraction as requested by the user, but skip the full background loop
        console.log('[Orchestrated] Starting fresh Step 2 extraction...');
        await handleExtractAssets({ skipBackground: true });

        // 3. Move to Foundry as requested
        setActiveView('foundry');

        // 4. Initiate background planning ONLY for this chapter
        // Background planning happens silently
        initiateBackgroundPlanning(chapterId, true);
    };

    // ========== Step 2: Extract & Forge Assets ==========
    const handleExtractAssets = async (options?: { skipBackground?: boolean }) => {
        if (!script) return;
        setIsAnalyzing(true);
        setStatusMessage('Step 2 / 资产提取：正在扫描全剧本提取角色与场景...');
        setProgress(5);

        try {
            const result = await extractAssets(script, globalContext, globalContext.script_engine);
            const charDrafts = result?.characters || [];
            const sceneDrafts = result?.scenes || [];

            // DEBUG: Log extraction results
            console.log('[Extract] Characters:', (charDrafts || []).map((c: any) => ({
                name: c?.name || 'Unknown',
                has_prompt: !!c?.consistency_seed_prompt,
                prompt_len: (c?.consistency_seed_prompt || '').length,
                prompt_preview: (c?.consistency_seed_prompt || '').substring(0, 80)
            })));
            console.log('[Extract] Scenes:', (sceneDrafts || []).map((s: any) => ({
                name: s?.name || 'Unknown',
                has_prompt: !!s?.visual_anchor_prompt,
                prompt_len: (s?.visual_anchor_prompt || '').length,
                prompt_preview: (s?.visual_anchor_prompt || '').substring(0, 80)
            })));

            // Initialize store with all drafts immediately so they are visible with initial prompts
            updateGlobalContext({
                characters: charDrafts || [],
                scenes: sceneDrafts || []
            });

            // 1. Forge Scenes in Parallel
            setStatusMessage(`正在并发设计 ${sceneDrafts.length} 个场景资产...`);
            setProgress(15);
            const scenePromises = (sceneDrafts || []).map(async (draft: any, i: number) => {
                try {
                    const dna = await forgeSceneDNA(draft, globalContext);
                    console.log(`[Parallel Forge] Scene OK: ${draft.name}`);
                    return dna;
                } catch (err) {
                    console.error(`场景 ${draft.name} 生成失败`, err);
                    return draft; // Fallback to draft
                }
            });
            const forgedScenes = await Promise.all(scenePromises);
            updateGlobalContext({ scenes: forgedScenes });
            setProgress(40);

            // 2. Forge Characters in Parallel
            setStatusMessage(`正在并发锻造 ${charDrafts.length} 个角色资产...`);
            const charPromises = (charDrafts || []).map(async (draft: any, i: number) => {
                try {
                    const dna = await forgeCharacterDNA(draft, globalContext);
                    console.log(`[Parallel Forge] Character OK: ${draft.name}`);
                    return dna;
                } catch (err: any) {
                    console.error(`角色 ${draft.name} DNA 生成失败:`, err);
                    return draft; // Fallback to draft
                }
            });
            const forgedChars = await Promise.all(charPromises);
            updateGlobalContext({ characters: forgedChars });
            setProgress(80);

            // === FALLBACK: Auto-build visual DNA for any asset missing prompts ===
            const finalScenes = forgedScenes.map((s: any) => {
                if (!s.visual_anchor_prompt || s.visual_anchor_prompt.length < 10) {
                    // Build a prompt from available extraction data
                    const parts = [
                        s.name ? `Scene: ${s.name}` : '',
                        s.core_lighting ? `Lighting: ${s.core_lighting}` : '',
                        s.description ? s.description : '',
                        s.key_elements?.length ? `Key elements: ${s.key_elements.join(', ')}` : '',
                        globalContext.visual_style_preset ? `Style: ${globalContext.visual_style_preset}` : '',
                        'cinematic wide shot, masterpiece, 4k, ultra-detailed'
                    ].filter(Boolean).join(', ');
                    console.log(`[Fallback] Built scene prompt for ${s.name}: ${parts.substring(0, 80)}...`);
                    return { ...s, visual_anchor_prompt: parts };
                }
                return s;
            });

            const finalChars = forgedChars.map((c: any) => {
                if (!c.consistency_seed_prompt || c.consistency_seed_prompt.length < 10) {
                    // Build a JSON prompt from available extraction data
                    const fallbackDNA = {
                        "Instruction_Role": "Master Character Designer & Concept Architect",
                        "Identity_Consistency_Protocol": {
                            "Target_Subject": `${c.description || c.name}`,
                            "Identity_Lock": "Mandatory 100% facial and costume consistency across all views.",
                            "Core_Elements": `${c.outfit || ''} ${c.physical_traits || ''}`
                        },
                        "Visual_Style_Module": {
                            "Style_Definition": globalContext.visual_style_preset || "cinematic",
                            "Rendering_Specifics": "16:9 aspect ratio, 4k, ultra-detailed, soft cinematic lighting",
                            "Background": "Solid neutral grey studio background"
                        }
                    };
                    const prompt = JSON.stringify(fallbackDNA, null, 2);
                    console.log(`[Fallback] Built character prompt for ${c.name}: ${prompt.substring(0, 80)}...`);
                    return { ...c, consistency_seed_prompt: prompt };
                }
                return c;
            });

            // Final update to ensure consistency
            updateGlobalContext({ characters: finalChars, scenes: finalScenes });

            setIsAnalyzing(false);
            setActiveView('foundry');
            showToast('资产提取与绘制完成', 'success');

        } catch (err) {
            handleError(err);
        } finally {
            // Trigger background planning for all chapters silently if not skipped
            if (!options?.skipBackground) {
                initiateBackgroundPlanning();
            }
        }
    };

    const initiateBackgroundPlanning = async (priorityChapterId?: string, onlyThisChapter: boolean = false) => {
        const metadata = useProjectStore.getState().projectMetadata;
        if (!metadata || !metadata.chapters || metadata.chapters.length === 0) return;

        // Prevent multiple concurrent planning loops
        if (planningInProgressRef.current) {
            console.log('[Background Planning] Loop already running. Priority update ignored but will be picked up.');
            return;
        }

        planningInProgressRef.current = true;
        console.log('[Background Planning] Starting for', metadata.chapters.length, 'chapters', priorityChapterId ? `(Priority: ${priorityChapterId})` : '');

        try {
            // Create a sorted list based on priority
            const remainingChapters = onlyThisChapter && priorityChapterId
                ? metadata.chapters.filter(c => c.id === priorityChapterId)
                : [...metadata.chapters];

            if (!onlyThisChapter && priorityChapterId) {
                const pIdx = remainingChapters.findIndex(c => c.id === priorityChapterId);
                if (pIdx > -1) {
                    const [priority] = remainingChapters.splice(pIdx, 1);
                    remainingChapters.unshift(priority);
                }
            }

            // Process chapters sequentially in background to avoid overwhelming the API
            for (const chapter of remainingChapters) {
                const state = useProjectStore.getState();
                const liveChapter = state.projectMetadata?.chapters?.find(c => c.id === chapter.id);

                // Skip if already planned or currently planning (unless it's the priority one we just forced)
                if (!liveChapter || (liveChapter.storyboard && liveChapter.storyboard.length > 0) || liveChapter.is_planning) {
                    continue;
                }

                updateChapter(chapter.id, { is_planning: true });

                try {
                    const targetScript = chapter.content;
                    const enrichedScript = `[CHAPTER CONTEXT: ${chapter.title}]\nSummary: ${chapter.summary}\n\nScript:\n${targetScript}`;

                    console.log(`[Background Planning] Processing: ${chapter.title}`);
                    const result = await generateStoryboard(
                        enrichedScript,
                        state.globalContext.characters,
                        state.globalContext.scenes,
                        state.globalContext.script_engine
                    );

                    const initial_script = Array.isArray(result?.initial_script) ? result.initial_script : [];
                    if (initial_script.length > 0) {
                        updateChapter(chapter.id, {
                            storyboard: initial_script,
                            is_planning: false
                        });
                        console.log(`[Background Planning] Chapter ${chapter.title} OK: ${initial_script.length} shots`);
                    } else {
                        updateChapter(chapter.id, { is_planning: false });
                    }
                } catch (err) {
                    console.error(`[Background Planning] Chapter ${chapter.title} failed:`, err);
                    updateChapter(chapter.id, { is_planning: false });
                }
            }
        } finally {
            planningInProgressRef.current = false;
            console.log('[Background Planning] Completed all chapters.');
        }
    };

    // ========== Step 3: Render Asset Previews ==========
    const handleRenderAssets = async () => {
        setIsAnalyzing(true);
        setStatusMessage('准备渲染资产预览...');
        setProgress(0);

        try {
            if (globalContext.environment && !globalContext.environment.preview_url) {
                setStatusMessage('正在渲染环境概念图...');
                const url = await generateVisualPreview(
                    globalContext.image_engine === 'qwen2512' ? 'nb2' : globalContext.image_engine,
                    `${globalContext.environment.visual_anchor_prompt}, cinematic wide shot, masterpiece`,
                    Math.floor(Math.random() * 1000000),
                    '16:9',
                    globalContext.environment.preview_url ? [globalContext.environment.preview_url] : undefined
                );
                const dbUrl = await AssetDBService.saveAsset(
                    'env_preview',
                    projectMetadata?.id || 'default',
                    'image',
                    url
                );
                updateEnvironment({ preview_url: dbUrl });
            }

            const chars = globalContext.characters;
            for (let i = 0; i < chars.length; i++) {
                const char = chars[i];
                if (char.preview_url) continue;

                setStatusMessage(`渲染角色预览: ${char.name} (${i + 1}/${chars.length})...`);
                setProgress(Math.floor(((i + 1) / chars.length) * 100));

                try {
                    const url = await generateVisualPreview(
                        globalContext.image_engine === 'qwen2512' ? 'nb2' : globalContext.image_engine,
                        `Character Portrait: ${char.consistency_seed_prompt}, ${globalContext.visual_style_preset}`,
                        char.seed,
                        '16:9',
                        char.reference_image_url ? [char.reference_image_url] : undefined
                    );
                    const dbUrl = await AssetDBService.saveAsset(
                        `char_${char.char_id}`,
                        projectMetadata?.id || 'default',
                        'image',
                        url
                    );
                    updateCharacter(char.char_id, { preview_url: dbUrl });
                } catch (err) {
                    console.error(err);
                }
            }

            setIsAnalyzing(false);
            setActiveView('images');
            showToast('资产预览渲染完成', 'success');

        } catch (err) {
            handleError(err);
        }
    };

    const reRenderSpecificCharacter = async (charId: string, customPrompt?: string) => {
        const char = globalContext.characters.find(c => c.char_id === charId);
        if (!char) return;

        showToast(`正在重新渲染 ${char.name}...`, 'info');
        try {
            const prompt = customPrompt || applyStyleConstitution(`Character Portrait: ${char.consistency_seed_prompt}`, globalContext);
            const url = await generateVisualPreview(
                globalContext.image_engine === 'qwen2512' ? 'nb2' : globalContext.image_engine,
                prompt,
                Math.floor(Math.random() * 1000000),
                '16:9',
                char.reference_image_url ? [char.reference_image_url] : undefined
            );
            const dbUrl = await AssetDBService.saveAsset(
                `char_${charId}`,
                projectMetadata?.id || 'default',
                'image',
                url
            );
            updateCharacter(charId, { preview_url: dbUrl });
            showToast('渲染完成', 'success');
        } catch (err: any) {
            showToast(`渲染失败: ${err.message}`, 'error');
            console.error(err);
        }
    };

    const reRenderSpecificScene = async (sceneId: string, customPrompt?: string) => {
        const scene = globalContext.scenes.find(s => s.scene_id === sceneId);
        if (!scene) return;

        showToast(`正在重新渲染场景: ${scene.name}...`, 'info');
        try {
            const prompt = customPrompt || applyStyleConstitution(`${scene.visual_anchor_prompt}, cinematic wide shot`, globalContext);
            const url = await generateVisualPreview(
                globalContext.image_engine === 'qwen2512' ? 'nb2' : globalContext.image_engine,
                prompt,
                Math.floor(Math.random() * 1000000),
                '16:9',
                scene.reference_image_url ? [scene.reference_image_url] : undefined
            );
            const dbUrl = await AssetDBService.saveAsset(
                `scene_${sceneId}`,
                projectMetadata?.id || 'default',
                'image',
                url
            );
            updateScene(sceneId, { preview_url: dbUrl });
            showToast('场景渲染完成', 'success');
        } catch (err: any) {
            showToast(`场景渲染失败: ${err.message}`, 'error');
            console.error(err);
        }
    };

    const generateAllAssets = async () => {
        const scenes = globalContext.scenes;
        const chars = globalContext.characters;
        const total = scenes.length + chars.length;
        let done = 0;
        let failedCount = 0;

        showToast(`开始生成全部资产 (${total} 项)...`, 'info');

        // Render scenes first
        for (const scene of scenes) {
            if (scene.preview_url) { done++; continue; }
            try {
                showToast(`渲染场景: ${scene.name} (${done + 1}/${total})...`, 'info');
                const url = await generateVisualPreview(
                    globalContext.image_engine === 'qwen2512' ? 'nb2' : globalContext.image_engine,
                    `${scene.visual_anchor_prompt}, cinematic wide shot, masterpiece`,
                    Math.floor(Math.random() * 1000000),
                    '16:9',
                    scene.reference_image_url ? [scene.reference_image_url] : undefined
                );
                const dbUrl = await AssetDBService.saveAsset(
                    `scene_${scene.scene_id}`,
                    projectMetadata?.id || 'default',
                    'image',
                    url
                );
                updateScene(scene.scene_id, { preview_url: dbUrl });
            } catch (err: any) {
                console.error(`Scene ${scene.name} render failed`, err);
                showToast(`场景 ${scene.name} 生成失败: ${err.message || '未知错误'}`, 'error');
                failedCount++;
            }
            done++;
        }

        // Then characters
        for (const char of chars) {
            if (char.preview_url) { done++; continue; }
            try {
                showToast(`渲染角色: ${char.name} (${done + 1}/${total})...`, 'info');
                const url = await generateVisualPreview(
                    globalContext.image_engine === 'qwen2512' ? 'nb2' : globalContext.image_engine,
                    `Character Portrait: ${char.consistency_seed_prompt}, ${globalContext.visual_style_preset}`,
                    char.seed,
                    '16:9',
                    char.reference_image_url ? [char.reference_image_url] : undefined
                );
                const dbUrl = await AssetDBService.saveAsset(
                    `char_${char.char_id}`,
                    projectMetadata?.id || 'default',
                    'image',
                    url
                );
                updateCharacter(char.char_id, { preview_url: dbUrl });
            } catch (err: any) {
                console.error(`Character ${char.name} render failed`, err);
                showToast(`角色 ${char.name} 生成失败: ${err.message || '未知错误'}`, 'error');
                failedCount++;
            }
            done++;
        }

        if (failedCount > 0) {
            showToast(`资产生成完成，但有 ${failedCount} 项失败。`, 'info');
        } else {
            showToast('全部资产生成完成！', 'success');
        }
    };


    const handleRefineDNA = async (name: string, description: string, type: 'character' | 'scene', assetId: string) => {
        try {
            showToast('正在提炼视觉 DNA...', 'info');
            const asset = type === 'character' ?
                globalContext.characters.find(c => c.char_id === assetId) :
                globalContext.scenes.find(s => s.scene_id === assetId);

            const referenceImage = asset?.reference_image_url;

            const newDNA = await refineAssetDNA(
                name,
                description,
                type,
                globalContext,
                referenceImage
            );

            if (type === 'character') {
                updateCharacter(assetId, { consistency_seed_prompt: newDNA });
                showToast('角色 DNA 已更新，正在重新生成预览...', 'info');
                await reRenderSpecificCharacter(assetId);
            } else {
                updateScene(assetId, { visual_anchor_prompt: newDNA });
                showToast('场景 DNA 已更新，正在重新生成预览...', 'info');
                await reRenderSpecificScene(assetId);
            }
        } catch (err: any) {
            showToast(`DNA 提炼失败: ${err.message}`, 'error');
            console.error(err);
        }
    };

    // ========== Step 4: Storyboard Rendering ==========

    const renderSinglePhoto = async (index: number) => {
        const item = storyboard[index];
        if (!item) return;

        updateShot(item.id, { render_status: 'rendering' });
        try {
            const scene = globalContext.scenes.find(s => s.scene_id === item.scene_id);
            // PRIORITIZE MANUAL PROMPT: Use item.image_prompt if edited by user, 
            // otherwise use a previously generated one, or generate a new one.
            const prompt = item.image_prompt || item.ai_prompts?.image_generation_prompt || await generateImagePrompt(item, globalContext.characters, scene, globalContext.environment, globalContext);

            // Build reference images for RunningHub (Prioritize Confirmed Reference over Preview)
            const refImages: string[] = [];
            if (globalContext.image_engine === 'runninghub' || globalContext.image_engine === 'nb2' || globalContext.image_engine === 'qwen2512') {
                globalContext.characters.forEach(c => {
                    if (item.character_ids?.includes(c.char_id)) {
                        const bestRef = c.reference_image_url || c.preview_url;
                        if (bestRef) refImages.push(bestRef);
                    }
                });
                const sceneRef = scene?.reference_image_url || scene?.preview_url;
                if (sceneRef) {
                    refImages.push(sceneRef);
                }
            }
            const url = await generateVisualPreview(
                globalContext.image_engine,
                prompt,
                item.seed,
                (globalContext.image_engine === 'nb2' || globalContext.image_engine === 'runninghub') ? '9:16' : globalContext.aspect_ratio,
                refImages.length > 0 ? refImages : undefined
            );

            // Save finalized photo to DB with deterministic ID
            const photoId = AssetDBService.getDeterministicId('photo', item.id);
            const dbUrl = await AssetDBService.saveAsset(
                photoId,
                projectMetadata?.id || 'default',
                'image',
                url
            );

            const newCandidates = [...(item.candidate_image_urls || []), dbUrl];

            updateShot(item.id, {
                preview_url: item.isImageLocked ? item.preview_url : dbUrl,
                candidate_image_urls: newCandidates,
                render_status: 'done',
                image_prompt: prompt
            });
        } catch (err: any) {
            updateShot(item.id, { render_status: 'idle' });
            showToast(`镜头 ${item.shot_number} 渲染失败: ${err.message}`, 'error');
            throw err;
        }
    };

    const renderCandidates = async (index: number, count: number = 4) => {
        const item = storyboard[index];
        if (!item) return;

        updateShot(item.id, { render_status: 'rendering' });
        try {
            const scene = globalContext.scenes.find(s => s.scene_id === item.scene_id);
            const prompt = item.image_prompt || item.ai_prompts?.image_generation_prompt || await generateImagePrompt(item, globalContext.characters, scene, globalContext.environment, globalContext);

            // Build reference images (Prioritize Confirmed Reference over Preview)
            const refImages: string[] = [];
            if (globalContext.image_engine === 'runninghub' || globalContext.image_engine === 'nb2' || globalContext.image_engine === 'qwen2512') {
                globalContext.characters.forEach(c => {
                    if (item.character_ids?.includes(c.char_id)) {
                        const bestRef = c.reference_image_url || c.preview_url;
                        if (bestRef) refImages.push(bestRef);
                    }
                });
                const sceneRef = scene?.reference_image_url || scene?.preview_url;
                if (sceneRef) refImages.push(sceneRef);
            }

            // For candidates, we generate a batch with different seeds
            const promises = Array.from({ length: count }).map((_, i) => {
                const seed = (item.seed || 12345) + (i * 100);
                return generateVisualPreview(
                    globalContext.image_engine,
                    prompt,
                    seed,
                    (globalContext.image_engine === 'nb2' || globalContext.image_engine === 'runninghub') ? '9:16' : globalContext.aspect_ratio,
                    refImages.length > 0 ? refImages : undefined
                );
            });

            const urls = await Promise.all(promises);
            // Save candidates to DB with deterministic IDs
            const dbUrls = await Promise.all(urls.map((url, i) => {
                const candId = AssetDBService.getDeterministicId('candidate', item.id, i);
                return AssetDBService.saveAsset(
                    candId,
                    projectMetadata?.id || 'default',
                    'candidate',
                    url
                );
            }));

            const newCandidates = [...(item.candidate_image_urls || []), ...dbUrls];

            updateShot(item.id, {
                candidate_image_urls: newCandidates,
                preview_url: item.isImageLocked ? item.preview_url : dbUrls[0], // Set the first new one as default if not locked
                render_status: 'done',
                image_prompt: prompt
            });
            showToast(`已生成 ${count} 个候选帧`, 'success');
        } catch (err: any) {
            updateShot(item.id, { render_status: 'idle' });
            showToast(`候选帧渲染失败: ${err.message}`, 'error');
        }
    };

    const renderSingleVideo = async (index: number) => {
        const item = storyboard[index];
        if (!item || !item.preview_url) {
            showToast('请先生成预览图', 'error');
            return;
        }

        updateShot(item.id, { video_status: 'generating' });
        try {
            const scene = globalContext.scenes.find(s => s.scene_id === item.scene_id);

            // Use pre-generated video prompt from storyboard breakdown if available,
            // otherwise fall back to LLM image prompt generation.
            // Use manual video prompt if edited, otherwise fall back to AI generated ones
            let prompt: string;
            if (item.video_prompt) {
                prompt = item.video_prompt;
            } else if (item.ai_prompts?.video_generation_prompt) {
                prompt = item.ai_prompts.video_generation_prompt;
            } else {
                prompt = await generateImagePrompt(item, globalContext.characters, scene, globalContext.environment, globalContext);
            }

            // Engine priority: Item Specific > Lyric Aware Default > Global Context > Hardcoded Default
            let videoEngine = item.video_engine;
            if (!videoEngine) {
                videoEngine = item.lyric_line ? 'seedance_1_5' : (globalContext.video_engine || 'wan2_2');
            }

            const url = await generateVideoForShot(prompt, (globalContext.image_engine === 'nb2' || globalContext.image_engine === 'runninghub') ? '9:16' : globalContext.aspect_ratio, videoEngine, item.preview_url);

            // Save video clip to DB with deterministic ID
            const videoId = AssetDBService.getDeterministicId('video', item.id);
            const dbUrl = await AssetDBService.saveAsset(
                videoId,
                projectMetadata?.id || 'default',
                'video',
                url
            );

            updateShot(item.id, { video_url: dbUrl, video_status: 'ready', image_prompt: prompt });
        } catch (err: any) {
            updateShot(item.id, { video_status: 'idle' });
            showToast(`分镜 ${item.shot_number} 视频生成失败: ${err.message}`, 'error');
            throw err;
        }
    };

    const batchRenderAllPhotos = async () => {
        if (storyboard.length === 0) return;

        const pendingShots = storyboard.filter(s => !s.isLocked && !s.preview_url);
        if (pendingShots.length === 0) {
            showToast('所有内容已生产或被锁定', 'info');
            return;
        }

        const tasks: BatchTask[] = pendingShots.map(s => ({
            id: s.id,
            type: 'photo',
            status: 'pending',
            retryCount: 0,
            addedTime: Date.now()
        }));

        addToBatchQueue(tasks);
        batchCancelledRef.current = false;
        processBatchQueue();
        showToast(`已添加 ${tasks.length} 个画面渲染任务到队列`, 'success');
    };

    const batchRenderAllVideos = async () => {
        if (storyboard.length === 0) return;

        const pendingShots = storyboard.filter(s => !s.isLocked && s.preview_url && !s.video_url);
        if (pendingShots.length === 0) {
            showToast('没有可生成的视频任务', 'info');
            return;
        }

        const tasks: BatchTask[] = pendingShots.map(s => ({
            id: s.id,
            type: 'video',
            status: 'pending',
            retryCount: 0,
            addedTime: Date.now()
        }));

        addToBatchQueue(tasks);
        batchCancelledRef.current = false;
        processBatchQueue();
        showToast(`已添加 ${tasks.length} 个视频合成任务到队列`, 'success');
    };

    const handleMasterSynthesis = async () => {
        const readyShots = storyboard.filter(s => s.video_url);
        if (readyShots.length === 0) {
            showToast('请先生成分镜视频', 'error');
            return;
        }

        setIsAnalyzing(true);
        setStatusMessage('正在初始化视频引擎...');
        setProgress(5);

        try {
            let currentProg = 5;
            const masterBlob = await videoSynthesisService.synthesize(storyboard, (msg) => {
                setStatusMessage(`母带合成: ${msg}`);
                // Simple progress increment
                currentProg = Math.min(currentProg + 2, 95);
                setProgress(currentProg);
            });

            setStatusMessage('正在打包工程备份...');
            const zip = new JSZip();

            // 1. Add Video
            zip.file(`Foundr_Master_${Date.now()}.mp4`, masterBlob);

            // 2. Add Project Metadata & Storyboard (Backup)
            const backupData = {
                projectMetadata,
                globalContext,
                storyboard,
                exportTime: new Date().toISOString(),
                version: '1.1'
            };
            zip.file('project_backup.json', JSON.stringify(backupData, null, 2));

            // 3. Generate ZIP container
            const content = await zip.generateAsync({ type: 'blob' });
            const zipUrl = URL.createObjectURL(content);

            setIsAnalyzing(false);
            setProgress(100);

            // Create a temporary link to download
            const link = document.createElement('a');
            link.href = zipUrl;
            link.download = `Foundr_Project_Package_${Date.now()}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showToast('母带合成与工程备份已打包下载', 'success');
        } catch (err) {
            handleError(err);
        }
    };

    const handleInsertShot = async (index: number, description: string) => {
        if (!description.trim()) return;

        // We use a brief loading state for the AI analysis
        setIsAnalyzing(true);
        setStatusMessage('AI 导演正在分析新分镜...');

        try {
            // 1. AI Analysis of the description to get scene/shot properties
            const newShot = await analyzeShotInsertion(description, globalContext, storyboard);

            // 2. Insert into Store
            insertShotAt(index, newShot);

            showToast('新分镜已插入，您可以手动触发渲染', 'success');
        } catch (err: any) {
            console.error('Insert shot failed', err);
            showToast(`插入分镜失败: ${err.message}`, 'error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleDeriveShots = async (anchorShot: StoryboardItem) => {
        setIsAnalyzing(true);
        setStatusMessage('AI 导演正在推导前后关联分镜...');
        try {
            const derivedShots = await deriveShotsFromAnchor(anchorShot, script, globalContext);
            if (!derivedShots || derivedShots.length === 0) {
                throw new Error('AI 推导返回结果为空');
            }

            const anchorIndex = storyboard.findIndex(s => s.id === anchorShot.id);
            if (anchorIndex === -1) return;

            const prevShots = derivedShots.slice(0, 2);
            const nextShots = derivedShots.slice(2, 4);

            insertShotsBatch(anchorIndex + 1, nextShots);
            insertShotsBatch(anchorIndex, prevShots);

            const allNewShots = [...prevShots, ...nextShots];

            // Add to Background Queue
            const tasks: BatchTask[] = allNewShots.map(shot => ({
                id: shot.id,
                type: 'photo',
                status: 'pending',
                retryCount: 0,
                addedTime: Date.now()
            }));
            addToBatchQueue(tasks);

            showToast('已推导并补充 4 个关联分镜，正在后台批量绘制...', 'success');

            // Unlock UI immediately
            setIsAnalyzing(false);

            // Start processing queue
            processBatchQueue();

        } catch (err: any) {
            console.error('Derive shots failed', err);
            showToast(`分镜推导失败: ${err.message}`, 'error');
            setIsAnalyzing(false);
        }
    };

    const handleDeriveThreeShots = async (anchorShot: StoryboardItem, userPrompt?: string) => {
        setIsAnalyzing(true);
        setStatusMessage(userPrompt ? 'AI 导演正在根据您的指令推导分镜...' : 'AI 导演正在推导关联三连分镜...');
        try {
            const derivedShots = await deriveNarrativeTrinity(anchorShot, script, globalContext, userPrompt);
            if (!derivedShots || derivedShots.length === 0) throw new Error('AI 推导返回结果为空');

            const anchorIndex = storyboard.findIndex(s => s.id === anchorShot.id);
            if (anchorIndex === -1) return;

            insertShotsBatch(anchorIndex + 1, derivedShots);

            // Add to Background Queue
            const tasks: BatchTask[] = derivedShots.map(shot => ({
                id: shot.id,
                type: 'photo',
                status: 'pending',
                retryCount: 0,
                addedTime: Date.now()
            }));
            addToBatchQueue(tasks);

            showToast('已推导并补充 3 个关联分镜，正在后台批量绘制...', 'success');

            // Unlock UI
            setIsAnalyzing(false);
            processBatchQueue();

        } catch (err: any) {
            handleError(err);
            setIsAnalyzing(false);
        }
    };

    const handleGenerateNarrativeGrid = async (anchorShot: StoryboardItem) => {
        setIsAnalyzing(true);
        setStatusMessage('AI 导演正在生成九宫格剧情...');
        try {
            const gridShots = await generateNarrativeGrid(anchorShot, script, globalContext);
            if (!gridShots || gridShots.length === 0) throw new Error('AI 生成九宫格失败');

            const anchorIndex = storyboard.findIndex(s => s.id === anchorShot.id);
            if (anchorIndex === -1) return;

            // Insert after anchor
            insertShotsBatch(anchorIndex + 1, gridShots);

            showToast('九宫格剧情已生成', 'success');

            // Unlock UI
            setIsAnalyzing(false);

        } catch (err: any) {
            handleError(err);
            setIsAnalyzing(false);
        }
    };

    const handleRefineShot = async (item: StoryboardItem, customPrompt: string) => {
        showToast('正在根据新提示词精修重绘...', 'info');
        updateShot(item.id, { render_status: 'rendering' });
        try {
            // Img2Img: use original preview_url as reference
            const refImages = item.preview_url ? [item.preview_url] : [];
            const prompt = applyStyleConstitution(customPrompt, globalContext);

            const url = await generateVisualPreview(
                globalContext.image_engine === 'qwen2512' ? 'nb2' : globalContext.image_engine,
                prompt,
                Math.floor(Math.random() * 1000000),
                (globalContext.image_engine === 'nb2' || globalContext.image_engine === 'runninghub') ? '9:16' : globalContext.aspect_ratio,
                refImages
            );

            const photoId = AssetDBService.getDeterministicId('photo', item.id);
            const dbUrl = await AssetDBService.saveAsset(
                photoId,
                projectMetadata?.id || 'default',
                'image',
                url
            );

            updateShot(item.id, {
                preview_url: dbUrl,
                render_status: 'done',
                image_prompt: customPrompt,
                candidate_image_urls: [...(item.candidate_image_urls || []), dbUrl]
            });
            showToast('精修重绘完成', 'success');
        } catch (err: any) {
            updateShot(item.id, { render_status: 'idle' });
            showToast(`精修失败: ${err.message}`, 'error');
        }
    };


    return {
        handleGenerateStoryboard,
        handleExtractAssets,
        handleRenderAssets,
        reRenderSpecificCharacter,
        reRenderSpecificScene,
        generateAllAssets,
        renderSinglePhoto,
        renderCandidates,
        renderSingleVideo,
        batchRenderAllPhotos,
        batchRenderAllVideos,
        handleMasterSynthesis,
        hydrateAllAssets,
        cancelBatch,
        handleFullScriptAnalysis,
        handleInsertShot,
        handleDeriveShots,
        handleDeriveThreeShots,
        handleGenerateNarrativeGrid,
        handleRefineShot,
        handleRefineDNA,
        initiateBackgroundPlanning,
        handleOrchestratedGeneration
    };
};
