import { useRef } from 'react';
import { useProjectStore } from '../store/useProjectStore';
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
import { StoryboardItem, Episode, ProjectStatus, ProjectMetadata, Chapter, AnalysisMode } from '../types';
import { generateId } from '../utils';

export const useAppWorkflow = () => {
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
        storyboard,
        projectMetadata,
        setSelectedChapterId,
        setScript
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

    // ========== Step 1: Analyze Script & Generate Storyboard ==========
    const handleEpisodicStructuring = async (targetScript: string): Promise<{ status: ProjectStatus, episodes: Episode[] } | null> => {
        try {
            setError(null);
            setStatusMessage('编剧分析：正在进行剧集统筹与智能分集...');
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
            const { metadata, initial_script } = await generateStoryboard(enrichedScript, characters, scenes, globalContext.script_engine);
            console.log(`[Storyboard] Step 3 OK: ${initial_script.length} shots returned`);

            if (!initial_script || initial_script.length === 0) {
                showToast('AI 未能生成分镜脚本，可能是剧本太短或格式不符。请检查剧本后重试。', 'error');
                setIsAnalyzing(false);
                return;
            }

            // Merge Episodic Data into Metadata
            // CRITICAL: Spread existing projectMetadata first to preserve chapters, full_script, name, etc.
            // Then let the AI-returned metadata only override bpm/energy/mood/transitions.
            const finalMetadata: ProjectMetadata = {
                ...projectMetadata,   // Preserve chapters, full_script, analysis_mode, name, etc.
                ...metadata,          // Let AI-returned fields (bpm, energy_level, overall_mood, transitions) override
                id: projectMetadata?.id || generateId(),
                analysis_mode: projectMetadata?.analysis_mode || 'Single_Episode',
                status: episodicData.status,
                episodes: episodicData.episodes,
                // Always restore chapters from existing metadata since AI doesn't return them
                chapters: projectMetadata?.chapters,
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

            // Only update global context if it was empty (local extraction)
            if (globalContext.characters.length === 0) {
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
                        // PRESERVE extraction prompts — do NOT clear them!
                        visual_anchor_prompt: s.visual_anchor_prompt || '',
                        seed: s.seed || Math.floor(Math.random() * 1000000)
                    }))
                });
            }

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

        if (!freshScript) {
            showToast('请在此输入完整的全剧本或长小说内容后再点击架构分析', 'error');
            return;
        }

        // Clear chapter selection so the ScriptEditor shows the full script,
        // not a single chapter, after analysis completes.
        setSelectedChapterId(null);

        try {
            setIsAnalyzing(true);
            setError(null);
            setStatusMessage('Step 1 / 全剧架构分析：正在进行章节切分...');
            setProgress(10);

            // Step 1 ONLY: Partition Chapters
            const chapters = await partitionIntoChapters(freshScript, globalContext.script_engine);

            if (!chapters || chapters.length === 0) {
                showToast('章节切分失败：AI 未返回有效章节，请重试', 'error');
                return;
            }

            // Initialize Project Metadata (Chapter structure only, no assets yet)
            const finalMetadata: ProjectMetadata = {
                id: projectMetadata?.id || generateId(),
                name: projectMetadata?.name || '未命名项目',
                full_script: freshScript,
                analysis_mode: 'Full_Script',
                bpm: 120,
                energy_level: 'Medium',
                overall_mood: 'Neural',
                chapters: chapters,
                transitions: []
            };

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

    // ========== Step 2: Extract & Forge Assets ==========
    const handleExtractAssets = async () => {
        if (!script) return;
        setIsAnalyzing(true);
        setStatusMessage('正在扫描剧本资产...');
        setProgress(5);

        try {
            const { characters: charDrafts, scenes: sceneDrafts } = await extractAssets(script, globalContext, globalContext.script_engine);

            // DEBUG: Log extraction results
            console.log('[Extract] Characters:', charDrafts.map((c: any) => ({
                name: c.name,
                has_prompt: !!c.consistency_seed_prompt,
                prompt_len: (c.consistency_seed_prompt || '').length,
                prompt_preview: (c.consistency_seed_prompt || '').substring(0, 80)
            })));
            console.log('[Extract] Scenes:', sceneDrafts.map((s: any) => ({
                name: s.name,
                has_prompt: !!s.visual_anchor_prompt,
                prompt_len: (s.visual_anchor_prompt || '').length,
                prompt_preview: (s.visual_anchor_prompt || '').substring(0, 80)
            })));

            // Initialize store with all drafts immediately so they are visible with initial prompts
            updateGlobalContext({
                characters: charDrafts || [],
                scenes: sceneDrafts || []
            });

            // 1. Forge Scenes & Auto-Render
            const forgedScenes = [...(sceneDrafts || [])];
            for (let i = 0; i < sceneDrafts.length; i++) {
                if (i > 0) await new Promise(r => setTimeout(r, 2000));

                const draft = sceneDrafts[i];
                setStatusMessage(`正在设计场景: ${draft.name} (${i + 1}/${sceneDrafts.length})...`);
                setProgress(10 + Math.floor((i / sceneDrafts.length) * 20));

                try {
                    const dna = await forgeSceneDNA(draft, globalContext);

                    // Auto-render Scene
                    setStatusMessage(`正在绘制场景: ${draft.name}...`);
                    try {
                        const url = await generateVisualPreview(
                            globalContext.image_engine === 'qwen2512' ? 'nb2' : globalContext.image_engine,
                            applyStyleConstitution(`(Scene: ${dna.visual_anchor_prompt}), cinematic wide shot`, globalContext),
                            dna.seed,
                            '16:9',
                            dna.reference_image_url ? [dna.reference_image_url] : undefined
                        );
                        // Save to IndexedDB (as Image)
                        const dbUrl = await AssetDBService.saveAsset(
                            `scene_${dna.scene_id}`,
                            projectMetadata?.id || 'default',
                            'image',
                            url
                        );
                        dna.preview_url = dbUrl;
                    } catch (e: any) {
                        console.error(`Auto-render scene ${draft.name} failed`, e);
                        showToast(`场景 ${draft.name} 自动绘制失败: ${e.message}`, 'error');
                    }

                    forgedScenes[i] = dna;
                    updateGlobalContext({ scenes: [...forgedScenes] });
                } catch (err) {
                    console.error(`场景 ${draft.name} 生成失败`, err);
                }
            }

            updateGlobalContext({ scenes: forgedScenes });

            // Initialize Environment from first scene for backward compatibility if needed
            if (forgedScenes.length > 0 && (!globalContext.environment || !globalContext.environment.visual_anchor_prompt)) {
                updateEnvironment({
                    description: forgedScenes[0].description,
                    visual_anchor_prompt: forgedScenes[0].visual_anchor_prompt,
                    core_lighting: forgedScenes[0].core_lighting,
                    key_elements: forgedScenes[0].key_elements,
                    preview_url: forgedScenes[0].preview_url
                });
            }


            // 2. Forge Characters & Auto-Render
            const forgedChars = [...(charDrafts || [])];
            for (let i = 0; i < charDrafts.length; i++) {
                await new Promise(r => setTimeout(r, 2000));

                const draft = charDrafts[i];
                setStatusMessage(`正在锻造角色: ${draft.name} (${i + 1}/${charDrafts.length})...`);
                setProgress(30 + Math.floor((i / charDrafts.length) * 60));

                try {
                    const dna = await forgeCharacterDNA(draft, globalContext);

                    // Auto-render Character
                    setStatusMessage(`正在绘制角色: ${draft.name}...`);
                    try {
                        const url = await generateVisualPreview(
                            globalContext.image_engine === 'qwen2512' ? 'nb2' : globalContext.image_engine,
                            dna.consistency_seed_prompt,
                            dna.seed,
                            '16:9',
                            dna.reference_image_url ? [dna.reference_image_url] : undefined
                        );
                        // Save to IndexedDB (as Image)
                        const dbUrl = await AssetDBService.saveAsset(
                            `char_${dna.char_id}`,
                            projectMetadata?.id || 'default',
                            'image',
                            url
                        );
                        dna.preview_url = dbUrl;
                    } catch (e: any) {
                        console.error(`Auto-render char ${draft.name} failed`, e);
                        showToast(`角色 ${draft.name} 自动绘制失败: ${e.message}`, 'error');
                    }

                    forgedChars[i] = dna;
                    // Update store incrementally so user sees progress
                    updateGlobalContext({ characters: [...forgedChars] });
                } catch (err: any) {
                    console.error(`角色 ${draft.name} DNA 生成失败:`, err);
                    showToast(`角色 ${draft.name} 处理失败`, 'error');
                }
            }

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

            // Save finalized photo to DB
            const dbUrl = await AssetDBService.saveAsset(
                `shot_${item.id}_photo`,
                projectMetadata?.id || 'default',
                'image',
                url
            );

            updateShot(item.id, {
                preview_url: dbUrl,
                candidate_image_urls: [dbUrl], // First one is the default candidate
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
            // Save candidates to DB
            const dbUrls = await Promise.all(urls.map((url, i) =>
                AssetDBService.saveAsset(
                    `shot_${item.id}_cand_${i}`,
                    projectMetadata?.id || 'default',
                    'candidate',
                    url
                )
            ));

            updateShot(item.id, {
                candidate_image_urls: dbUrls,
                preview_url: dbUrls[0], // Set the first one as default
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

            // Save video clip to DB
            const dbUrl = await AssetDBService.saveAsset(
                `shot_${item.id}_video`,
                projectMetadata?.id || 'default',
                'video',
                url
            );

            updateShot(item.id, { video_url: dbUrl, video_status: 'ready', image_prompt: prompt });
        } catch (err: any) {
            updateShot(item.id, { video_status: 'idle' });
            showToast(`镜头 ${item.shot_number} 视频生成失败`, 'error');
            throw err;
        }
    };

    const batchRenderAllPhotos = async () => {
        if (storyboard.length === 0) return;

        batchCancelledRef.current = false;
        const startTime = Date.now();
        let succeeded = 0;
        let failed = 0;

        const pendingShots = storyboard.map((s, i) => ({ ...s, index: i })).filter(s => !s.isLocked && !s.preview_url);
        const total = pendingShots.length;

        if (total === 0) {
            showToast('所有镜头已渲染或已锁定', 'info');
            setBatchProgress(null);
            return;
        }

        setBatchProgress({
            total,
            current: 0,
            succeeded: 0,
            failed: 0,
            startTime,
            operation: 'photo',
            message: '准备开始批量渲染...'
        });

        for (let i = 0; i < total; i++) {
            if (batchCancelledRef.current) break;

            const shot = pendingShots[i];
            setBatchProgress({
                total,
                current: i + 1,
                succeeded,
                failed,
                startTime,
                operation: 'photo',
                currentShotNumber: shot.shot_number,
                message: `正在渲染镜头 ${shot.shot_number}...`
            });

            try {
                await renderSinglePhoto(shot.index);
                succeeded++;
            } catch (e) {
                console.error(`Shot ${shot.index} failed`, e);
                failed++;
            }

            // Slight delay to prevent rate limit
            await new Promise(r => setTimeout(r, 1000));
        }

        setBatchProgress(null);
        if (!batchCancelledRef.current) showToast(`批量渲染完成: 成功 ${succeeded}, 失败 ${failed}`, 'success');
    };

    const batchRenderAllVideos = async () => {
        if (storyboard.length === 0) return;

        batchCancelledRef.current = false;
        // Filter shots that have preview but no video
        const pendingShots = storyboard.map((s, i) => ({ ...s, index: i }))
            .filter(s => !s.isLocked && s.preview_url && !s.video_url);
        const total = pendingShots.length;

        if (total === 0) {
            showToast('没有可生成的视频任务', 'info');
            return;
        }

        const startTime = Date.now();
        let succeeded = 0;
        let failed = 0;

        setBatchProgress({
            current: 0,
            total,
            message: '准备合成与编译视频...',
            succeeded,
            failed,
            operation: 'video',
            startTime
        });

        for (let i = 0; i < total; i++) {
            if (batchCancelledRef.current) break;

            const shot = pendingShots[i];
            setBatchProgress({
                current: i + 1,
                total,
                message: `正在合成镜头 ${shot.shot_number} 视频...`,
                succeeded,
                failed,
                operation: 'video',
                startTime,
                currentShotNumber: shot.shot_number
            });

            try {
                await renderSingleVideo(shot.index);
                succeeded++;
            } catch (e) {
                console.error(e);
                failed++;
            }
        }

        setBatchProgress(null);
        if (!batchCancelledRef.current) showToast('批量合成完成', 'success');
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
            const masterUrl = await videoSynthesisService.synthesize(storyboard, (msg) => {
                setStatusMessage(`母带合成: ${msg}`);
                // Simple progress increment
                currentProg = Math.min(currentProg + 2, 95);
                setProgress(currentProg);
            });

            setIsAnalyzing(false);
            setProgress(100);

            // Create a temporary link to download
            const link = document.createElement('a');
            link.href = masterUrl;
            link.download = `Foundr_Master_${Date.now()}.mp4`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showToast('母带合成完成并已开始下载', 'success');
        } catch (err) {
            handleError(err);
        }
    };

    const handleInsertShot = async (index: number, description: string) => {
        if (!description.trim()) return;
        setIsAnalyzing(true);
        setStatusMessage('正在分析新分镜其关联资产...');
        try {
            // 1. AI Analysis
            const newShot = await analyzeShotInsertion(description, globalContext, storyboard);

            // 2. Insert into Store
            insertShotAt(index, newShot);

            // 3. Auto-render the new shot
            setStatusMessage('正在绘制新分镜...');

            const scene = globalContext.scenes.find(s => s.scene_id === newShot.scene_id);
            const prompt = await generateImagePrompt(newShot, globalContext.characters, scene, globalContext.environment, globalContext);

            const url = await generateVisualPreview(
                globalContext.image_engine === 'qwen2512' ? 'nb2' : globalContext.image_engine,
                applyStyleConstitution(prompt || newShot.image_prompt || newShot.action_description, globalContext),
                newShot.seed,
                (globalContext.image_engine === 'nb2' || globalContext.image_engine === 'runninghub') ? '9:16' : globalContext.aspect_ratio
            );

            // Save to DB
            const dbUrl = await AssetDBService.saveAsset(
                `shot_${newShot.id}`,
                projectMetadata?.id || 'default',
                'image',
                url
            );

            updateShot(newShot.id, {
                preview_url: dbUrl,
                render_status: 'done',
                image_prompt: prompt,
                candidate_image_urls: [dbUrl]
            });

            showToast('新分镜已插入并绘制完成', 'success');
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
            // 1. Derive Context (2 before, 2 after)
            const derivedShots = await deriveShotsFromAnchor(anchorShot, script, globalContext);
            if (!derivedShots || derivedShots.length === 0) {
                throw new Error('AI 推导返回结果为空');
            }

            // The AI returns [prev2, prev1, next1, next2]
            const prevShots = derivedShots.slice(0, 2);
            const nextShots = derivedShots.slice(2, 4);

            const anchorIndex = storyboard.findIndex(s => s.id === anchorShot.id);
            if (anchorIndex === -1) return;

            // 2. Insert into Store
            // We insert nextShots AFTER anchor, then prevShots BEFORE anchor
            // To keep stability, let's do it in one batch if we update the helper
            // Or just two calls. Let's use two calls to insertShotsBatch for clarity.

            // Insert after (index + 1)
            insertShotsBatch(anchorIndex + 1, nextShots);
            // Insert before (anchorIndex is same position, it will push anchor ahead)
            insertShotsBatch(anchorIndex, prevShots);

            showToast('已推导并补充 4 个关联分镜，系统正在自动绘制...', 'success');

            // 3. Batch Render derived shots
            // We need the NEW ids to render
            const allNewShots = [...prevShots, ...nextShots];

            for (const shot of allNewShots) {
                setStatusMessage(`正在绘制推导分镜: #${shot.shot_number || '...'} `);
                try {
                    const scene = globalContext.scenes.find(s => s.scene_id === shot.scene_id);
                    const prompt = await generateImagePrompt(shot, globalContext.characters, scene, globalContext.environment, globalContext);

                    const url = await generateVisualPreview(
                        globalContext.image_engine === 'qwen2512' ? 'nb2' : globalContext.image_engine,
                        applyStyleConstitution(prompt || shot.image_prompt || shot.action_description, globalContext),
                        shot.seed,
                        (globalContext.image_engine === 'nb2' || globalContext.image_engine === 'runninghub') ? '9:16' : globalContext.aspect_ratio
                    );

                    const dbUrl = await AssetDBService.saveAsset(
                        `shot_${shot.id}`,
                        projectMetadata?.id || 'default',
                        'image',
                        url
                    );

                    updateShot(shot.id, {
                        preview_url: dbUrl,
                        render_status: 'done',
                        image_prompt: prompt,
                        candidate_image_urls: [dbUrl]
                    });
                } catch (renderErr) {
                    console.error('Failed to render derived shot', renderErr);
                }
            }

            showToast('推导分镜全部绘制完成', 'success');
        } catch (err: any) {
            console.error('Derive shots failed', err);
            showToast(`分镜推导失败: ${err.message}`, 'error');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleDeriveThreeShots = async (anchorShot: StoryboardItem) => {
        setIsAnalyzing(true);
        setStatusMessage('AI 导演正在推导关联三连分镜...');
        try {
            const derivedShots = await deriveNarrativeTrinity(anchorShot, script, globalContext);
            if (!derivedShots || derivedShots.length === 0) throw new Error('AI 推导返回结果为空');

            const anchorIndex = storyboard.findIndex(s => s.id === anchorShot.id);
            if (anchorIndex === -1) return;

            insertShotsBatch(anchorIndex + 1, derivedShots);
            showToast('已推导并补充 3 个关联分镜，系统正在自动绘制...', 'success');

            for (const shot of derivedShots) {
                setStatusMessage(`正在绘制推导分镜: #${shot.shot_number || '...'} `);
                try {
                    const scene = globalContext.scenes.find(s => s.scene_id === shot.scene_id);
                    const prompt = shot.image_prompt || await generateImagePrompt(shot, globalContext.characters, scene, globalContext.environment, globalContext);
                    const url = await generateVisualPreview(
                        globalContext.image_engine === 'qwen2512' ? 'nb2' : globalContext.image_engine,
                        applyStyleConstitution(prompt, globalContext),
                        shot.seed,
                        (globalContext.image_engine === 'nb2' || globalContext.image_engine === 'runninghub') ? '9:16' : globalContext.aspect_ratio
                    );
                    const dbUrl = await AssetDBService.saveAsset(`shot_${shot.id}`, projectMetadata?.id || 'default', 'image', url);
                    updateShot(shot.id, { preview_url: dbUrl, render_status: 'done', image_prompt: prompt, candidate_image_urls: [dbUrl] });
                } catch (e) { console.error(e); }
            }
        } catch (err: any) {
            handleError(err);
        } finally {
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
            showToast('九宫格剧情已生成，正在后台批量绘制...', 'success');

            // Render sequentially
            for (const shot of gridShots) {
                setStatusMessage(`正在绘制九宫格分镜 ${shot.shot_number}/9...`);
                try {
                    const scene = globalContext.scenes.find(s => s.scene_id === shot.scene_id);
                    const prompt = shot.image_prompt || await generateImagePrompt(shot, globalContext.characters, scene, globalContext.environment, globalContext);
                    const url = await generateVisualPreview(
                        globalContext.image_engine === 'qwen2512' ? 'nb2' : globalContext.image_engine,
                        applyStyleConstitution(prompt, globalContext),
                        shot.seed,
                        (globalContext.image_engine === 'nb2' || globalContext.image_engine === 'runninghub') ? '9:16' : globalContext.aspect_ratio
                    );
                    const dbUrl = await AssetDBService.saveAsset(`shot_${shot.id}`, projectMetadata?.id || 'default', 'image', url);
                    updateShot(shot.id, { preview_url: dbUrl, render_status: 'done', image_prompt: prompt, candidate_image_urls: [dbUrl] });
                } catch (e) { console.error(e); }
            }
        } catch (err: any) {
            handleError(err);
        } finally {
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

            const dbUrl = await AssetDBService.saveAsset(
                `shot_${item.id}_refined_${Date.now()}`,
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

    const repairProjectAssets = async () => {
        if (!projectMetadata?.id) return;

        setStatusMessage('正在从本地数据库恢复项资产...');
        try {
            const assets = await AssetDBService.getAllProjectAssets(projectMetadata.id);
            if (assets.length === 0) return;

            // 1. Repair Scenes
            const updatedScenes = [...globalContext.scenes];
            for (let i = 0; i < updatedScenes.length; i++) {
                const asset = assets.find(a => a.id === `scene_${updatedScenes[i].scene_id}`);
                if (asset) updatedScenes[i].preview_url = URL.createObjectURL(asset.data);
            }

            // 2. Repair Characters
            const updatedChars = [...globalContext.characters];
            for (let i = 0; i < updatedChars.length; i++) {
                const asset = assets.find(a => a.id === `char_${updatedChars[i].char_id}`);
                if (asset) updatedChars[i].preview_url = URL.createObjectURL(asset.data);
            }

            updateGlobalContext({ scenes: updatedScenes, characters: updatedChars });

            // 3. Repair Storyboard
            for (const shot of storyboard) {
                const photoAsset = assets.find(a => a.id === `shot_${shot.id}_photo`);
                const videoAsset = assets.find(a => a.id === `shot_${shot.id}_video`);
                if (photoAsset || videoAsset) {
                    updateShot(shot.id, {
                        preview_url: photoAsset ? URL.createObjectURL(photoAsset.data) : shot.preview_url,
                        video_url: videoAsset ? URL.createObjectURL(videoAsset.data) : shot.video_url
                    });
                }
            }

            showToast('已从本地缓存恢复资产', 'success');
        } catch (err) {
            console.error('Failed to repair assets', err);
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
        repairProjectAssets,
        cancelBatch,
        handleFullScriptAnalysis,
        handleInsertShot,
        handleDeriveShots,
        handleDeriveThreeShots,
        handleGenerateNarrativeGrid,
        handleRefineShot,
        handleRefineDNA
    };
};
