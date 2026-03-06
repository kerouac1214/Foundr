import React from 'react';
import { ProjectMetadata, GlobalContext, Chapter } from '../types';

interface EpisodeDashboardProps {
    metadata: ProjectMetadata | null;
    context: GlobalContext;
    onGenerateChapter: (chapterId: string) => void;
    onExtractAssets: () => void;
    isAnalyzing: boolean;
    onBackToScript: () => void;
}

const EpisodeDashboard: React.FC<EpisodeDashboardProps> = ({
    metadata,
    context,
    onGenerateChapter,
    onExtractAssets,
    isAnalyzing,
    onBackToScript
}) => {
    const chapters: Chapter[] = metadata?.chapters || [];

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* === Section 1: Script Analysis Stats === */}
            <div>
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-4 rounded-full bg-director-accent" />
                        <h2 className="text-sm font-black tracking-widest uppercase text-white">剧本分析结果</h2>
                    </div>
                    <div className="flex items-center gap-3">
                        {context.characters.length > 0 && chapters.some(c => c.is_planning) && (
                            <div className="flex items-center gap-2 mr-4">
                                <div className="w-2 h-2 bg-director-accent rounded-full animate-pulse shadow-[0_0_8px_rgba(30,144,255,0.6)]" />
                                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">后台分镜规划中...</span>
                            </div>
                        )}
                        <button
                            onClick={onExtractAssets}
                            disabled={isAnalyzing}
                            className="px-6 py-2.5 bg-[#4F46E5] hover:bg-[#6366F1] text-white rounded-md text-[11px] font-black tracking-widest uppercase disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                            提取资产 (Step 2)
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                        { label: '节奏感 (BPM)', value: metadata?.bpm ?? '—', icon: '⏱️', color: 'text-blue-400' },
                        { label: '能量等级', value: metadata?.energy_level ?? '—', icon: '🔥', color: 'text-orange-400' },
                        { label: '情感基调', value: metadata?.overall_mood ?? '—', icon: '🎭', color: 'text-purple-400' },
                        { label: '角色数量', value: context.characters.length, icon: '👤', color: 'text-green-400' },
                        { label: '预设场景', value: context.scenes.length, icon: '🖼️', color: 'text-cyan-400' },
                    ].map((stat, i) => (
                        <div key={i} className="director-panel p-4 flex flex-col items-center justify-center gap-2 border-director-border/50 hover:border-director-accent/30 transition-all group">
                            <span className="text-2xl group-hover:scale-110 transition-transform duration-300">{stat.icon}</span>
                            <span className="text-[10px] font-bold tracking-widest text-gray-500 uppercase text-center">{stat.label}</span>
                            <span className={`text-lg font-black ${stat.color} tracking-tight text-center`}>{String(stat.value)}</span>
                        </div>
                    ))}
                </div>

                {/* Visual DNA + Insights row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                    <div className="director-panel p-5 space-y-3">
                        <div className="flex items-center gap-3 border-b border-gray-800 pb-3">
                            <div className="w-2 h-2 rounded-full bg-director-accent animate-pulse" />
                            <h4 className="text-xs font-black tracking-widest text-white uppercase">视觉 DNA (Visual DNA)</h4>
                        </div>
                        <div className="space-y-3">
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

                    <div className="director-panel p-5 space-y-3">
                        <div className="flex items-center gap-3 border-b border-gray-800 pb-3">
                            <div className="w-2 h-2 rounded-full bg-purple-500" />
                            <h4 className="text-xs font-black tracking-widest text-white uppercase">创作洞察 (Insights)</h4>
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed italic">
                            该剧本呈现出 <span className="text-white font-bold">{metadata?.overall_mood || '未知'}</span> 的叙事氛围，
                            整体能量等级为 <span className="text-white font-bold">{metadata?.energy_level || '稳定'}</span>。
                            {(Array.isArray(metadata?.transitions) && (metadata?.transitions?.length ?? 0) > 0) ? (
                                <span> 系统已根据节奏特征建议在第 {metadata!.transitions!.join(', ')} 处进行重点转场优化。</span>
                            ) : (
                                <span> 系统已完成全片节奏扫描。</span>
                            )}
                        </p>
                        <div className="pt-1">
                            <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-600 to-director-accent transition-all duration-1000"
                                    style={{ width: `${Math.min(((metadata?.bpm ?? 90) / 180) * 100, 100)}%` }}
                                />
                            </div>
                            <div className="flex justify-between mt-1.5">
                                <span className="text-[9px] text-gray-600 font-bold uppercase">慢节奏</span>
                                <span className="text-[9px] text-gray-600 font-bold uppercase">动态/狂烈</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* === Section 2: Episodes / Chapters List === */}
            <div>
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-1.5 h-4 rounded-full bg-[#D4AF37]" />
                    <h2 className="text-sm font-black tracking-widest uppercase text-white">分集列表</h2>
                    <span className="ml-2 text-[10px] text-gray-500 font-bold">({chapters.length} 集)</span>
                </div>

                {chapters.length === 0 ? (
                    <div className="director-panel p-10 text-center text-gray-600 text-xs">
                        暂无分集数据，请先运行"全剧架构分析"。
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                        {chapters.map((chapter, index) => (
                            <div
                                key={chapter.id}
                                className="director-panel p-5 flex flex-col gap-4 border-director-border/50 hover:border-[#D4AF37]/40 transition-all duration-300 group relative overflow-hidden"
                            >
                                {/* Episode badge */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-md bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] font-black flex items-center justify-center">
                                            {index + 1}
                                        </span>
                                        <span className="text-[10px] font-bold text-[#D4AF37] uppercase tracking-widest">第 {index + 1} 集</span>
                                    </div>
                                    <span className="text-[9px] font-bold text-gray-600 bg-black/40 px-2 py-0.5 rounded-full uppercase border border-gray-800">
                                        {chapter.content ? `${Math.ceil(chapter.content.length / 300)} 镜预估` : '待分析'}
                                    </span>
                                </div>

                                {/* Chapter Title */}
                                <div>
                                    <h3 className="text-sm font-black text-white leading-snug group-hover:text-[#D4AF37] transition-colors duration-300">
                                        {chapter.title || `第${index + 1}集`}
                                    </h3>
                                    {chapter.summary && (
                                        <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed line-clamp-3">
                                            {chapter.summary}
                                        </p>
                                    )}
                                    {chapter.is_planning && (
                                        <div className="mt-2 flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 bg-director-accent rounded-full animate-pulse shadow-[0_0_5px_rgba(30,144,255,0.5)]" />
                                            <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">后台规划中...</span>
                                        </div>
                                    )}
                                </div>

                                {/* Action Button */}
                                <div className="mt-auto">
                                    <button
                                        onClick={() => onGenerateChapter(chapter.id)}
                                        disabled={isAnalyzing}
                                        className="w-full py-2.5 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 border border-[#D4AF37]/30 hover:border-[#D4AF37]/60 text-[#D4AF37] rounded-lg text-[11px] font-bold tracking-widest uppercase transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isAnalyzing ? (
                                            <>
                                                <div className="w-3 h-3 border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full animate-spin" />
                                                分析中...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                                                </svg>
                                                制作本集分镜
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Decorative glow on hover */}
                                <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl shadow-[inset_0_0_40px_rgba(212,175,55,0.05)]" />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default EpisodeDashboard;
