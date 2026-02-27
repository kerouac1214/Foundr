import React, { useState, useEffect, useRef } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import StoryboardCard from './StoryboardCard';
import { StoryboardItem, GlobalContext } from '../types';

interface StoryboardBoardProps {
    className?: string;
    onRenderPhoto: (index: number) => Promise<void>;
    onRenderCandidates: (index: number) => Promise<void>;
    onRenderVideo: (index: number) => Promise<void>;
    mode?: 'text-only' | 'visual';
    layout?: 'list' | 'grid';
    viewMode?: 'images_only' | 'videos_only';
}

/* --- Detail Modal --- */

const ShotDetailModal: React.FC<{
    item: StoryboardItem;
    context: GlobalContext;
    onClose: () => void;
    onUpdate: (updates: Partial<StoryboardItem>) => void;
    onRenderPhoto: () => Promise<void>;
    onRenderCandidates: () => Promise<void>;
    onRenderVideo: () => Promise<void>;
    allItems: StoryboardItem[];
    onNavigate: (item: StoryboardItem) => void;
}> = ({ item, context, onClose, onUpdate, onRenderPhoto, onRenderCandidates, onRenderVideo, allItems, onNavigate }) => {

    // Prevent body scroll & Handle Keyboard Navigation
    useEffect(() => {
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'ArrowRight') handleNext();
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = 'unset';
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [item]); // Re-bind when item changes to ensure simple logic

    const currentIndex = allItems.findIndex(i => i.id === item.id);
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex < allItems.length - 1;

    const handlePrev = () => {
        if (hasPrev) onNavigate(allItems[currentIndex - 1]);
    };

    const handleNext = () => {
        if (hasNext) onNavigate(allItems[currentIndex + 1]);
    };

    const scene = context.scenes.find(s => s.scene_id === item.scene_id);
    const filmstripRef = useRef<HTMLDivElement>(null);

    // Auto-scroll filmstrip
    useEffect(() => {
        if (filmstripRef.current) {
            const activeEl = filmstripRef.current.querySelector(`[data-id="${item.id}"]`);
            if (activeEl) {
                activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, [item.id]);

    const [showPrompt, setShowPrompt] = useState(false);
    const [showVideo, setShowVideo] = useState(false);

    // Reset video view when navigating
    useEffect(() => {
        setShowVideo(false);
    }, [item.id]);

    const copyPrompt = () => {
        if (item.image_prompt) {
            navigator.clipboard.writeText(item.image_prompt);
            // Could show a toast here, but simple is fine for now
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-200">
            {/* Immersive Navigation Buttons (Left/Right) */}
            {hasPrev && (
                <button onClick={handlePrev} className="absolute left-4 top-1/2 -translate-y-1/2 p-4 text-white/20 hover:text-white hover:bg-white/5 rounded-full z-[60] transition-all group">
                    <svg className="w-8 h-8 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 19l-7-7 7-7" /></svg>
                </button>
            )}
            {hasNext && (
                <button onClick={handleNext} className="absolute right-4 top-1/2 -translate-y-1/2 p-4 text-white/20 hover:text-white hover:bg-white/5 rounded-full z-[60] transition-all group">
                    <svg className="w-8 h-8 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5l7 7-7 7" /></svg>
                </button>
            )}

            {/* Close Button */}
            <button onClick={onClose} className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors z-[70]">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
                <span className="text-[10px] uppercase font-bold tracking-widest block text-center mt-1">ESC</span>
            </button>

            <div className="w-full h-full flex flex-col md:flex-row overflow-hidden">

                {/* Left Column (Canvas Area) */}
                <div className="w-full md:w-2/3 h-full relative flex flex-col">
                    {/* Main Image Area */}
                    <div className="flex-grow relative flex items-center justify-center p-8 md:p-12 overflow-hidden bg-black/20">
                        {/* Image Wrapper: Strict Aspect Ratio */}
                        <div
                            className={`relative group flex flex-col items-center justify-center shadow-2xl rounded-lg overflow-hidden border border-white/10 ${context.aspect_ratio === '9:16' ? 'aspect-[9/16] h-full max-h-[75vh] w-auto' : 'aspect-video w-full max-w-5xl'}`}
                        >
                            {/* View State: Video vs Image */}
                            {showVideo && item.video_url ? (
                                <div className="w-full h-full relative bg-black">
                                    <video
                                        src={item.video_url}
                                        className="w-full h-full object-cover"
                                        controls
                                        autoPlay
                                        loop
                                    />
                                    <button
                                        onClick={() => setShowVideo(false)}
                                        className="absolute top-4 right-4 p-2 bg-black/50 text-white hover:bg-black/80 rounded-full backdrop-blur-md transition-colors z-20"
                                        title="返回图片"
                                    >
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    </button>
                                </div>
                            ) : item.preview_url ? (
                                <>
                                    <img
                                        src={item.preview_url}
                                        className="w-full h-full object-cover relative z-0"
                                        alt={`Shot ${item.shot_number || currentIndex + 1}`}
                                    />

                                    {/* Video Play Overlay */}
                                    {item.video_url && (
                                        <button
                                            onClick={() => setShowVideo(true)}
                                            className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors group/play z-10"
                                        >
                                            <div className="w-20 h-20 bg-white/10 group-hover/play:bg-[#D4AF37] backdrop-blur-md rounded-full flex items-center justify-center border border-white/20 group-hover/play:border-[#D4AF37] transition-all scale-90 group-hover/play:scale-100 shadow-2xl">
                                                <svg className="w-8 h-8 text-white group-hover/play:text-black ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>
                                            </div>
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div className="flex flex-col items-center gap-4 text-zinc-600 p-20 border border-white/5 rounded-2xl bg-white/5">
                                    <svg className="w-16 h-16 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                    <span className="uppercase tracking-widest text-xs">未生成预览图</span>
                                </div>
                            )}

                            {/* Action Bar Overlay */}
                            <div className={`absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-xl border border-white/10 p-2 rounded-2xl transition-all translate-y-4 z-20 ${showVideo ? 'opacity-0 hover:opacity-100 hover:translate-y-0' : 'opacity-0 group-hover:opacity-100 group-hover:translate-y-0'}`}>
                                <button
                                    onClick={onRenderPhoto}
                                    title="快速渲染"
                                    className="p-2 bg-white text-black hover:bg-zinc-200 rounded-xl transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                </button>
                                <button
                                    onClick={onRenderCandidates}
                                    className="px-4 py-2 bg-white/10 text-white hover:bg-white/20 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors"
                                >
                                    候选帧 (4x)
                                </button>
                                <button
                                    onClick={onRenderVideo}
                                    disabled={!item.preview_url || item.video_status === 'generating'}
                                    className="px-6 py-2 bg-[#D4AF37] text-black hover:bg-[#F0D060] disabled:bg-zinc-800 disabled:text-zinc-500 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2"
                                >
                                    {item.video_status === 'generating' ? '生成中...' : item.video_url ? '重生成视频' : '视频'}
                                </button>
                            </div>
                        </div>

                        {/* Candidate Picker Section */}
                        {item.candidate_image_urls && item.candidate_image_urls.length > 0 && (
                            <div className="absolute top-8 left-8 flex flex-col gap-2 z-30">
                                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">选择最佳帧</span>
                                <div className="grid grid-cols-2 gap-2 p-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl">
                                    {item.candidate_image_urls.map((url, i) => (
                                        <button
                                            key={i}
                                            onClick={() => onUpdate({ preview_url: url })}
                                            className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${item.preview_url === url ? 'border-[#D4AF37]' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                        >
                                            <img src={url} className="w-full h-full object-cover" alt="" />
                                            {item.preview_url === url && (
                                                <div className="absolute inset-0 bg-[#D4AF37]/20 flex items-center justify-center">
                                                    <svg className="w-4 h-4 text-[#D4AF37]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Context Filmstrip (P2) */}
                    <div className="h-24 bg-[#080808] border-t border-white/10 flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent px-4 gap-2 shrink-0 z-40" ref={filmstripRef}>
                        {allItems.map((shot) => (
                            <button
                                key={shot.id}
                                data-id={shot.id}
                                onClick={() => onNavigate(shot)}
                                className={`relative w-32 h-16 shrink-0 rounded-lg overflow-hidden border transition-all ${shot.id === item.id ? 'border-[#D4AF37] ring-2 ring-[#D4AF37]/20 scale-105 z-10' : 'border-white/10 opacity-50 hover:opacity-100'}`}
                            >
                                {shot.preview_url ? (
                                    <img src={shot.preview_url} className="w-full h-full object-cover" alt="" />
                                ) : (
                                    <div className="w-full h-full bg-white/5 flex items-center justify-center text-[9px] text-zinc-600 font-mono">#{shot.shot_number || '??'}</div>
                                )}
                                <div className="absolute bottom-0 right-0 bg-black/60 px-1 text-[8px] text-white font-mono">#{shot.shot_number || '??'}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right: Inspector */}
                <div className="w-full md:w-1/3 h-full bg-[#0A0A0A] border-l border-white/5 p-8 flex flex-col gap-8 overflow-y-auto shrink-0 z-50">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-[4rem] font-black text-white/5 leading-none absolute select-none pointer-events-none">#{item.shot_number || currentIndex + 1}</span>
                            <span className="px-3 py-1 bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20 rounded-full text-[10px] font-bold uppercase tracking-wider z-10 relative">镜头 {item.shot_number || currentIndex + 1}</span>
                            <div className="flex gap-2 relative z-10">
                                <span className="px-2 py-1 bg-white/5 rounded text-[10px] text-zinc-400 border border-white/5">{item.shot_type}</span>
                                <span className="px-2 py-1 bg-white/5 rounded text-[10px] text-zinc-400 border border-white/5">{item.camera_movement}</span>
                            </div>
                        </div>

                        <div className="space-y-6 relative z-10 pt-2">
                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">画面描述</label>
                                <textarea
                                    value={item.action_description}
                                    onChange={(e) => onUpdate({ action_description: e.target.value })}
                                    className="w-full bg-white/5 p-4 rounded-xl border border-white/10 text-zinc-300 text-xs leading-relaxed h-32 resize-none outline-none focus:border-[#D4AF37]/30 transition-colors"
                                    placeholder="描述动作与画面细节..."
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">音频 / 对白</label>
                                <textarea
                                    value={item.lyric_line}
                                    onChange={(e) => onUpdate({ lyric_line: e.target.value })}
                                    className="w-full bg-transparent border-b border-white/10 p-2 text-zinc-400 italic text-sm outline-none focus:border-[#D4AF37]/50 transition-colors resize-none h-20"
                                    placeholder="对白或音频提示..."
                                />
                            </div>

                            {/* Scene & Characters */}
                            <div className="pt-6 border-t border-white/5 space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">场景</span>
                                    <span className="text-xs text-zinc-300 truncate max-w-[150px]">{scene?.name || '自动检测'}</span>
                                </div>
                                <div className="space-y-2">
                                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">角色</span>
                                    <div className="flex gap-1 flex-wrap mb-2">
                                        {context.characters.filter(c => item.character_ids?.includes(c.char_id)).map(c => (
                                            <span key={c.char_id} className="text-[10px] text-[#D4AF37] bg-white/10 px-1.5 py-0.5 rounded">
                                                {c.name}
                                            </span>
                                        ))}
                                        {item.character_ids?.length === 0 && <span className="text-[10px] text-zinc-600 italic">无</span>}
                                    </div>
                                </div>
                            </div>

                            {/* Prompt X-Ray (P1) */}
                            <div className="pt-6 border-t border-white/5">
                                <button
                                    onClick={() => setShowPrompt(!showPrompt)}
                                    className="w-full flex items-center justify-between text-[9px] font-black text-zinc-500 uppercase tracking-widest hover:text-zinc-300 transition-colors"
                                >
                                    <span>Prompt 详情</span>
                                    <svg className={`w-3 h-3 transition-transform ${showPrompt ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </button>

                                {showPrompt && (
                                    <div className="mt-2 animate-in slide-in-from-top-1 fade-in duration-200">
                                        <div className="bg-[#050505] p-3 rounded-lg border border-white/10 relative group">
                                            {item.image_prompt ? (
                                                <>
                                                    <p className="text-[10px] text-zinc-400 font-mono leading-relaxed max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                                                        {item.image_prompt}
                                                    </p>
                                                    <button
                                                        onClick={copyPrompt}
                                                        className="absolute top-2 right-2 p-1 bg-white/10 hover:bg-white/20 rounded text-zinc-300 transition-colors opacity-0 group-hover:opacity-100"
                                                        title="复制 Prompt"
                                                    >
                                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                                    </button>
                                                </>
                                            ) : (
                                                <p className="text-[10px] text-zinc-600 font-mono italic">
                                                    Prompt 不可用。请重新执行以查看。
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


const StoryboardBoard: React.FC<StoryboardBoardProps> = ({ className, onRenderPhoto, onRenderCandidates, onRenderVideo, mode = 'visual', layout = 'list', viewMode }) => {
    const storyboard = useProjectStore((state) => state.storyboard);
    const globalContext = useProjectStore((state) => state.globalContext);
    const updateShot = useProjectStore((state) => state.updateShot);

    const [selectedShot, setSelectedShot] = useState<StoryboardItem | null>(null);

    if (!storyboard || storyboard.length === 0) {
        return (
            <div className={`flex items-center justify-center h-[50vh] text-zinc-500 ${className}`}>
                <div className="text-center space-y-4">
                    <p className="text-xl font-bold">暂无分镜</p>
                    <p className="text-sm">请先在剧本页面生成分镜</p>
                </div>
            </div>
        );
    }

    // Function to handle rendering within modal context
    // We need to pass the index of the CURRENT selected shot
    const handleRenderCurrent = async (item: StoryboardItem, type: 'photo' | 'candidates' | 'video') => {
        const idx = storyboard.findIndex(s => s.id === item.id);
        if (idx === -1) return;
        if (type === 'photo') await onRenderPhoto(idx);
        if (type === 'candidates') await onRenderCandidates(idx);
        if (type === 'video') await onRenderVideo(idx);
    };

    return (
        <div className={`animate-in fade-in duration-700 ${className}`}>
            <div className="flex justify-between items-end border-b border-white/10 pb-6 mb-6">
                <div>
                    <h2 className="text-2xl font-black italic serif uppercase">分镜脚本</h2>
                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.3em]">{storyboard.length} 个镜头</p>
                </div>
            </div>

            <div className={layout === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6' : 'space-y-6'}>
                {storyboard.map((item, idx) => (
                    <StoryboardCard
                        key={item.id}
                        item={item}
                        context={globalContext}
                        onUpdate={(u) => updateShot(item.id, u)}
                        onRenderPhoto={() => onRenderPhoto(idx)}
                        onRenderVideo={() => onRenderVideo(idx)}
                        mode={mode}
                        viewMode={viewMode}
                        // Only enable click in visual mode (which implies Step 4)
                        onImageClick={mode === 'visual' ? () => setSelectedShot(item) : undefined}
                    />
                ))}
            </div>

            {/* Detail Modal */}
            {selectedShot && (
                <ShotDetailModal
                    item={selectedShot}
                    context={globalContext}
                    onClose={() => setSelectedShot(null)}
                    onUpdate={(u) => updateShot(selectedShot.id, u)}
                    onRenderPhoto={() => handleRenderCurrent(selectedShot, 'photo')}
                    onRenderCandidates={() => handleRenderCurrent(selectedShot, 'candidates')}
                    onRenderVideo={() => handleRenderCurrent(selectedShot, 'video')}
                    allItems={storyboard}
                    onNavigate={setSelectedShot}
                />
            )}
        </div>
    );
};

export default StoryboardBoard;
