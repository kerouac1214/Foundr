import { useRef } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useUIStore } from '../store/useUIStore';
import {
    extractAssets,
    generateStoryboard,
    forgeSceneDNA,
    forgeEnvironmentDNA,
    forgeCharacterDNA,
    refineShotPrompt,
    generateImagePrompt,
    generateVisualPreview,
    generateVideoForShot
} from '../services/geminiService';
import { videoSynthesisService } from '../services/videoSynthesisService';
import { AssetDBService } from '../services/dbService';
import { StoryboardItem } from '../types';

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
        storyboard,
        projectMetadata
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
    const handleGenerateStoryboard = async () => {
        if (!script) {
            showToast('请先输入剧本内容', 'error');
            return;
        }

        setIsAnalyzing(true);
        setStatusMessage('正在分析剧本 (提取角色与场景)...');
        setProgress(10);

        try {
            const { characters: charDrafts, scenes: sceneDrafts } = await extractAssets(script, globalContext.script_engine);

            setStatusMessage('正在构建视觉 DNA (角色与场景)...');
            setProgress(20);

            // 1. Forge Characters
            const forgedCharacters: any[] = [];
            for (const char of charDrafts) {
                const dna = await forgeCharacterDNA(char, globalContext);
                forgedCharacters.push(dna);
            }

            // 2. Forge Scenes
            const forgedScenes: any[] = [];
            for (const scene of sceneDrafts) {
                const dna = await forgeSceneDNA(scene, globalContext);
                forgedScenes.push(dna);
            }

            // 3. Update Global Context to persist in store (and UI dashboard)
            updateGlobalContext({
                characters: forgedCharacters,
                scenes: forgedScenes
            });

            setStatusMessage('正在拆解分镜...');
            setProgress(40);

            const { metadata, initial_script } = await generateStoryboard(script, forgedCharacters, forgedScenes, globalContext.script_engine);

            // Add Project ID for IndexedDB
            metadata.id = `proj_${Date.now()}`;
            setProjectMetadata(metadata);
            setStoryboard(initial_script.map((shot: any, i: number) => ({
                ...shot,
                id: `shot_${Date.now()}_${i}`,
                shot_number: i + 1,
                render_status: 'idle',
                video_status: 'idle',
                isLocked: false,
                candidate_image_urls: []
            })));

            setIsAnalyzing(false);
            setActiveView('storyboard');
            showToast('分镜生成完成', 'success');

        } catch (err) {
            handleError(err);
        }
    };

    // ========== Step 2: Extract & Forge Assets ==========
    const handleExtractAssets = async () => {
        if (!script) return;
        setIsAnalyzing(true);
        setStatusMessage('正在扫描剧本资产...');
        setProgress(5);

        try {
            const { characters: charDrafts, scenes: sceneDrafts } = await extractAssets(script, globalContext.script_engine);

            // 1. Forge Scenes & Auto-Render
            const forgedScenes: any[] = [];
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
                            globalContext.image_engine === 'qwen2512' ? 'nb_pro' : globalContext.image_engine,
                            `(Scene: ${dna.visual_anchor_prompt}), cinematic wide shot, masterpiece, ${globalContext.visual_style_preset}`,
                            dna.seed,
                            '16:9'
                        );
                        // Save to IndexedDB (as Image)
                        const dbUrl = await AssetDBService.saveAsset(
                            `scene_${dna.scene_id}`,
                            projectMetadata?.id || 'default',
                            'image',
                            url
                        );
                        dna.preview_url = dbUrl;
                    } catch (e) {
                        console.error(`Auto-render scene ${draft.name} failed`, e);
                    }

                    forgedScenes.push(dna);
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
            const forgedChars: any[] = [];
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
                            globalContext.image_engine === 'qwen2512' ? 'nb_pro' : globalContext.image_engine,
                            dna.consistency_seed_prompt,
                            dna.seed,
                            '16:9'
                        );
                        // Save to IndexedDB (as Image)
                        const dbUrl = await AssetDBService.saveAsset(
                            `char_${dna.char_id}`,
                            projectMetadata?.id || 'default',
                            'image',
                            url
                        );
                        dna.preview_url = dbUrl;
                    } catch (e) {
                        console.error(`Auto-render char ${draft.name} failed`, e);
                    }

                    forgedChars.push(dna);
                    // Update store incrementally so user sees progress
                    updateGlobalContext({ characters: [...forgedChars] });
                } catch (err: any) {
                    console.error(`角色 ${draft.name} DNA 生成失败:`, err);
                    showToast(`角色 ${draft.name} 处理失败`, 'error');
                }
            }
            // Final update to ensure consistency
            updateGlobalContext({ characters: forgedChars });

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
                    globalContext.image_engine === 'qwen2512' ? 'nb_pro' : globalContext.image_engine,
                    `${globalContext.environment.visual_anchor_prompt}, cinematic wide shot, masterpiece`,
                    Math.floor(Math.random() * 1000000),
                    '16:9'
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
                        globalContext.image_engine === 'qwen2512' ? 'nb_pro' : globalContext.image_engine,
                        `Character Portrait: ${char.consistency_seed_prompt}, ${globalContext.visual_style_preset}`,
                        char.seed,
                        '16:9'
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
            const prompt = customPrompt || `Character Portrait: ${char.consistency_seed_prompt}, ${globalContext.visual_style_preset}`;
            const url = await generateVisualPreview(
                globalContext.image_engine === 'qwen2512' ? 'nb_pro' : globalContext.image_engine,
                prompt,
                Math.floor(Math.random() * 1000000),
                '16:9'
            );
            const dbUrl = await AssetDBService.saveAsset(
                `char_${charId}`,
                projectMetadata?.id || 'default',
                'image',
                url
            );
            updateCharacter(charId, { preview_url: dbUrl });
            showToast('渲染完成', 'success');
        } catch (err) {
            showToast('渲染失败', 'error');
            console.error(err);
        }
    };

    const reRenderSpecificScene = async (sceneId: string, customPrompt?: string) => {
        const scene = globalContext.scenes.find(s => s.scene_id === sceneId);
        if (!scene) return;

        showToast(`正在重新渲染场景: ${scene.name}...`, 'info');
        try {
            const prompt = customPrompt || `${scene.visual_anchor_prompt}, cinematic wide shot, masterpiece`;
            const url = await generateVisualPreview(
                globalContext.image_engine === 'qwen2512' ? 'nb_pro' : globalContext.image_engine,
                prompt,
                Math.floor(Math.random() * 1000000),
                '16:9'
            );
            const dbUrl = await AssetDBService.saveAsset(
                `scene_${sceneId}`,
                projectMetadata?.id || 'default',
                'image',
                url
            );
            updateScene(sceneId, { preview_url: dbUrl });
            showToast('场景渲染完成', 'success');
        } catch (err) {
            showToast('场景渲染失败', 'error');
            console.error(err);
        }
    };

    const generateAllAssets = async () => {
        const scenes = globalContext.scenes;
        const chars = globalContext.characters;
        const total = scenes.length + chars.length;
        let done = 0;

        showToast(`开始生成全部资产 (${total} 项)...`, 'info');

        // Render scenes first
        for (const scene of scenes) {
            if (scene.preview_url) { done++; continue; }
            try {
                showToast(`渲染场景: ${scene.name} (${done + 1}/${total})...`, 'info');
                const url = await generateVisualPreview(
                    globalContext.image_engine === 'qwen2512' ? 'nb_pro' : globalContext.image_engine,
                    `${scene.visual_anchor_prompt}, cinematic wide shot, masterpiece`,
                    Math.floor(Math.random() * 1000000),
                    '16:9'
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
            }
            done++;
        }

        // Then characters
        for (const char of chars) {
            if (char.preview_url) { done++; continue; }
            try {
                showToast(`渲染角色: ${char.name} (${done + 1}/${total})...`, 'info');
                const url = await generateVisualPreview(
                    globalContext.image_engine === 'qwen2512' ? 'nb_pro' : globalContext.image_engine,
                    `Character Portrait: ${char.consistency_seed_prompt}, ${globalContext.visual_style_preset}`,
                    char.seed,
                    '16:9'
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
            }
            done++;
        }

        showToast('全部资产生成完成！', 'success');
    };

    // ========== Step 4: Storyboard Rendering ==========

    const renderSinglePhoto = async (index: number) => {
        const item = storyboard[index];
        if (!item) return;

        updateShot(item.id, { render_status: 'rendering' });
        try {
            const scene = globalContext.scenes.find(s => s.scene_id === item.scene_id);
            const prompt = await generateImagePrompt(item, globalContext.characters, scene, globalContext.environment, globalContext);

            // Build reference images for RunningHub
            const refImages: string[] = [];
            if (globalContext.image_engine === 'runninghub' || globalContext.image_engine === 'nb_pro' || globalContext.image_engine === 'qwen2512') {
                globalContext.characters.forEach(c => {
                    if (item.character_ids?.includes(c.char_id) && c.preview_url) {
                        refImages.push(c.preview_url);
                    }
                });
                if (scene?.preview_url) {
                    refImages.push(scene.preview_url);
                }
            }
            const url = await generateVisualPreview(
                globalContext.image_engine,
                prompt,
                item.seed,
                globalContext.aspect_ratio,
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
            const prompt = await generateImagePrompt(item, globalContext.characters, scene, globalContext.environment, globalContext);

            // For candidates, we generate a batch with different seeds
            const promises = Array.from({ length: count }).map((_, i) => {
                const seed = (item.seed || 12345) + (i * 100);
                return generateVisualPreview(
                    globalContext.image_engine,
                    prompt,
                    seed,
                    globalContext.aspect_ratio
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
            const prompt = await generateImagePrompt(item, globalContext.characters, scene, globalContext.environment, globalContext);

            const url = await generateVideoForShot(prompt, globalContext.aspect_ratio, globalContext.video_engine);

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
        cancelBatch
    };
};
