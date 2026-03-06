import React, { useState, useRef } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { getImageProvider } from '../services/providers';
import Toast from './Toast';

interface ShotAdjustmentModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PRESETS = [
    { label: '将镜头转为俯视 (Top-down View)', value: 'High angle, cinematic bird eye view, top-down perspective, exceptional detail, 8k, movie still' },
    { label: '将镜头转为仰视 (Low-angle View)', value: 'Extreme low angle cinematic shot, heroic perspective, dramatic looking up, masterpieces, high resolution' },
    { label: '将镜头转为广角镜头 (Wide-angle Lens)', value: 'Cinematic wide angle shot, expansive scenery, deep depth of field, 24mm lens style, breathtaking composition' },
    { label: '将镜头转为特写镜头 (Close-up Shot)', value: 'Cinematic close-up, shallow depth of field, focus on subject expression, 85mm lens, intense emotion, detailed textures' },
    { label: '将镜头转为仰视特写镜头 (Low-angle Close-up)', value: 'Low angle close-up cinematic shot, dramatic framing, detailed facial expression, heroic focus' },
    { label: '将镜头转为左侧俯视镜头 (Left Top-down)', value: 'Left side high angle top-down view, dynamic bird eye perspective, cinematic framing' },
    { label: '将镜头转为身后方仰视镜头 (Rear Low-angle)', value: 'Cinematic low angle shot from behind, over the shoulder perspective, mysterious atmosphere, movie still' },
    { label: '将镜头向下移动 (Camera Tracking Down)', value: 'Cinematic camera tracking down, ground level perspective, intense focus, dramatic low movement' },
    { label: '将镜头转为人物手部特写 (Hand Close-up)', value: 'Extreme close-up on hands, detailed skin texture, emotional gesture, macro cinematic shot, shallow depth of field' },
    { label: '将镜头转为面部特写镜头 (Face Portrait Shot)', value: 'Emotional face close-up, detailed eyes and skin, cinematic portrait lighting, soft bokeh, 8k resolution' },
    { label: '将镜头转为广角全景镜头 (Wide Panoramic Lens)', value: 'Breathtaking cinematic panoramic wide shot, 12mm ultra-wide lens style, immense scale, masterpieces' },
    { label: '将镜头转为广角仰视镜头 (Wide Low-angle Lens)', value: 'Cinematic ultra-wide low angle shot, scale and power, looking up at vast subject, dramatic perspective' },
];

