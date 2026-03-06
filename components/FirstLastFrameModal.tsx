import React, { useState, useRef } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { runFirstLastFrameVideo, uploadFile } from '../services/runningHubService';
import Toast from './Toast';

interface FirstLastFrameModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const FirstLastFrameModal: React.FC<FirstLastFrameModalProps> = ({ isOpen, onClose }) => {
    const { storyboard, updateShot } = useProjectStore();
    const [firstFrameFile, setFirstFrameFile] = useState<File | null>(null);
    const [lastFrameFile, setLastFrameFile] = useState<File | null>(null);
    const [firstFramePreview, setFirstFramePreview] = useState<string | null>(null);
    const [lastFramePreview, setLastFramePreview] = useState<string | null>(null);
    const [prompt, setPrompt] = useState('');
    const [duration, setDuration] = useState(5);
    const [selectedShotId, setSelectedShotId] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [resultVideoUrl, setResultVideoUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const firstInputRef = useRef<HTMLInputElement>(null);
    const lastInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'first' | 'last') => {
        const file = e.target.files?.[0];
        if (file) {
            if (type === 'first') {
                setFirstFrameFile(file);
                setFirstFramePreview(URL.createObjectURL(file));
            } else {
                setLastFrameFile(file);
                setLastFramePreview(URL.createObjectURL(file));
            }
            setResultVideoUrl(null);
        }
    };

