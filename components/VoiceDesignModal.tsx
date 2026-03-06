import React, { useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { designVoice } from '../services/runningHubService';
import Toast from './Toast';

interface VoiceDesignModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const VoiceDesignModal: React.FC<VoiceDesignModalProps> = ({ isOpen, onClose }) => {
    const { storyboard, updateShot } = useProjectStore();
    const [dialogue, setDialogue] = useState('');
    const [style, setStyle] = useState('');
    const [selectedShotId, setSelectedShotId] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [resultAudioUrl, setResultAudioUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const PRESETS = [
        { label: "妩媚诱惑", value: "30左右女性，妩媚诱惑。情绪为挑逗，语速较慢。" },
        { label: "阳光少年", value: "20岁左右男性，阳光开朗。情绪高昂，语速中等。" },
        { label: "严肃老者", value: "60岁左右男性，声音低沉有力。情绪庄重，语速缓慢。" },
        { label: "活泼萝莉", value: "10岁左右女性，清脆甜美。情绪轻快，语速较快。" },
        { label: "深沉御姐", value: "28岁左右女性，成熟稳重。声音带有磁性，语速从容。" }
    ];

    if (!isOpen) return null;

    const handleGenerate = async () => {
        if (!dialogue.trim()) {
            setError("请输入对话文本");
            return;
        }
        if (!style.trim()) {
            setError("请输入声音设计描述");
            return;
        }

        setIsGenerating(true);
        setError(null);
        try {
            console.log("[VoiceDesign] Starting design process...");
            const audioUrl = await designVoice(dialogue, style);
            if (audioUrl) {
                setResultAudioUrl(audioUrl);

                // Link to shot if selected
                if (selectedShotId) {
                    updateShot(selectedShotId, {
                        audio_url: audioUrl,
                        sound_design: `${style} | ${dialogue}`
                    });
                    setSuccess(`已成功关联至 镜头 ${storyboard.find(s => s.id === selectedShotId)?.shot_number}`);
                }
            } else {
                throw new Error("生成音频失败，未返回有效地址");
            }
        } catch (err: any) {
            console.error("Failed to design voice:", err);
            setError(err.message || "设计失败，请检查网络和 API 配置");
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
                        <h2 className="text-2xl font-black mb-1 bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent italic uppercase serif">声音设计 (Voice Design)</h2>
                        <p className="text-zinc-500 text-sm font-medium tracking-wide">定义性格、情绪与音色，从虚无中创造独一无二的生命律动</p>
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
                        {/* Left: Configuration */}
                        <div className="space-y-8">
                            {/* Style Input */}
                            <div className="space-y-4">
                                <label className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] serif">1. 声音特征设计 (Voice Attributes)</label>
                                <textarea
                                    value={style}
                                    onChange={(e) => setStyle(e.target.value)}
                                    placeholder="描述音色特征、性别、年龄、性格、情绪、语速等... (例如: 30左右女性，妩媚诱惑)"
                                    className="w-full h-32 bg-[#121212] border border-white/10 rounded-3xl p-6 text-white text-sm font-medium focus:outline-none focus:border-[#D4AF37] transition-all resize-none shadow-inner"
                                    title="输入声音特征"
                                />
                                <div className="flex flex-wrap gap-2">
                                    {PRESETS.map((p, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setStyle(p.value)}
                                            className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold text-zinc-400 hover:text-[#D4AF37] hover:border-[#D4AF37]/30 transition-all uppercase tracking-widest"
                                            title={p.label}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Dialogue Input */}
                            <div className="space-y-4">
                                <label className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] serif">2. 对话文本 (Target Dialogue)</label>
                                <textarea
                                    value={dialogue}
                                    onChange={(e) => setDialogue(e.target.value)}
                                    placeholder="输入希望合成的台词文本..."
                                    className="w-full h-40 bg-[#121212] border border-white/10 rounded-3xl p-6 text-white text-sm font-medium focus:outline-none focus:border-[#D4AF37] transition-all resize-none shadow-inner"
                                    title="输入对话文本"
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
                                disabled={isGenerating || !dialogue.trim() || !style.trim()}
                                className={`w-full py-5 rounded-[2rem] text-sm font-black transition-all flex items-center justify-center gap-4 uppercase tracking-widest
                                    ${isGenerating || !dialogue.trim() || !style.trim()
                                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                        : 'bg-white text-black hover:bg-[#D4AF37] shadow-xl hover:shadow-[#D4AF37]/20'}`}
                            >
                                {isGenerating ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
                                        声纹建模中...
                                    </>
                                ) : '生成音效与对白 (Design & Synthesize)'}
                            </button>
                        </div>

                        {/* Right: Results Dashboard */}
                        <div className="flex flex-col">
                            <label className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em] mb-4 serif">3. 音核预览 (Sonic Core Preview)</label>
                            <div className="flex-grow rounded-[2.5rem] bg-[#121212] border border-white/5 flex flex-col items-center justify-center p-8 relative overflow-hidden shadow-inner group">
                                {resultAudioUrl ? (
                                    <div className="w-full space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                                        <div className="flex items-center justify-center">
                                            <div className="w-32 h-32 rounded-full border border-[#D4AF37]/30 flex items-center justify-center relative">
                                                <div className="absolute inset-0 rounded-full border-2 border-[#D4AF37] border-t-transparent animate-spin-slow opacity-40 shadow-[0_0_30px_rgba(212,175,55,0.2)]" />
                                                <div className="flex gap-1 items-end h-8">
                                                    {[1, 2, 3, 2, 1].map((h, i) => (
                                                        <div
                                                            key={i}
                                                            className="w-1 bg-[#D4AF37] rounded-full animate-wave"
                                                            style={{ height: `${h * 20}%`, animationDelay: `${i * 0.1}s` }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="px-6 py-8 bg-white/2 rounded-3xl border border-white/5 backdrop-blur-sm">
                                                <audio src={resultAudioUrl} controls className="w-full h-12" />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <a
                                                    href={resultAudioUrl}
                                                    download="designed-voice.wav"
                                                    className="flex items-center justify-center px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-[#D4AF37] hover:border-[#D4AF37]/30 transition-all"
                                                    title="下载音频"
                                                >
                                                    下载 (Download)
                                                </a>
                                                <button
                                                    onClick={() => setResultAudioUrl(null)}
                                                    className="px-6 py-4 bg-white/2 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-white transition-all"
                                                    title="重置"
                                                >
                                                    清除 (Clear)
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ) : isGenerating ? (
                                    <div className="text-center space-y-8">
                                        <div className="relative w-24 h-24 mx-auto">
                                            <div className="absolute inset-0 border-4 border-[#D4AF37]/10 rounded-full" />
                                            <div className="absolute inset-0 border-4 border-t-[#D4AF37] rounded-full animate-spin shadow-[0_0_20px_rgba(212,175,55,0.3)]" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#D4AF37] mb-2">Modeling Sonic Structure</p>
                                            <p className="text-[8px] text-zinc-600 uppercase font-medium tracking-widest">Applying spectral parameters...</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center space-y-6 opacity-40 hover:opacity-100 transition-opacity transform hover:scale-105 duration-500">
                                        <div className="w-24 h-24 rounded-3xl border border-zinc-800 flex items-center justify-center mx-auto bg-gradient-to-br from-white/5 to-transparent">
                                            <svg className="w-10 h-10 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                                            </svg>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 italic">Ready for Synthesis</p>
                                            <p className="text-[8px] text-zinc-700 uppercase font-medium tracking-widest">Configure attributes and dialog to proceed</p>
                                        </div>
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
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes wave {
                    0%, 100% { transform: scaleY(0.5); opacity: 0.5; }
                    50% { transform: scaleY(1.5); opacity: 1; }
                }
                .animate-spin-slow { animation: spin 4s linear infinite; }
                .animate-wave { animation: wave 1s ease-in-out infinite; }
            `}</style>
        </div>
    );
};

export default VoiceDesignModal;
