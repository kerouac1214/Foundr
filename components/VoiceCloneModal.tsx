import React, { useState, useRef } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { cloneVoice } from '../services/runningHubService';
import Toast from './Toast';

interface VoiceCloneModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const VoiceCloneModal: React.FC<VoiceCloneModalProps> = ({ isOpen, onClose }) => {
    const { storyboard, updateShot } = useProjectStore();
    const [audioFile, setAudioFile] = useState<File | null>(null);
    const [audioBase64, setAudioBase64] = useState<string | null>(null);
    const [text, setText] = useState('');
    const [selectedShotId, setSelectedShotId] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [resultAudioUrl, setResultAudioUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAudioFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setAudioBase64(base64String.split(',')[1]);
                setResultAudioUrl(null);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = async () => {
        if (!audioBase64) {
            setError("请先上传声音样本 (WAV/MP3)");
            return;
        }
        if (!text.trim()) {
            setError("请输入要转换的任务文本");
            return;
        }

        setIsGenerating(true);
        setError(null);
        try {
            console.log("[VoiceClone] Starting cloning process...");
            const audioUrl = await cloneVoice(audioBase64, text);
            if (audioUrl) {
                setResultAudioUrl(audioUrl);

                // Link to shot if selected
                if (selectedShotId) {
                    updateShot(selectedShotId, {
                        audio_url: audioUrl,
                        // We don't have exact duration here, but we can set a placeholder or let the user adjust
                        sound_design: text
                    });
                    setSuccess(`已成功关联至 镜头 ${storyboard.find(s => s.id === selectedShotId)?.shot_number}`);
                }
            } else {
                throw new Error("生成音频失败，未返回有效地址");
            }
        } catch (err: any) {
            console.error("Failed to clone voice:", err);
            setError(err.message || "克隆失败，请检查网络和 API 配置");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in">
            <div className="w-full max-w-4xl h-[80vh] mx-4 bg-[#0a0a0a] rounded-[3rem] border border-white/10 overflow-hidden shadow-2xl flex flex-col">
                {/* Header */}
                <div className="px-12 py-8 border-b border-white/10 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-2xl font-black mb-1 bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent italic uppercase serif">声音克隆 (Voice Clone)</h2>
                        <p className="text-zinc-500 text-sm font-medium tracking-wide">上传 3-10 秒样本，以 AI 之力重塑人类声纹</p>
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
                            <div className="space-y-4">
                                <label className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] serif">1. 声音样本 (Voice Sample)</label>
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`p-8 rounded-3xl border-2 border-dashed transition-all cursor-pointer group
                                        ${audioFile ? 'border-[#D4AF37] bg-[#D4AF37]/5' : 'border-white/10 hover:border-white/20 bg-white/2'}`}
                                >
                                    <div className="flex flex-col items-center text-center">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110
                                            ${audioFile ? 'bg-[#D4AF37] text-black' : 'bg-white/5 text-zinc-500'}`}>
                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                            </svg>
                                        </div>
                                        <p className="text-sm font-bold text-zinc-300 mb-1">{audioFile ? audioFile.name : '点击上传音频文件'}</p>
                                        <p className="text-[10px] text-zinc-600 uppercase font-black tracking-widest">支持 WAV / MP3 / M4A (3-10s)</p>
                                    </div>
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept="audio/*"
                                    className="hidden"
                                    title="上传声纹样本"
                                />
                            </div>

                            <div className="space-y-4">
                                <label htmlFor="voice-clone-text" className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] serif">2. 转换文本 (Target Text)</label>
                                <textarea
                                    id="voice-clone-text"
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    placeholder="输入希望克隆声音朗读的内容..."
                                    className="w-full h-40 bg-[#121212] border border-white/10 rounded-3xl p-6 text-white text-sm font-medium focus:outline-none focus:border-[#D4AF37] transition-all resize-none shadow-inner"
                                    title="输入转换文本"
                                />
                            </div>

                            <div className="space-y-4">
                                <label className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] serif">3. 关联至分镜 (Link to Shot - 可选)</label>
                                <select
                                    value={selectedShotId}
                                    onChange={(e) => setSelectedShotId(e.target.value)}
                                    title="关联至分镜"
                                    className="w-full bg-[#121212] border border-white/10 rounded-2xl p-4 text-white font-bold focus:outline-none focus:border-[#D4AF37] transition-all cursor-pointer"
                                >
                                    <option value="">不关联 (仅预览/下载)</option>
                                    {storyboard.map(shot => (
                                        <option key={shot.id} value={shot.id}>
                                            镜头 {shot.shot_number}: {shot.visual_content || shot.action_description.substring(0, 20)}...
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || !audioBase64 || !text.trim()}
                                className={`w-full py-5 rounded-[2rem] text-sm font-black transition-all flex items-center justify-center gap-4 uppercase tracking-widest
                                    ${isGenerating || !audioBase64 || !text.trim()
                                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                        : 'bg-white text-black hover:bg-[#D4AF37] shadow-xl hover:shadow-[#D4AF37]/20'}`}
                            >
                                {isGenerating ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
                                        声纹重构中...
                                    </>
                                ) : '克隆并合成 (Clone & Synthesize)'}
                            </button>
                        </div>

                        {/* Right: Preview */}
                        <div className="flex flex-col">
                            <label className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] mb-4 serif">3. 生成结果 (Generated Audio)</label>
                            <div className="flex-grow rounded-[2.5rem] bg-[#121212] border border-white/5 flex flex-col items-center justify-center p-8 relative overflow-hidden shadow-inner">
                                {resultAudioUrl ? (
                                    <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                        <div className="flex items-center justify-center">
                                            <div className="w-24 h-24 rounded-full bg-[#D4AF37]/10 flex items-center justify-center relative">
                                                <div className="absolute inset-0 rounded-full border-4 border-[#D4AF37] border-t-transparent animate-spin-slow opacity-20" />
                                                <svg className="w-10 h-10 text-[#D4AF37]" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                                                </svg>
                                            </div>
                                        </div>
                                        <div className="px-4 py-6 bg-white/5 rounded-3xl border border-white/5">
                                            <audio src={resultAudioUrl} controls className="w-full h-12" />
                                        </div>
                                        <div className="flex justify-center">
                                            <a
                                                href={resultAudioUrl}
                                                download="cloned-voice.wav"
                                                className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-[#D4AF37] hover:border-[#D4AF37]/30 transition-all"
                                                title="下载音频"
                                            >
                                                下载音频文件 (Download)
                                            </a>
                                        </div>
                                    </div>
                                ) : isGenerating ? (
                                    <div className="text-center space-y-6">
                                        <div className="flex justify-center gap-1.5">
                                            {[1, 2, 3, 4, 5].map(i => (
                                                <div
                                                    key={i}
                                                    className="w-1.5 h-12 bg-[#D4AF37] rounded-full animate-wave"
                                                    style={{ animationDelay: `${i * 0.15}s` }}
                                                />
                                            ))}
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#D4AF37]/60">Neural reconstruction in progress</p>
                                    </div>
                                ) : (
                                    <div className="text-center space-y-4 opacity-30 group">
                                        <div className="w-20 h-20 rounded-full border border-white/10 flex items-center justify-center mx-auto transition-transform group-hover:scale-105">
                                            <svg className="w-8 h-8 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                            </svg>
                                        </div>
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">等待声纹合成 (Awaiting Synthesis)</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {error && <Toast message={error} type="error" onClose={() => setError(null)} />}
            {success && <Toast message={success} type="success" onClose={() => setSuccess(null)} />}

            <style>{`
                @keyframes wave {
                    0%, 100% { transform: scaleY(0.4); opacity: 0.3; }
                    50% { transform: scaleY(1); opacity: 1; }
                }
                .animate-wave {
                    animation: wave 1.2s ease-in-out infinite;
                }
                .animate-spin-slow {
                    animation: spin 3s linear infinite;
                }
            `}</style>
        </div>
    );
};

export default VoiceCloneModal;