const ShotAdjustmentModal: React.FC<ShotAdjustmentModalProps> = ({ isOpen, onClose }) => {
    const { storyboard, globalContext } = useProjectStore();
    const [sourceImage, setSourceImage] = useState<string | null>(null);
    const [selectedPreset, setSelectedPreset] = useState(PRESETS[0].value);
    const [isGenerating, setIsGenerating] = useState(false);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showGallery, setShowGallery] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSourceImage(reader.result as string);
                setResultImage(null);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = async () => {
        if (!sourceImage) {
            setError("请先上传或选择一张照片");
            return;
        }

        setIsGenerating(true);
        setError(null);
        try {
            // Using NB2 engine for Im2Im as requested
            const provider = getImageProvider('nb2');
            if (!provider || !provider.generateImage) {
                throw new Error("NB2 引擎暂不支持或未找到");
            }

            // In our system, Im2Im usually involves passing the source image and a prompt
            // We'll use the selected preset as the prompt
            const result = await provider.generateImage(selectedPreset, {
                aspect_ratio: globalContext.aspect_ratio || '16:9',
                image_engine: 'nb2',
                reference_image_url: sourceImage // Passing reference image
            });

            if (result && result.preview_url) {
                setResultImage(result.preview_url);
            } else {
                throw new Error("生成结果无效");
            }
        } catch (err: any) {
            console.error("Failed to adjust shot:", err);
            setError(err.message || "生成失败，请检查网络和配置");
        } finally {
            setIsGenerating(false);
        }
    };

    const storyboardImages = storyboard
        .filter(item => item.preview_url)
        .map(item => item.preview_url as string) || [];

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-in fade-in">
            <div className="w-full max-w-5xl h-[85vh] mx-4 bg-[#0a0a0a] rounded-[3rem] border border-white/10 overflow-hidden shadow-2xl flex flex-col">
                {/* Header */}
                <div className="px-12 py-8 border-b border-white/10 flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-2xl font-black mb-1 bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-transparent italic uppercase serif">景别调整 (Shot Adjustment)</h2>
                        <p className="text-zinc-500 text-sm">通过 AI 算法精准变换现有画面的视觉角度与焦距</p>
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
                <div className="flex-grow overflow-y-auto p-12 space-y-12">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        {/* Input Side */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-bold text-zinc-400 uppercase tracking-widest serif">输入图 (Source Image)</label>
                                <button
                                    onClick={() => setShowGallery(!showGallery)}
                                    className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37] hover:text-white transition-colors"
                                    title={showGallery ? '隐藏库' : '从项目库选择'}
                                >
                                    {showGallery ? '隐藏库' : '从项目库选择'}
                                </button>
                            </div>

                            {showGallery && (
                                <div className="grid grid-cols-4 gap-2 p-4 bg-white/5 rounded-2xl border border-white/5 max-h-40 overflow-y-auto animate-in slide-in-from-top-4 duration-300">
                                    {storyboardImages.map((img, idx) => (
                                        <div
                                            key={idx}
                                            onClick={() => {
                                                setSourceImage(img);
                                                setResultImage(null);
                                                setShowGallery(false);
                                            }}
                                            className="aspect-square rounded-xl overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#D4AF37] transition-all"
                                        >
                                            <img src={img} alt={`Storyboard ${idx}`} className="w-full h-full object-cover" />
                                        </div>
                                    ))}
                                    {storyboardImages.length === 0 && (
                                        <div className="col-span-4 py-8 text-center text-zinc-600 text-[10px] uppercase font-bold tracking-widest">项目库中暂无图片</div>
                                    )}
                                </div>
                            )}

                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className={`aspect-video rounded-[2.5rem] border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center overflow-hidden group
                                    ${sourceImage ? 'border-[#D4AF37]' : 'border-white/10 hover:border-white/20 bg-white/2'}`}
                            >
                                {sourceImage ? (
                                    <img src={sourceImage} alt="Source" className="w-full h-full object-cover" />
                                ) : (
                                    <>
                                        <div className="w-16 h-16 rounded-2xl bg-[#D4AF37]/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                            <svg className="w-8 h-8 text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                        </div>
                                        <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">点击上传或选择图片</p>
                                    </>
                                )}
                            </div>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleImageUpload}
                                accept="image/*"
                                className="hidden"
                                title="上传源图片"
                            />

                            <div className="space-y-4">
                                <label htmlFor="shot-preset-select" className="text-sm font-bold text-zinc-400 uppercase tracking-widest serif">选择景别变换指令 (Cinematic Preset)</label>
                                <select
                                    id="shot-preset-select"
                                    value={selectedPreset}
                                    onChange={(e) => setSelectedPreset(e.target.value)}
                                    title="选择景别预设"
                                    className="w-full bg-[#121212] border border-white/10 rounded-2xl p-4 text-white font-bold focus:outline-none focus:border-[#D4AF37] transition-all cursor-pointer"
                                >
                                    {PRESETS.map((p, idx) => (
                                        <option key={idx} value={p.value}>{p.label}</option>
                                    ))}
                                </select>
                            </div>

                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || !sourceImage}
                                className={`w-full py-5 rounded-2xl text-lg font-black transition-all flex items-center justify-center gap-4
                                    ${isGenerating || !sourceImage
                                        ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50'
                                        : 'bg-white text-black hover:bg-[#D4AF37] hover:shadow-[0_0_30px_rgba(212,175,55,0.3)]'}`}
                            >
                                {isGenerating ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
                                        镜头推敲中 (Calculating...)
                                    </>
                                ) : '重构影视空间 (Adjust Shot)'}
                            </button>
                        </div>

                        {/* Result Side */}
                        <div className="space-y-6">
                            <label className="text-sm font-bold text-zinc-400 uppercase tracking-widest serif">生成效果 (Result Preview)</label>
                            <div className="aspect-video rounded-[2.5rem] bg-[#121212] border border-white/5 overflow-hidden relative flex flex-col items-center justify-center shadow-inner">
                                {resultImage ? (
                                    <>
                                        <img src={resultImage} alt="Result" className="w-full h-full object-cover animate-in fade-in zoom-in-95 duration-500" />
                                        <div className="absolute bottom-6 right-6 flex gap-3">
                                            <a
                                                href={resultImage}
                                                download="adjusted-shot.png"
                                                className="p-4 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl text-white hover:bg-[#D4AF37] hover:text-black transition-all"
                                                title="下载图片"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                </svg>
                                            </a>
                                            <button
                                                onClick={() => setSourceImage(resultImage)}
                                                className="px-6 py-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-[#D4AF37] hover:bg-white hover:text-black transition-all"
                                            >
                                                以此图继续
                                            </button>
                                        </div>
                                    </>
                                ) : isGenerating ? (
                                    <div className="flex flex-col items-center gap-6">
                                        <div className="w-24 h-1 bg-white/5 rounded-full overflow-hidden relative">
                                            <div className="h-full bg-[#D4AF37] absolute top-0 left-0 animate-[shimmer_2s_infinite] w-1/3 shadow-[0_0_20px_#D4AF37]" />
                                        </div>
                                        <p className="text-zinc-600 font-bold uppercase tracking-[0.3em] text-[10px] animate-pulse">Processing cinematic depth</p>
                                    </div>
                                ) : (
                                    <div className="text-center px-12 space-y-4">
                                        <div className="w-20 h-20 rounded-[2rem] bg-white/[0.02] flex items-center justify-center mx-auto mb-4 border border-white/5">
                                            <svg className="w-10 h-10 text-zinc-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <p className="text-zinc-600 font-bold uppercase tracking-widest text-[10px]">等待操作 (Awaiting adjustment)</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-6 bg-[#D4AF37]/5 rounded-3xl border border-[#D4AF37]/10">
                                <p className="text-[#D4AF37] text-[11px] font-bold leading-relaxed serif italic">
                                    "景别不仅仅是物理距离的变化，更是叙事权重的转移。NB2 引擎将通过特征保留算法，在改变视角的同时最大程度维持主体一致性。"
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {error && <Toast message={error} type="error" onClose={() => setError(null)} />}

            <style>{`
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(300%); }
                }
            `}</style>
        </div>
    );
};

export default ShotAdjustmentModal;
