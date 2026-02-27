import React from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { STYLE_CATEGORIES, ASPECT_RATIOS } from '../constants';

interface ContextSettingsProps {
    className?: string;
}

const ContextSettings: React.FC<ContextSettingsProps> = ({ className }) => {
    const globalContext = useProjectStore((state) => state.globalContext);
    const updateGlobalContext = useProjectStore((state) => state.updateGlobalContext);

    const updateEngineConfig = (engine: string, field: string, value: string) => {
        const currentConfigs = globalContext.engine_configs || {};
        const engineConfig = currentConfigs[engine] || {};
        updateGlobalContext({
            engine_configs: {
                ...currentConfigs,
                [engine]: { ...engineConfig, [field]: value }
            }
        });
    };

    return (
        <div className={`bg-[#050505] p-6 rounded-3xl border border-white/10 space-y-6 ${className}`}>
            <div className="space-y-4">
                <h2 className="text-xs font-black uppercase tracking-[0.5em] text-zinc-300">画幅比例</h2>
                <div className="grid grid-cols-2 gap-3">
                    {ASPECT_RATIOS.map(ar => (
                        <button
                            key={ar.value}
                            onClick={() => updateGlobalContext({ aspect_ratio: ar.value })}
                            className={`py-3 px-4 rounded-xl border transition-all flex items-center justify-center gap-3 ${globalContext.aspect_ratio === ar.value ? 'bg-[#D4AF37] border-[#D4AF37] text-black shadow-lg' : 'bg-black/40 border-white/5 text-zinc-400 hover:text-zinc-200 hover:border-white/10'}`}
                        >
                            {ar.value === '16:9' ? <div className="w-6 h-3.5 border-2 border-current rounded-[2px]" /> : <div className="w-3.5 h-6 border-2 border-current rounded-[2px]" />}
                            <span className="text-[11px] font-black">{ar.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* AI Engines */}
            <div className="space-y-4">
                <h2 className="text-xs font-black uppercase tracking-[0.5em] text-zinc-300">AI 引擎配置</h2>
                <div className="grid grid-cols-1 gap-6">
                    {/* Script Engine */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">剧本分析与 DNA 提取</label>
                        <div className="grid grid-cols-2 gap-1 p-1 bg-black/40 rounded-xl border border-white/5">
                            {[
                                { label: 'Gemini', value: 'google' as const },
                                { label: 'Kimi (Moonshot)', value: 'kimi' as const }
                            ].map(engine => (
                                <button
                                    key={engine.value}
                                    onClick={() => updateGlobalContext({ script_engine: engine.value })}
                                    className={`px-3 py-2 rounded-lg transition-all text-[10px] font-bold uppercase ${globalContext.script_engine === engine.value ? 'bg-[#D4AF37] text-black shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                                >
                                    {engine.label}
                                </button>
                            ))}
                        </div>
                        <div className="mt-2 pl-1 group">
                            <details className="cursor-pointer">
                                <summary className="text-[9px] text-zinc-600 hover:text-zinc-400 font-bold uppercase tracking-wider outline-none">
                                    高级配置 ({globalContext.script_engine === 'kimi' ? 'Kimi' : 'Gemini'})
                                </summary>
                                <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <input
                                        type="text"
                                        placeholder={globalContext.script_engine === 'kimi' ? "API Key" : "API Base URL (e.g. 代理地址)"}
                                        value={
                                            globalContext.script_engine === 'kimi'
                                                ? globalContext.engine_configs?.['kimi']?.api_key_override || ''
                                                : globalContext.engine_configs?.['google']?.api_base || ''
                                        }
                                        onChange={(e) => {
                                            if (globalContext.script_engine === 'kimi') {
                                                updateEngineConfig('kimi', 'api_key_override', e.target.value);
                                            } else {
                                                updateEngineConfig('google', 'api_base', e.target.value);
                                            }
                                        }}
                                        className="w-full bg-black border border-white/5 rounded-lg px-3 py-2 text-[10px] text-zinc-400 outline-none focus:border-[#D4AF37]/30"
                                    />
                                    <input
                                        type="text"
                                        placeholder="自定义模型名称 (可选)"
                                        value={globalContext.engine_configs?.[globalContext.script_engine]?.model_name || ''}
                                        onChange={(e) => updateEngineConfig(globalContext.script_engine, 'model_name', e.target.value)}
                                        className="w-full bg-black border border-white/5 rounded-lg px-3 py-2 text-[10px] text-zinc-400 outline-none focus:border-[#D4AF37]/30"
                                    />
                                </div>
                            </details>
                        </div>
                    </div>

                    {/* Image Engine */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">渲染引擎 (出图)</label>
                        <div className="grid grid-cols-4 gap-1 p-1 bg-black/40 rounded-xl border border-white/5">
                            {[
                                { label: 'Gemini', value: 'google' as const },
                                { label: 'NB pro', value: 'nb_pro' as const },
                                { label: 'Z-image', value: 'z_image' as const },
                                { label: 'qwen2512', value: 'qwen2512' as const }
                            ].map(engine => (
                                <button
                                    key={engine.value}
                                    onClick={() => updateGlobalContext({ image_engine: engine.value })}
                                    className={`px-2 py-2 rounded-lg transition-all text-[9.5px] font-bold uppercase ${globalContext.image_engine === engine.value ? 'bg-[#D4AF37] text-black shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                                >
                                    {engine.label}
                                </button>
                            ))}
                        </div>
                        {(globalContext.image_engine === 'runninghub' || globalContext.image_engine === 'nb_pro' || globalContext.image_engine === 'qwen2512') && (
                            <div className="mt-2 pl-1">
                                <details className="cursor-pointer">
                                    <summary className="text-[9px] text-zinc-600 hover:text-zinc-400 font-bold uppercase tracking-wider outline-none">高级配置 (RunningHub)</summary>
                                    <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <input
                                            type="text"
                                            placeholder="自定义 API Base"
                                            value={globalContext.engine_configs?.['runninghub']?.api_base || ''}
                                            onChange={(e) => updateEngineConfig('runninghub', 'api_base', e.target.value)}
                                            className="w-full bg-black border border-white/5 rounded-lg px-3 py-2 text-[10px] text-zinc-400 outline-none focus:border-[#D4AF37]/30"
                                        />
                                    </div>
                                </details>
                            </div>
                        )}
                    </div>

                    {/* Video Engine */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">视频生成引擎</label>
                        <div className="grid grid-cols-1 gap-1 p-1 bg-black/40 rounded-xl border border-white/5 max-w-[50%]">
                            {[{ label: 'Gemini', value: 'google' as const }].map(engine => (
                                <button
                                    key={engine.value}
                                    onClick={() => updateGlobalContext({ video_engine: engine.value })}
                                    className={`px-3 py-2 rounded-lg transition-all text-[10px] font-bold uppercase ${globalContext.video_engine === engine.value ? 'bg-[#D4AF37] text-black shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                                >
                                    {engine.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Style Preset */}
            <div className="space-y-8">
                <h2 className="text-xs font-black uppercase tracking-[0.5em] text-zinc-300">导演风格预设</h2>
                <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-3">
                    {STYLE_CATEGORIES.flatMap(c => c.subStyles).map((sub: any) => {
                        const isCustom = sub.isCustom;
                        const isSelected = globalContext.visual_style_subcategory_name === sub.name;

                        if (isCustom) {
                            return (
                                <div key={sub.name} className={`p-4 rounded-xl border transition-all ${isSelected ? 'bg-[#D4AF37]/10 border-[#D4AF37]' : 'bg-white/5 border-white/5'}`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-[12px] font-bold uppercase text-[#D4AF37]">✨ {sub.name}</span>
                                        <button
                                            onClick={() => updateGlobalContext({ visual_style_subcategory_name: sub.name })}
                                            className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${isSelected ? 'bg-[#D4AF37] text-black' : 'bg-white/10 text-zinc-400 hover:bg-white/20'}`}
                                        >
                                            {isSelected ? '已选择' : '选择'}
                                        </button>
                                    </div>
                                    <textarea
                                        value={globalContext.visual_style_preset}
                                        onChange={e => updateGlobalContext({
                                            visual_style_preset: e.target.value,
                                            visual_style_subcategory_name: '自定义'
                                        })}
                                        placeholder="输入您的自定义风格描述..."
                                        className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-zinc-300 text-[11px] leading-relaxed h-24 outline-none focus:border-[#D4AF37]/50 resize-none placeholder:text-zinc-600"
                                    />
                                    <p className="text-[9px] text-zinc-500 mt-2">💡 提示：使用英文描述效果更佳</p>
                                </div>
                            );
                        }

                        return (
                            <button
                                key={sub.name}
                                onClick={() => updateGlobalContext({ visual_style_subcategory_name: sub.name, visual_style_preset: sub.value })}
                                className={`p-4 rounded-xl border text-center transition-all ${isSelected ? 'bg-[#D4AF37]/10 border-[#D4AF37] text-[#D4AF37]' : 'bg-white/5 border-white/5 text-zinc-300'}`}
                            >
                                <span className="text-[12px] font-bold block uppercase">{sub.name}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ContextSettings;