    const handleGenerate = async () => {
        if (!firstFrameFile || !lastFrameFile) {
            setError("请分别上传首帧和尾帧图片 (PNG/JPG)");
            return;
        }
        if (!prompt.trim()) {
            setError("请输入转场提示词 (e.g. smooth zoom in)");
            return;
        }

        setIsGenerating(true);
        setError(null);
        try {
            console.log("[FirstLastFrame] Starting upload...");
            const firstUrl = await uploadFile(firstFrameFile, `first_${Date.now()}.png`);
            const lastUrl = await uploadFile(lastFrameFile, `last_${Date.now()}.png`);

            console.log("[FirstLastFrame] Starting generation...");
            const videoUrl = await runFirstLastFrameVideo({
                prompt,
                firstFrameUrl: firstUrl,
                lastFrameUrl: lastUrl,
                duration
            });

            if (videoUrl) {
                setResultVideoUrl(videoUrl);

                // Link to shot if selected
                if (selectedShotId) {
                    updateShot(selectedShotId, {
                        video_url: videoUrl,
                        video_status: 'ready'
                    });
                    setSuccess(`已成功关联至 镜头 ${storyboard.find(s => s.id === selectedShotId)?.shot_number}`);
                }
            } else {
                throw new Error("生成视频失败，未返回有效地址");
            }
        } catch (err: any) {
            console.error("Failed to generate video:", err);
            setError(err.message || "生成失败，请检查网络和 API 配置");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in">
            <div className="w-full max-w-5xl h-[85vh] mx-4 bg-[#0a0a0a] rounded-[3rem] border border-white/10 overflow-hidden shadow-2xl flex flex-col">
                {/* Header */}
                <div className="px-12 py-8 border-b border-white/10 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-2xl font-black mb-1 bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent italic uppercase serif">首尾帧视频生成 (First & Last Frame)</h2>
                        <p className="text-zinc-500 text-sm font-medium tracking-wide">上传起始与终点画面，以 AI 编织流动的叙事连环</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors"
                        title="关闭"
                    >
                        <svg className="w-6 h-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-12 space-y-10">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        {/* Left: Input */}
                        <div className="space-y-8">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <label className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] serif">首帧 (First Frame)</label>
                                    <div
                                        onClick={() => firstInputRef.current?.click()}
                                        className={`aspect-[9/16] rounded-3xl border-2 border-dashed transition-all cursor-pointer group relative overflow-hidden flex items-center justify-center
                                            ${firstFramePreview ? 'border-[#D4AF37] bg-[#D4AF37]/5' : 'border-white/10 hover:border-white/20 bg-white/2'}`}
                                    >
                                        {firstFramePreview ? (
                                            <img src={firstFramePreview} alt="First Frame" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="flex flex-col items-center text-center p-4">
                                                <div className="w-10 h-10 rounded-xl bg-white/5 text-zinc-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                </div>
                                                <span className="text-[10px] text-zinc-600 font-black uppercase">上传首帧</span>
                                            </div>
                                        )}
                                    </div>
                                    <input type="file" ref={firstInputRef} onChange={(e) => handleFileChange(e, 'first')} accept="image/*" className="hidden" title="上传首帧图片" />
                                </div>

                                <div className="space-y-4">
                                    <label className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] serif">尾帧 (Last Frame)</label>
                                    <div
                                        onClick={() => lastInputRef.current?.click()}
                                        className={`aspect-[9/16] rounded-3xl border-2 border-dashed transition-all cursor-pointer group relative overflow-hidden flex items-center justify-center
                                            ${lastFramePreview ? 'border-[#D4AF37] bg-[#D4AF37]/5' : 'border-white/10 hover:border-white/20 bg-white/2'}`}
                                    >
                                        {lastFramePreview ? (
                                            <img src={lastFramePreview} alt="Last Frame" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="flex flex-col items-center text-center p-4">
                                                <div className="w-10 h-10 rounded-xl bg-white/5 text-zinc-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                                </div>
                                                <span className="text-[10px] text-zinc-600 font-black uppercase">上传尾帧</span>
                                            </div>
                                        )}
                                    </div>
                                    <input type="file" ref={lastInputRef} onChange={(e) => handleFileChange(e, 'last')} accept="image/*" className="hidden" title="上传尾帧图片" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label htmlFor="video-prompt" className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] serif">提示词 (Transition Prompt)</label>
                                <textarea
                                    id="video-prompt"
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="描述镜头运动，例如：smooth zoom in into character's eyes..."
                                    className="w-full h-24 bg-[#121212] border border-white/10 rounded-3xl p-6 text-white text-sm font-medium focus:outline-none focus:border-[#D4AF37] transition-all resize-none shadow-inner"
                                    title="输入转场提示词"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <label htmlFor="video-duration" className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] serif">时长 (Duration)</label>
                                    <div className="flex items-center gap-4 bg-[#121212] border border-white/10 rounded-2xl p-4">
                                        <input
                                            id="video-duration"
                                            type="range"
                                            min="3"
                                            max="10"
                                            step="1"
                                            value={duration}
                                            onChange={(e) => setDuration(parseInt(e.target.value))}
                                            className="flex-grow accent-[#D4AF37]"
                                            title="设置视频时长"
                                        />
                                        <span className="text-sm font-black text-white w-8">{duration}s</span>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <label htmlFor="link-shot" className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] serif">关联分镜 (Link)</label>
                                    <select
                                        id="link-shot"
                                        value={selectedShotId}
                                        onChange={(e) => setSelectedShotId(e.target.value)}
                                        title="关联至分镜"
                                        className="w-full bg-[#121212] border border-white/10 rounded-2xl p-4 text-white font-bold focus:outline-none focus:border-[#D4AF37] transition-all cursor-pointer"
                                    >
                                        <option value="">不关联</option>
                                        {storyboard.map(shot => (
                                            <option key={shot.id} value={shot.id}>
                                                镜头 {shot.shot_number}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || !firstFrameFile || !lastFrameFile || !prompt.trim()}
                                className={`w-full py-5 rounded-[2rem] text-sm font-black transition-all flex items-center justify-center gap-4 uppercase tracking-widest
                                    ${isGenerating || !firstFrameFile || !lastFrameFile || !prompt.trim()
                                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                        : 'bg-white text-black hover:bg-[#D4AF37] shadow-xl hover:shadow-[#D4AF37]/20'}`}
                            >
                                {isGenerating ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
                                        视频编织中...
                                    </>
                                ) : '生成视频 (Generate Video)'}
                            </button>
                        </div>

                        {/* Right: Preview */}
                        <div className="flex flex-col">
                            <label className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] mb-4 serif">生成结果 (Final Preview)</label>
                            <div className="flex-grow rounded-[2.5rem] bg-[#121212] border border-white/5 flex flex-col items-center justify-center p-8 relative overflow-hidden shadow-inner">
                                {resultVideoUrl ? (
                                    <div className="w-full h-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 flex flex-col">
                                        <div className="flex-grow flex items-center justify-center bg-black rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative group/player">
                                            <video src={resultVideoUrl} controls autoPlay loop className="max-w-full max-h-full" />
                                        </div>
                                        <div className="flex justify-center gap-4">
                                            <a
                                                href={resultVideoUrl}
                                                download="transition-video.mp4"
                                                className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-[#D4AF37] hover:border-[#D4AF37]/30 transition-all"
                                                title="下载视频"
                                            >
                                                下载视频 (Download)
                                            </a>
                                        </div>
                                    </div>
                                ) : isGenerating ? (
                                    <div className="text-center space-y-6">
                                        <div className="w-20 h-20 rounded-full border-4 border-[#D4AF37]/20 border-t-[#D4AF37] animate-spin mx-auto shadow-[0_0_20px_rgba(212,175,55,0.2)]" />
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#D4AF37]">Neural Synthesis</p>
                                            <p className="text-[8px] font-medium text-zinc-600 uppercase tracking-widest animate-pulse">Encoding temporal consistency...</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center space-y-4 opacity-30 group">
                                        <div className="w-20 h-20 rounded-full border border-white/10 flex items-center justify-center mx-auto transition-transform group-hover:scale-105">
                                            <svg className="w-10 h-10 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">等待视频生成 (Awaiting Video)</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {error && <Toast message={error} type="error" onClose={() => setError(null)} />}
            {success && <Toast message={success} type="success" onClose={() => setSuccess(null)} />}
        </div>
    );
};

export default FirstLastFrameModal;
