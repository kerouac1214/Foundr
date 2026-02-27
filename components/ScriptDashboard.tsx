import React from 'react';
import { ProjectMetadata, GlobalContext } from '../types';

interface ScriptDashboardProps {
    metadata: ProjectMetadata | null;
    context: GlobalContext;
    onNext?: () => void;
}

const ScriptDashboard: React.FC<ScriptDashboardProps> = ({ metadata, context, onNext }) => {
    if (!metadata) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 p-8">
                <div className="w-16 h-16 border-2 border-dashed border-gray-800 rounded-full flex items-center justify-center animate-pulse">
                    <svg className="w-8 h-8 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-500">等待剧本分析...</h3>
                <p className="text-xs text-gray-600 max-w-xs leading-relaxed">
                    在左侧输入文学剧本并点击“规划分镜”，AI 将自动提取场景、角色及情感曲线，并在此展示导演看板。
                </p>
            </div>
        );
    }

    const stats = [
        { label: '节奏感 (BPM)', value: metadata.bpm, icon: '⏱️', color: 'text-blue-400' },
        { label: '能量等级', value: metadata.energy_level, icon: '🔥', color: 'text-orange-400' },
        { label: '情感基调', value: metadata.overall_mood, icon: '🎭', color: 'text-purple-400' },
        { label: '角色数量', value: context.characters.length, icon: '👤', color: 'text-green-400' },
        { label: '预设场景', value: context.scenes.length, icon: '🖼️', color: 'text-cyan-400' },
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Analysis Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {stats.map((stat, i) => (
                    <div key={i} className="director-panel p-4 flex flex-col items-center justify-center gap-2 border-director-border/50 hover:border-director-accent/30 transition-all group">
                        <span className="text-2xl group-hover:scale-110 transition-transform duration-300">{stat.icon}</span>
                        <span className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">{stat.label}</span>
                        <span className={`text-xl font-black ${stat.color} tracking-tight`}>{stat.value}</span>
                    </div>
                ))}
            </div>

            {/* Production DNA Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="director-panel p-6 space-y-4">
                    <div className="flex items-center gap-3 border-b border-gray-800 pb-3">
                        <div className="w-2 h-2 rounded-full bg-director-accent animate-pulse" />
                        <h4 className="text-xs font-black tracking-widest text-white uppercase">视觉 DNA (Visual DNA)</h4>
                    </div>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-gray-500 uppercase font-bold">风格基调</span>
                            <span className="text-xs text-director-accent font-medium italic">{context.style_package}</span>
                        </div>
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] text-gray-500 uppercase font-bold shrink-0">核心色彩</span>
                            <span className="text-xs text-gray-300 text-right ml-4">{context.core_colors}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] text-gray-500 uppercase font-bold">画面比例</span>
                            <span className="text-xs text-white px-2 py-0.5 bg-director-panel-light border border-director-border rounded">{context.aspect_ratio}</span>
                        </div>
                    </div>
                </div>

                <div className="director-panel p-6 space-y-4">
                    <div className="flex items-center gap-3 border-b border-gray-800 pb-3">
                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                        <h4 className="text-xs font-black tracking-widest text-white uppercase">创作洞察 (Insights)</h4>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed italic">
                        该剧本呈现出 <span className="text-white font-bold">{metadata.overall_mood || '未知'}</span> 的叙事氛围，
                        整体能量等级为 <span className="text-white font-bold">{metadata.energy_level || '稳定'}</span>。
                        {(metadata.transitions && metadata.transitions.length > 0) ? (
                            <span>系统已根据节奏特征建议在第 {metadata.transitions.join(', ')} 处进行重点转场优化。</span>
                        ) : (
                            <span>系统已完成全片节奏扫描。</span>
                        )}
                    </p>
                    <div className="pt-2">
                        <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-blue-600 to-director-accent transition-all duration-1000"
                                style={{ width: `${(metadata.bpm / 180) * 100}%` }}
                            />
                        </div>
                        <div className="flex justify-between mt-2">
                            <span className="text-[9px] text-gray-600 font-bold uppercase">慢节奏</span>
                            <span className="text-[9px] text-gray-600 font-bold uppercase">动态/狂烈</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Action Overlay (Optional but nice) */}
            <div className="flex justify-center pt-4">
                {onNext ? (
                    <button
                        onClick={onNext}
                        className="px-8 py-3 bg-[#D4AF37] hover:bg-[#ebd578] shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all rounded-full text-[12px] text-black font-black tracking-widest uppercase flex items-center gap-2 animate-bounce"
                    >
                        前往提取资产清单
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </button>
                ) : (
                    <div className="px-6 py-2 bg-director-accent/10 border border-director-accent/30 rounded-full text-[10px] text-director-accent font-bold tracking-widest uppercase animate-bounce">
                        分析完成 · 系统已预置资产清单
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScriptDashboard;
