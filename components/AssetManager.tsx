import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { cloneVoice } from '../services/runningHubService';
import { CharacterDNA, SceneDNA } from '../types';
import { exportProjectToZip } from '../services/exportService';
import { useUIStore } from '../store/useUIStore';
import { IMAGE_ENGINES } from '../constants';

interface AssetManagerProps {
    className?: string;
    onReRenderCharacter?: (charId: string, customPrompt?: string) => void;
    onReRenderScene?: (sceneId: string, customPrompt?: string) => void;
    onGenerateAll?: () => void;
    onRefineDNA?: (name: string, description: string, type: 'character' | 'scene', id: string) => void;
    isGenerating?: boolean;
}

/* --- Utils --- */

const getProxiedUrl = (url: string | undefined) => {
    if (!url) return '';
    if (url.includes('rh-images-1252422369.cos.ap-beijing.myqcloud.com')) {
        return url.replace('https://rh-images-1252422369.cos.ap-beijing.myqcloud.com', '/rh-images');
    }
    return url;
};

/* --- Sub-Components --- */

const PromptEditor: React.FC<{
    defaultPrompt: string;
    onRegenerate: (prompt: string) => void;
    isRendering: boolean;
    label: string;
}> = ({ defaultPrompt, onRegenerate, isRendering, label }) => {
    const [editPrompt, setEditPrompt] = useState(defaultPrompt);
    const [expanded, setExpanded] = useState(false);

    // Sync state when defaultPrompt changes (e.g. after refinement)
    useEffect(() => {
        setEditPrompt(defaultPrompt);
    }, [defaultPrompt]);

    return (
        <div className="pt-4 border-t border-white/5">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{label}</span>
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="text-[9px] text-zinc-500 hover:text-[#D4AF37] transition-colors"
                >
                    {expanded ? '收起' : '编辑提示词'}
                </button>
            </div>
            {expanded && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <textarea
                        value={editPrompt}
                        title="编辑提示词"
                        placeholder="在此编辑用于生成的提示词..."
                        onChange={e => setEditPrompt(e.target.value)}
                        className="w-full bg-white/5 p-4 rounded-xl border border-white/10 text-zinc-300 text-[10px] mono leading-relaxed h-28 outline-none focus:border-[#D4AF37]/50 resize-none"
                    />
                    <button
                        onClick={() => onRegenerate(editPrompt)}
                        disabled={isRendering}
                        className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2
                            ${isRendering
                                ? 'bg-zinc-800 text-zinc-500 cursor-wait'
                                : 'bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black'}`}
                    >
                        {isRendering ? '生成中...' : '使用此提示词重新生成'}
                    </button>
                </div>
            )}
        </div>
    );
};

const AssetCard: React.FC<{
    item: any;
    type: 'character' | 'scene';
    onClick: () => void;
}> = ({ item, type, onClick }) => {
    return (
        <div
            onClick={onClick}
            className="group relative cursor-pointer bg-[#0A0A0A] rounded-2xl border border-white/5 hover:border-[#D4AF37]/50 transition-all hover:-translate-y-1 hover:shadow-2xl overflow-hidden aspect-[3/4]"
        >
            {/* Image / Placeholder */}
            {(item.reference_image_url || item.preview_url) ? (
                <img
                    src={getProxiedUrl(item.reference_image_url || item.preview_url)}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    alt={item.name}
                    onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).parentElement!.classList.add('broken-image');
                    }}
                />
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900/50 gap-2">
                    <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-zinc-500 animate-spin opacity-20" />
                    <span className="text-[9px] uppercase tracking-widest text-zinc-600">等待中</span>
                </div>
            )}

            {/* Status indicator / Confirmed Badge */}
            {item.reference_image_url && (
                <div className="absolute top-3 left-3 bg-[#D4AF37] text-black text-[8px] font-black uppercase px-2 py-0.5 rounded shadow-lg z-10">
                    已确认
                </div>
            )}

            {/* Overlay Info */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-4 flex flex-col justify-end opacity-80 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] mb-1">{type === 'character' ? '角色' : '场景'}</span>
                <h3 className="text-sm font-bold text-white leading-tight">{item.name}</h3>
            </div>

            {/* Status indicator */}
            <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${item.preview_url ? 'bg-[#D4AF37]' : 'bg-zinc-700'} shadow-[0_0_10px_rgba(212,175,55,0.5)]`} />
        </div>
    );
};

