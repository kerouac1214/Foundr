import React from 'react';
import { Chapter } from '../types';
import { useProjectStore } from '../store/useProjectStore';

interface ChapterSidebarProps {
    chapters: Chapter[];
    onSelectChapter: (chapterId: string) => void;
    onGenerateChapter: (chapterId: string) => void;
    isAnalyzing: boolean;
}

const ChapterSidebar: React.FC<ChapterSidebarProps> = ({
    chapters,
    onSelectChapter,
    onGenerateChapter,
    isAnalyzing
}) => {
    const { selectedChapterId } = useProjectStore();

    return (
        <div className="w-64 border-r border-gray-800 bg-black/20 flex flex-col h-full animate-in slide-in-from-left-4 duration-500">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                <h3 className="text-[10px] font-black tracking-[0.2em] text-gray-500 uppercase">章节目录 (Chapters)</h3>
                <span className="text-[10px] px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded-md font-bold">{chapters.length}</span>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {chapters.map((chapter) => (
                    <div
                        key={chapter.id}
                        onClick={() => onSelectChapter(chapter.id)}
                        className={`group p-3 rounded-xl border transition-all cursor-pointer ${selectedChapterId === chapter.id
                            ? 'bg-director-accent/10 border-director-accent/40'
                            : 'border-transparent hover:bg-white/5'
                            }`}
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1">
                                <h4 className={`text-[11px] font-bold ${selectedChapterId === chapter.id ? 'text-director-accent' : 'text-gray-300'
                                    }`}>
                                    {chapter.title}
                                </h4>
                                <p className="text-[9px] text-gray-500 line-clamp-2 leading-relaxed">
                                    {chapter.summary}
                                </p>
                            </div>
                        </div>

                        {selectedChapterId === chapter.id && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onGenerateChapter(chapter.id);
                                }}
                                disabled={isAnalyzing || chapter.is_planning}
                                className={`mt-3 w-full py-1.5 rounded-lg transition-all shadow-lg text-[9px] font-black uppercase tracking-tighter ${chapter.storyboard && chapter.storyboard.length > 0
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 shadow-emerald-500/5'
                                        : 'bg-director-accent hover:bg-blue-400 text-black shadow-blue-500/10'
                                    }`}
                            >
                                {isAnalyzing ? '正在规划...' : (
                                    chapter.is_planning ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-2 h-2 border border-black/20 border-t-black rounded-full animate-spin" />
                                            <span>后台规划中...</span>
                                        </div>
                                    ) : (chapter.storyboard && chapter.storyboard.length > 0 ? '重新规划分镜' : '规划此章节分镜')
                                )}
                            </button>
                        )}
                        {!selectedChapterId && chapter.is_planning && (
                            <div className="mt-2 flex items-center gap-2 px-1">
                                <div className="w-1.5 h-1.5 bg-director-accent rounded-full animate-pulse shadow-[0_0_8px_rgba(30,144,255,0.8)]" />
                                <span className="text-[8px] text-director-accent/60 font-bold uppercase tracking-widest">后台规划中...</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="p-4 bg-black/40 border-t border-gray-800">
                <p className="text-[8px] text-gray-600 leading-tight">
                    💡 点击章节即可查看详情并触发该章节的独立分镜规划流程。全局资产将自动同步。
                </p>
            </div>
        </div>
    );
};

export default ChapterSidebar;
