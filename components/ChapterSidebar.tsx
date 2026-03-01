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
                                disabled={isAnalyzing}
                                className="mt-3 w-full py-1.5 bg-director-accent hover:bg-blue-400 disabled:opacity-50 text-black text-[9px] font-black uppercase tracking-tighter rounded-lg transition-all shadow-lg shadow-blue-500/10"
                            >
                                {isAnalyzing ? '正在规划...' : '规划此章节分镜'}
                            </button>
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