const DetailModal: React.FC<{
    asset: any;
    type: 'character' | 'scene';
    onClose: () => void;
    onUpdate: (id: string, updates: any) => void;
    onRegenerate: (id: string, prompt: string) => void;
    isRendering: boolean;
    // Voice specific
    onUploadAudio?: (e: React.ChangeEvent<HTMLInputElement>, id: string) => void;
    onUploadReference?: (e: React.ChangeEvent<HTMLInputElement>, id: string) => void;
    onSetAsReference?: (id: string, url: string) => void;
    onRemoveReference?: (id: string, url: string) => void;
    onCloneVoice?: (id: string, audioUrl: string, text: string) => void;
    onRefineDNA?: (name: string, description: string, type: 'character' | 'scene', id: string) => void;
    onDelete?: (id: string, type: 'character' | 'scene') => void;
    isCloning?: boolean;
    stylePreset: string;
}> = ({
    asset,
    type,
    onClose,
    onUpdate,
    onRegenerate,
    isRendering,
    onUploadAudio,
    onUploadReference,
    onSetAsReference,
    onRemoveReference,
    onCloneVoice,
    onRefineDNA,
    onDelete,
    isCloning,
    stylePreset
}) => {
        // Prevent body scroll when modal is open
        useEffect(() => {
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = 'unset'; };
        }, []);

        const dnaPrompt = type === 'character' ? asset.consistency_seed_prompt : asset.visual_anchor_prompt;
        const displayPrompt = typeof dnaPrompt === 'object' ? JSON.stringify(dnaPrompt, null, 2) : (dnaPrompt || '');

        const defaultPrompt = type === 'character'
            ? displayPrompt
            : `${displayPrompt}, cinematic wide shot, masterpiece`;

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 md:p-12 animate-in fade-in duration-200">
                {/* Close Button */}
                <button onClick={onClose} className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors z-[60]" title="Close Modal">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <div className="w-full max-w-7xl h-full bg-[#050505] rounded-[2rem] border border-white/10 overflow-hidden flex flex-col md:flex-row shadow-2xl">
                    {/* Left: Image Preview */}
                    <div className="w-full md:w-1/2 h-[40vh] md:h-full bg-zinc-950 relative overflow-hidden group">
                        {asset.preview_url ? (
                            <img src={getProxiedUrl(asset.preview_url)} className="w-full h-full object-contain" alt={asset.name} />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-700">预览图待生成</div>
                        )}
                        {/* Quick Regen Button on Image */}
                        <button
                            onClick={() => onRegenerate(type === 'character' ? asset.char_id : asset.scene_id, defaultPrompt)}
                            disabled={isRendering}
                            className="absolute bottom-8 right-8 bg-[#D4AF37] text-black px-6 py-3 rounded-xl font-bold uppercase tracking-wider hover:scale-105 transition-transform shadow-xl disabled:opacity-50 disabled:scale-100"
                        >
                            {isRendering ? '生成中...' : '重新生成'}
                        </button>
                    </div>

                    {/* Right: Controls */}
                    <div className="w-full md:w-1/2 h-full overflow-y-auto p-8 md:p-12 space-y-8 bg-[#050505]">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <span className="text-[10px] font-black uppercase text-[#D4AF37] tracking-[0.4em] mb-2 block">{type === 'character' ? '角色资产' : '场景资产'}</span>
                                <input
                                    value={asset.name}
                                    title="Asset Name"
                                    onChange={e => onUpdate(type === 'character' ? asset.char_id : asset.scene_id, { name: e.target.value })}
                                    className="w-full bg-transparent border-none outline-none text-4xl font-black uppercase serif text-white placeholder-zinc-800"
                                />
                            </div>
                            <button
                                onClick={() => {
                                    if (confirm(`确定要删除资产 "${asset.name}" 吗？此操作不可撤销。`)) {
                                        onDelete?.(type === 'character' ? asset.char_id : asset.scene_id, type);
                                    }
                                }}
                                className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl transition-all group"
                                title="删除资产"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">描述</label>
                                <button
                                    onClick={() => onRefineDNA?.(asset.name, asset.description, type, type === 'character' ? asset.char_id : asset.scene_id)}
                                    className="text-[9px] font-black uppercase text-[#D4AF37] hover:text-white transition-colors flex items-center gap-1.5 bg-[#D4AF37]/5 px-2.5 py-1 rounded-lg border border-[#D4AF37]/20"
                                >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    提炼视觉 DNA
                                </button>
                            </div>
                            <textarea
                                value={asset.description}
                                title="Asset Description"
                                onChange={e => onUpdate(type === 'character' ? asset.char_id : asset.scene_id, { description: e.target.value })}
                                className="w-full bg-white/5 p-4 rounded-xl border border-white/5 text-zinc-300 text-sm leading-relaxed h-32 resize-none outline-none focus:border-[#D4AF37]/30 transition-colors"
                            />
                        </div>

                        {/* Visual DNA */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">视觉 DNA (提示词)</label>
                            <textarea
                                value={displayPrompt}
                                title="Visual DNA Prompt"
                                onChange={e => onUpdate(type === 'character' ? asset.char_id : asset.scene_id, type === 'character' ? { consistency_seed_prompt: e.target.value } : { visual_anchor_prompt: e.target.value })}
                                className="w-full bg-white/5 p-4 rounded-xl border border-white/5 text-[#D4AF37] text-xs mono leading-relaxed h-40 resize-none outline-none focus:border-[#D4AF37]/30 transition-colors"
                            />
                        </div>

                        {/* Reference Images Gallery */}
                        <div className="pt-8 border-t border-white/5 space-y-6">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">参考图库 / 形象确认</span>
                                <label className="cursor-pointer bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 px-3 py-1.5 rounded-lg text-[9px] font-black hover:bg-[#D4AF37] hover:text-black transition-all">
                                    <span>上传参考图</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        onChange={(e) => onUploadReference?.(e, type === 'character' ? asset.char_id : asset.scene_id)}
                                    />
                                </label>
                            </div>

                            {/* Confirmed / Active Reference */}
                            <div className="p-4 bg-[#D4AF37]/5 border border-[#D4AF37]/20 rounded-2xl flex items-center gap-4">
                                <label className="w-16 h-16 rounded-xl bg-zinc-900 border border-white/5 overflow-hidden flex-shrink-0 cursor-pointer hover:border-[#D4AF37]/50 transition-colors group relative">
                                    {asset.reference_image_url ? (
                                        <img src={getProxiedUrl(asset.reference_image_url)} className="w-full h-full object-cover" alt="confirmed" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[20px] transition-transform group-hover:scale-110">📸</div>
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white font-bold transition-opacity">更换</div>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => onSetAsReference?.(type === 'character' ? asset.char_id : asset.scene_id, reader.result as string);
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                </label>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-[10px] font-black text-white uppercase mb-1">已确认的视觉锚点</h4>
                                    <p className="text-[9px] text-zinc-500 truncate">{asset.reference_image_url ? '生成时将以此图为核心参考' : '尚未锁定形象，点击图标上传或从库中选择'}</p>
                                </div>
                                {asset.reference_image_url && (
                                    <button
                                        onClick={() => onUpdate(type === 'character' ? asset.char_id : asset.scene_id, { reference_image_url: undefined })}
                                        className="p-2 text-zinc-600 hover:text-red-400 transition-colors"
                                        title="清除确认形象"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                )}
                            </div>

                            {/* Gallery Grid */}
                            <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                                {(asset.candidate_reference_images || []).map((imgUrl: string, idx: number) => (
                                    <div key={idx} className="group relative aspect-square rounded-xl bg-zinc-900 border border-white/5 overflow-hidden">
                                        <img src={getProxiedUrl(imgUrl)} className="w-full h-full object-cover" alt={`ref-${idx}`} />
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 px-1">
                                            <button
                                                onClick={() => onSetAsReference?.(type === 'character' ? asset.char_id : asset.scene_id, imgUrl)}
                                                className="p-1.5 bg-[#D4AF37] text-black rounded-lg hover:scale-110 transition-transform"
                                                title="设为确认形象"
                                            >
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                            </button>
                                            <button
                                                onClick={() => onRemoveReference?.(type === 'character' ? asset.char_id : asset.scene_id, imgUrl)}
                                                className="p-1.5 bg-red-500/80 text-white rounded-lg hover:scale-110 transition-transform"
                                                title="删除"
                                            >
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                        {imgUrl === asset.reference_image_url && (
                                            <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#D4AF37] shadow-[0_0_5px_#D4AF37]" />
                                        )}
                                    </div>
                                ))}
                                <label className="aspect-square rounded-xl border border-dashed border-zinc-800 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-white/5 transition-colors group">
                                    <svg className="w-4 h-4 text-zinc-700 group-hover:text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    <span className="text-[8px] text-zinc-700 group-hover:text-zinc-500 uppercase font-black">添加</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => onUploadReference?.(e, type === 'character' ? asset.char_id : asset.scene_id)}
                                    />
                                </label>
                            </div>
                        </div>

                        {/* Advanced Prompt Editor */}
                        <PromptEditor
                            defaultPrompt={defaultPrompt}
                            onRegenerate={(p) => onRegenerate(type === 'character' ? asset.char_id : asset.scene_id, p)}
                            isRendering={isRendering}
                            label="高级生成设置"
                        />

                        {/* Voice Cloning (Character Only) */}
                        {type === 'character' && onUploadAudio && onCloneVoice && (
                            <div className="pt-8 border-t border-white/5 space-y-4">
                                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block">声音克隆</span>

                                <div className="flex gap-4">
                                    <label className="flex-1 cursor-pointer bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl flex flex-col items-center justify-center p-6 transition-all group">
                                        <input type="file" accept="audio/*" className="hidden" onChange={(e) => onUploadAudio(e, asset.char_id)} />
                                        <span className="text-zinc-400 text-xs mb-1 group-hover:text-white">参考音频</span>
                                        {asset.voice_ref_audio_url ? (
                                            <span className="text-[#D4AF37] text-[10px] font-bold">已上传 ✓</span>
                                        ) : (
                                            <span className="text-zinc-600 text-[10px]">上传 mp3/wav</span>
                                        )}
                                    </label>

                                    <div className="flex-[2] space-y-2">
                                        <textarea
                                            value={asset.voice_sample_text || ''}
                                            title="Voice Sample Text"
                                            onChange={e => onUpdate(asset.char_id, { voice_sample_text: e.target.value })}
                                            placeholder="用于声音样本的文字..."
                                            className="w-full bg-white/5 p-3 rounded-xl border border-white/10 text-xs text-zinc-300 h-[86px] resize-none outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => onCloneVoice(asset.char_id, asset.voice_ref_audio_url, asset.voice_sample_text!)}
                                        disabled={isCloning || !asset.voice_ref_audio_url || !asset.voice_sample_text}
                                        className="px-6 py-3 bg-[#D4AF37] disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-bold uppercase text-xs rounded-xl hover:bg-white transition-colors flex-shrink-0"
                                    >
                                        {isCloning ? '克隆中...' : '生成声音'}
                                    </button>
                                    {asset.voice_preview_url && <audio controls src={getProxiedUrl(asset.voice_preview_url)} className="h-10 w-full" />}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

/* --- Main Component --- */

interface SelectedAsset {
    type: 'character' | 'scene';
    id: string;
}

const AssetManager: React.FC<AssetManagerProps> = ({
    className,
    onReRenderCharacter,
    onReRenderScene,
    onGenerateAll,
    onRefineDNA,
    isGenerating
}) => {
    const globalContext = useProjectStore((state) => state.globalContext);
    const updateCharacter = useProjectStore((state) => state.updateCharacter);
    const updateScene = useProjectStore((state) => state.updateScene);
    const deleteCharacter = useProjectStore((state) => state.deleteCharacter);
    const deleteScene = useProjectStore((state) => state.deleteScene);
    const updateGlobalContext = useProjectStore((state) => state.updateGlobalContext);

    const { setIsAnalyzing, setStatusMessage, showToast } = useUIStore();

    const [selectedAsset, setSelectedAsset] = useState<SelectedAsset | null>(null);
    const [renderingId, setRenderingId] = useState<string | null>(null);
    const [cloningId, setCloningId] = useState<string | null>(null);

    const { script, projectMetadata, storyboard } = useProjectStore();
    const addCharacterStore = useProjectStore((state) => state.addCharacter);
    const addSceneStore = useProjectStore((state) => state.addScene);

    const [isCreating, setIsCreating] = useState<'character' | 'scene' | null>(null);
    const [newName, setNewName] = useState('');

    const handleCreateAsset = () => {
        if (!newName.trim()) return;
        let id = '';
        if (isCreating === 'character') {
            id = addCharacterStore(newName);
        } else {
            id = addSceneStore(newName);
        }
        setSelectedAsset({ type: isCreating, id });
        setIsCreating(null);
        setNewName('');
    };

    const handleExport = async () => {
        setIsAnalyzing(true);
        setStatusMessage("正在准备素材，请稍候...");
        try {
            await exportProjectToZip(
                "Project",
                script,
                globalContext,
                storyboard,
                projectMetadata,
                setStatusMessage
            );
            showToast("项目导出成功", "success");
        } catch (error: any) {
            showToast(`导出失败: ${error.message}`, "error");
        } finally {
            setIsAnalyzing(false);
            setStatusMessage("");
        }
    };

    // Handlers
    const handleReRender = async (id: string, prompt: string, type: 'character' | 'scene') => {
        setRenderingId(id);
        try {
            if (type === 'character' && onReRenderCharacter) await onReRenderCharacter(id, prompt);
            if (type === 'scene' && onReRenderScene) await onReRenderScene(id, prompt);
        } finally {
            setRenderingId(null);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, charId: string) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            updateCharacter(charId, { voice_ref_audio_url: reader.result as string });
        };
        reader.readAsDataURL(file);
    };

    const handleUploadReference = async (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const uploadPromises = files.map(file => {
            return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(file);
            });
        });

        const results = await Promise.all(uploadPromises);
        const type = globalContext.characters.find(c => c.char_id === id) ? 'character' : 'scene';

        if (type === 'character') {
            const char = globalContext.characters.find(c => c.char_id === id);
            const currentImages = char?.candidate_reference_images || [];
            updateCharacter(id, { candidate_reference_images: [...currentImages, ...results] });
        } else {
            const scene = globalContext.scenes.find(s => s.scene_id === id);
            const currentImages = scene?.candidate_reference_images || [];
            updateScene(id, { candidate_reference_images: [...currentImages, ...results] });
        }
    };

    const handleSetAsReference = (id: string, url: string) => {
        const type = globalContext.characters.find(c => c.char_id === id) ? 'character' : 'scene';
        if (type === 'character') {
            updateCharacter(id, { reference_image_url: url });
        } else {
            updateScene(id, { reference_image_url: url });
        }
    };

    const handleRemoveReference = (id: string, url: string) => {
        const type = globalContext.characters.find(c => c.char_id === id) ? 'character' : 'scene';
        if (type === 'character') {
            const char = globalContext.characters.find(c => c.char_id === id);
            const remaining = (char?.candidate_reference_images || []).filter(img => img !== url);
            const updates: any = { candidate_reference_images: remaining };
            if (char?.reference_image_url === url) updates.reference_image_url = undefined;
            updateCharacter(id, updates);
        } else {
            const scene = globalContext.scenes.find(s => s.scene_id === id);
            const remaining = (scene?.candidate_reference_images || []).filter(img => img !== url);
            const updates: any = { candidate_reference_images: remaining };
            if (scene?.reference_image_url === url) updates.reference_image_url = undefined;
            updateScene(id, updates);
        }
    };

    const handleCloneVoice = async (charId: string, audioUrl: string, text: string) => {
        setCloningId(charId);
        try {
            const resultUrl = await cloneVoice(audioUrl, text);
            updateCharacter(charId, { voice_preview_url: resultUrl });
            alert("声音克隆成功！");
        } catch (error: any) {
            alert(`声音克隆失败: ${error.message}`);
        } finally {
            setCloningId(null);
        }
    };

    const handleDeleteAsset = (id: string, type: 'character' | 'scene') => {
        if (type === 'character') {
            deleteCharacter(id);
        } else {
            deleteScene(id);
        }
        setSelectedAsset(null);
    };

    const hasAnyMissing = globalContext.scenes.some(s => !s.preview_url) || globalContext.characters.some(c => !c.preview_url);

    // Derive current asset object for modal
    const currentAsset = selectedAsset
        ? (selectedAsset.type === 'character'
            ? globalContext.characters.find(c => c.char_id === selectedAsset.id)
            : globalContext.scenes.find(s => s.scene_id === selectedAsset.id))
        : null;

    return (
        <div className={`space-y-12 animate-in fade-in duration-1000 ${className}`}>
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/10 pb-10 gap-6">
                <div>
                    <h2 className="text-4xl font-black italic serif uppercase mb-2">我的资产</h2>
                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.4em]">
                        {globalContext.scenes.length} 个场景 · {globalContext.characters.length} 个角色
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    {/* Engine Selector */}
                    <div className="bg-[#111] border border-white/10 p-2 rounded-2xl flex items-center shadow-inner">
                        <div className="px-4 flex flex-col mr-3">
                            <span className="text-[8px] font-black uppercase text-zinc-500 mb-0.5">引擎</span>
                            <span className="text-[9px] font-bold text-[#D4AF37]">{globalContext.image_engine.toUpperCase()}</span>
                        </div>
                        <div className="flex gap-1 overflow-x-auto max-w-[200px] no-scrollbar">
                            {IMAGE_ENGINES.map(engine => (
                                <button
                                    key={engine.value}
                                    onClick={() => updateGlobalContext({ image_engine: engine.value as any })}
                                    className={`px-3 py-1.5 rounded-xl transition-all text-[9px] font-black uppercase whitespace-nowrap ${globalContext.image_engine === engine.value ? 'bg-[#D4AF37] text-black' : 'bg-white/5 text-zinc-400 hover:text-white'}`}
                                >
                                    {engine.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    {onGenerateAll && (
                        <button
                            onClick={onGenerateAll}
                            disabled={isGenerating || !hasAnyMissing}
                            className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all
                                ${isGenerating ? 'bg-zinc-800 text-zinc-500' : 'bg-[#D4AF37] text-black hover:bg-white'}`}
                        >
                            {isGenerating ? '生成中...' : '生成全部'}
                        </button>
                    )}
                    <button
                        onClick={handleExport}
                        disabled={isGenerating}
                        className="px-8 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                        title="导出完整项目包 (包含素材)"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        备份 (.zip)
                    </button>
                </div>
            </div>

            {/* Scenes Grid */}
            <div>
                <div className="flex items-center justify-between mb-8 pl-1">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-[#D4AF37]">场景</h3>
                    <button
                        onClick={() => setIsCreating('scene')}
                        className="flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-[9px] text-zinc-500 hover:text-[#D4AF37] hover:bg-white/10 hover:border-[#D4AF37]/30 transition-all font-bold uppercase tracking-widest"
                    >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        手动添加场景
                    </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {globalContext.scenes.map(scene => (
                        <AssetCard
                            key={scene.scene_id}
                            item={scene}
                            type="scene"
                            onClick={() => setSelectedAsset({ type: 'scene', id: scene.scene_id })}
                        />
                    ))}
                </div>
            </div>

            {/* Characters Grid */}
            <div>
                <div className="flex items-center justify-between mb-8 pl-1">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-[#D4AF37]">角色</h3>
                    <button
                        onClick={() => setIsCreating('character')}
                        className="flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-[9px] text-zinc-500 hover:text-[#D4AF37] hover:bg-white/10 hover:border-[#D4AF37]/30 transition-all font-bold uppercase tracking-widest"
                    >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        手动添加角色
                    </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {globalContext.characters.map(char => (
                        <AssetCard
                            key={char.char_id}
                            item={char}
                            type="character"
                            onClick={() => setSelectedAsset({ type: 'character', id: char.char_id })}
                        />
                    ))}
                </div>
            </div>

            {/* Detail Modal */}
            {selectedAsset && currentAsset && (
                <DetailModal
                    asset={currentAsset}
                    type={selectedAsset.type}
                    onClose={() => setSelectedAsset(null)}
                    onUpdate={selectedAsset.type === 'character' ? updateCharacter : updateScene}
                    onRegenerate={(id, prompt) => handleReRender(id, prompt, selectedAsset.type)}
                    isRendering={renderingId === selectedAsset.id}
                    onUploadAudio={handleFileUpload}
                    onUploadReference={handleUploadReference}
                    onSetAsReference={handleSetAsReference}
                    onRemoveReference={handleRemoveReference}
                    onCloneVoice={handleCloneVoice}
                    onRefineDNA={onRefineDNA}
                    onDelete={handleDeleteAsset}
                    isCloning={cloningId === selectedAsset.id}
                    stylePreset={globalContext.visual_style_preset}
                />
            )}

            {/* Creation Modal */}
            {isCreating && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-4">
                    <div className="bg-[#121212] border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-2">添加新{isCreating === 'character' ? '角色' : '场景'}</h3>
                        <p className="text-zinc-500 text-sm mb-6">请输入名称，手动添加后可在分镜生成中选择</p>

                        <input
                            autoFocus
                            type="text"
                            placeholder="例如：林深 / 秘密基地"
                            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white text-sm focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] outline-none mb-6"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateAsset();
                            }}
                        />

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setIsCreating(null);
                                    setNewName('');
                                }}
                                className="px-6 py-2 text-zinc-400 hover:text-white transition-colors text-sm"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleCreateAsset}
                                disabled={!newName.trim()}
                                className="px-8 py-2 bg-[#D4AF37] hover:bg-[#F0D060] disabled:bg-zinc-800 disabled:text-zinc-500 text-black font-bold rounded-xl transition-all shadow-lg active:scale-95"
                            >
                                确认添加
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AssetManager;
