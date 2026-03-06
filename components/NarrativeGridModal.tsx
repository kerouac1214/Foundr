import React, { useState, useRef } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { getScriptProvider } from '../services/providers';
import Toast from './Toast';

interface NarrativeGridModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialScript?: string;
}

const NarrativeGridModal: React.FC<NarrativeGridModalProps> = ({ isOpen, onClose, initialScript = "" }) => {
    const { script: projectScript, globalContext } = useProjectStore();
    const [script, setScript] = useState(initialScript || projectScript || "");
    const [referenceImage, setReferenceImage] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'keyframes' | 'grid'>('overview');
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setReferenceImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = async () => {
        if (!script) {
            setError("请输入剧本内容");
            return;
        }
        if (!referenceImage) {
            setError("请上传一张参考图以保持视觉一致性");
            return;
        }

        setIsGenerating(true);
        setError(null);
        try {
            const engine = globalContext.script_engine || 'google';
            const provider = getScriptProvider(engine);
            const data = await provider.generateMovieNarrative(script, referenceImage);
            setResult(data);
            setActiveTab('overview');
        } catch (err: any) {
            console.error("Failed to generate movie narrative:", err);
            setError(err.message || "生成失败，请检查网络和配置");
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
                        <h2 className="text-2xl font-black mb-1 bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent">九宫格电影叙事</h2>
                        <p className="text-zinc-500 text-sm">将剧本与参考图转化为专业电影分镜序列</p>
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
                <div className="flex-grow overflow-hidden flex">
                    {!result ? (
                        <div className="flex-grow p-12 overflow-y-auto space-y-8">
                            <div className="space-y-4">
                                <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">上传视觉参考图 (Visual Reference)</label>
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`aspect-video rounded-3xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center overflow-hidden group
                                        ${referenceImage ? 'border-[#D4AF37]' : 'border-white/10 hover:border-white/20'}`}
                                >
                                    {referenceImage ? (
                                        <img src={referenceImage} alt="Reference" className="w-full h-full object-cover" />
                                    ) : (
                                        <>
                                            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                                <svg className="w-8 h-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                </svg>
                                            </div>
                                            <p className="text-zinc-400 font-bold">点击上传参考图</p>
                                            <p className="text-zinc-600 text-xs mt-2">用于锁定角色外貌、环境风格与光影基调</p>
                                        </>
                                    )}
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImageUpload}
                                    accept="image/*"
                                    className="hidden"
                                    title="上传图片"
                                />
                            </div>

                            <div className="space-y-4">
                                <label htmlFor="script-input" className="text-sm font-bold text-zinc-400 uppercase tracking-wider">请输入剧本内容 (Script)</label>
                                <textarea
                                    id="script-input"
                                    value={script}
                                    onChange={(e) => setScript(e.target.value)}
                                    placeholder="输入剧本片段或对情节进行描述..."
                                    title="剧本内容"
                                    className="w-full h-64 bg-white/5 border border-white/10 rounded-3xl p-6 text-white placeholder-zinc-700 focus:outline-none focus:border-[#D4AF37] transition-all resize-none font-mono text-sm leading-relaxed"
                                />
                            </div>

                            <div className="flex justify-end pt-4">
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating}
                                    className={`px-12 py-4 rounded-2xl text-lg font-black transition-all flex items-center gap-3
                                        ${isGenerating
                                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                                            : 'bg-white text-black hover:bg-[#D4AF37] hover:text-black shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[#D4AF37]/20'}`}
                                >
                                    {isGenerating ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
                                            大师创构中...
                                        </>
                                    ) : '开始电影级叙事生成'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-grow flex flex-col h-full">
                            {/* Tabs */}
                            <div className="flex px-12 gap-8 border-b border-white/5 bg-white/[0.02]">
                                {(['overview', 'keyframes', 'grid'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab)}
                                        className={`py-4 text-sm font-bold uppercase tracking-widest transition-all relative
                                            ${activeTab === tab ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    >
                                        {tab === 'overview' && '场景解构'}
                                        {tab === 'keyframes' && '分镜清单'}
                                        {tab === 'grid' && '九宫格预览'}
                                        {activeTab === tab && (
                                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D4AF37] shadow-[0_0_10px_#D4AF37]" />
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Tab Panels */}
                            <div className="flex-grow overflow-y-auto p-12 bg-black">
                                {activeTab === 'overview' && (
                                    <div className="space-y-12 max-w-4xl mx-auto">
                                        <section className="space-y-4">
                                            <h3 className="text-[#D4AF37] font-black text-xs uppercase tracking-[0.2em]">Step 1: Scene & Script Breakdown</h3>
                                            <div className="prose prose-invert prose-zinc max-w-none prose-p:text-zinc-400 prose-headings:text-white whitespace-pre-wrap">
                                                {result.breakdown}
                                            </div>
                                        </section>
                                        <section className="space-y-4">
                                            <h3 className="text-[#D4AF37] font-black text-xs uppercase tracking-[0.2em]">Step 2: Story & Tone</h3>
                                            <div className="prose prose-invert prose-zinc max-w-none prose-p:text-zinc-400 prose-headings:text-white whitespace-pre-wrap">
                                                {result.story_tone}
                                            </div>
                                        </section>
                                        <section className="space-y-4">
                                            <h3 className="text-[#D4AF37] font-black text-xs uppercase tracking-[0.2em]">Step 3: Visual Storytelling Approach</h3>
                                            <div className="prose prose-invert prose-zinc max-w-none prose-p:text-zinc-400 prose-headings:text-white whitespace-pre-wrap">
                                                {result.approach}
                                            </div>
                                        </section>
                                    </div>
                                )}

                                {activeTab === 'keyframes' && (
                                    <div className="space-y-12 max-w-4xl mx-auto font-mono text-sm leading-relaxed">
                                        <section className="space-y-4">
                                            <h3 className="text-[#D4AF37] font-black text-xs uppercase tracking-[0.2em]">Step 4: Storyboard Keyframes</h3>
                                            <div className="text-zinc-400 whitespace-pre-wrap">
                                                {result.keyframes}
                                            </div>
                                        </section>
                                        <section className="space-y-4 pt-8 border-t border-white/5">
                                            <h3 className="text-[#D4AF37] font-black text-xs uppercase tracking-[0.2em]">Prompt Breakdown</h3>
                                            <div className="text-zinc-500 whitespace-pre-wrap">
                                                {result.prompt_breakdown}
                                            </div>
                                        </section>
                                    </div>
                                )}

                                {activeTab === 'grid' && (
                                    <div className="h-full flex flex-col items-center justify-center space-y-8">
                                        {result.grid_image_url ? (
                                            <div className="relative group w-full max-w-5xl shadow-2xl rounded-3xl overflow-hidden border border-white/10">
                                                <img
                                                    src={result.grid_image_url}
                                                    alt="Storyboard Grid"
                                                    className="w-full object-contain"
                                                />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                                    <a
                                                        href={result.grid_image_url}
                                                        download="storyboard-grid.png"
                                                        className="px-6 py-3 bg-white text-black rounded-xl font-bold hover:bg-[#D4AF37] transition-all"
                                                    >
                                                        下载网格图
                                                    </a>
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(result.prompt_breakdown);
                                                            // Could add a toast here
                                                        }}
                                                        className="px-6 py-3 bg-black/60 backdrop-blur-md text-white rounded-xl font-bold hover:bg-white/20 transition-all"
                                                    >
                                                        复制 Prompt 清单
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-12 text-center space-y-4 bg-white/5 rounded-3xl border border-dashed border-white/10">
                                                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                                                    <svg className="w-8 h-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                </div>
                                                <p className="text-zinc-400 font-bold text-xl">预览图生成中或已跳过</p>
                                                <p className="text-zinc-600 text-sm">由于网络或模型限制，当前无法直接渲染统一网格图。<br />您可以根据关键帧列表手动出图。</p>
                                                <button
                                                    onClick={handleGenerate}
                                                    className="mt-8 px-8 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all font-bold"
                                                >
                                                    尝试重新生成
                                                </button>
                                            </div>
                                        )}

                                        <div className="flex gap-4">
                                            <button
                                                onClick={() => setResult(null)}
                                                className="px-8 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-zinc-400 font-bold transition-all"
                                            >
                                                重新调整剧本/参考图
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {error && <Toast message={error} type="error" onClose={() => setError(null)} />}
        </div>
    );
};

export default NarrativeGridModal;
