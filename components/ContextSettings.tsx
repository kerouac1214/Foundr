import React from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { STYLE_CATEGORIES, ASPECT_RATIOS, IMAGE_ENGINES, VIDEO_ENGINES } from '../constants';

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
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">剧本分析与 DNA 提取 (Step 1-2)</label>
                        <div className="grid grid-cols-2 gap-1 p-1 bg-black/40 rounded-xl border border-white/5">
                            {[
                                { label: 'Gemini', value: 'google' as const },
                                { label: 'GLM-5', value: 'glm5' as const }
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
                        <div className="mt-4 p-4 bg-[#D4AF37]/5 rounded-2xl border border-[#D4AF37]/10 animate-in fade-in slide-in-from-top-2">
                            <h3 className="text-[10px] font-black text-[#D4AF37] uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4H4m6 0h10m-6-4V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4H4m6 0h10" /></svg>
                                剧本分析引擎配置 ({globalContext.script_engine === 'google' ? 'Gemini' : 'GLM-5'})
                            </h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider pl-1">
                                        {globalContext.script_engine === 'google' ? "API 代理地址 (API Base)" : "API 密钥 (API Key)"}
                                    </label>
                                    <input
                                        type="password"
                                        placeholder={globalContext.script_engine === 'google' ? "例如: https://your-proxy.com/v1" : "输入 API Key"}
                                        value={
                                            globalContext.script_engine === 'glm5'
                                                ? globalContext.engine_configs?.['glm5']?.api_key || ''
                                                : globalContext.engine_configs?.['google']?.api_base || ''
                                        }
                                        onChange={(e) => {
                                            if (globalContext.script_engine === 'glm5') {
                                                updateEngineConfig('glm5', 'api_key', e.target.value);
                                            } else {
                                                updateEngineConfig('google', 'api_base', e.target.value);
                                            }
                                        }}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-[11px] text-zinc-300 outline-none focus:border-[#D4AF37]/40 transition-all font-mono"
                                    />
                                </div>
                                {globalContext.script_engine === 'glm5' && (
                                    <div className="flex items-center justify-between px-3 py-2.5 bg-black/40 border border-white/10 rounded-xl">
                                        <span className="text-[10px] text-zinc-400 font-bold">开启思维链 (CoT)</span>
                                        <button
                                            onClick={() => updateEngineConfig('glm5', 'enable_thinking', globalContext.engine_configs?.['glm5']?.enable_thinking === false ? true : false as any)}
                                            className={`w-8 h-4 rounded-full transition-all relative ${globalContext.engine_configs?.['glm5']?.enable_thinking !== false ? 'bg-[#D4AF37]' : 'bg-zinc-700'}`}
                                        >
                                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${globalContext.engine_configs?.['glm5']?.enable_thinking !== false ? 'left-4.5' : 'left-0.5'}`} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* AI Assistant (Kimi) Dedicated Config */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">Foundr AI 助手 (Kimi)</label>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider pl-1">Kimi API 密钥 (必填)</label>
                                    <input
                                        type="password"
                                        placeholder="输入 Kimi API Key"
                                        value={globalContext.engine_configs?.['kimi']?.api_key || ''}
                                        onChange={(e) => updateEngineConfig('kimi', 'api_key', e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-[11px] text-zinc-300 outline-none focus:border-[#D4AF37]/40 transition-all font-mono"
                                    />
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-zinc-500 italic">
                                    <svg className="w-3 h-3 text-[#D4AF37]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    AI 助手独立使用 Kimi 引擎，不影响剧本分析。
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Image Engine */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">渲染引擎 (出图)</label>
                        <div className="grid grid-cols-4 gap-1 p-1 bg-black/40 rounded-xl border border-white/5">
                            {IMAGE_ENGINES.map(engine => (
                                <button
                                    key={engine.value}
                                    onClick={() => updateGlobalContext({ image_engine: engine.value as any })}
                                    className={`px-2 py-2 rounded-lg transition-all text-[9.5px] font-bold uppercase ${globalContext.image_engine === engine.value ? 'bg-[#D4AF37] text-black shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                                    title={engine.desc}
                                >
                                    {engine.label}
                                </button>
                            ))}
                        </div>
                        {(globalContext.image_engine === 'runninghub' || globalContext.image_engine === 'nb2' || globalContext.image_engine === 'qwen2512') && (
                            <div className="mt-2 pl-1">
                                <details className="cursor-pointer">
                                    <summary className="text-[11px] text-zinc-600 hover:text-zinc-400 font-bold uppercase tracking-wider outline-none">
                                        ▼ 高级配置 (RunningHub / API Key)
                                    </summary>
                                    <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <input
                                            type="password"
                                            placeholder="RunningHub API Key"
                                            value={globalContext.engine_configs?.['runninghub']?.api_key || ''}
                                            onChange={(e) => updateEngineConfig('runninghub', 'api_key', e.target.value)}
                                            className="w-full bg-black border border-white/5 rounded-lg px-3 py-2 text-[10px] text-zinc-400 outline-none focus:border-[#D4AF37]/30"
                                        />
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
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest pl-1">视频引擎 (视频生成)</label>
                        <div className="grid grid-cols-3 gap-1 p-1 bg-black/40 rounded-xl border border-white/5">
                            {VIDEO_ENGINES.map(engine => (
                                <button
                                    key={engine.value}
                                    onClick={() => updateGlobalContext({ video_engine: engine.value as any })}
                                    className={`px-2 py-2 rounded-lg transition-all text-[9.5px] font-bold uppercase ${globalContext.video_engine === engine.value ? 'bg-[#D4AF37] text-black shadow-sm' : 'text-zinc-400 hover:text-white'}`}
                                    title={engine.desc}
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
