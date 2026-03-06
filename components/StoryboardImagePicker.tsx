import React from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { StoryboardItem } from '../types';

interface StoryboardImagePickerProps {
    onSelect: (url: string, shot: StoryboardItem) => void;
    onClose: () => void;
}

export const StoryboardImagePicker: React.FC<StoryboardImagePickerProps> = ({ onSelect, onClose }) => {
    const { storyboard } = useProjectStore();

    // Filter shots that have a preview_url (or candidate images)
    const shotsWithImages = storyboard.filter(shot => shot.preview_url || (shot.candidate_image_urls && shot.candidate_image_urls.length > 0));

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-white">从分镜库选择图片</h2>
                        <p className="text-sm text-gray-400 mt-1">点击分镜图将其作为 AI 生成的参考底图</p>
                    </div>
                    <button
                        onClick={onClose}
                        title="关闭"
                        className="p-2 hover:bg-white/5 rounded-full transition-colors"
                    >
                        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {shotsWithImages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                            <svg className="w-16 h-16 mb-4 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p>分镜库目前没有可用的图片</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                            {shotsWithImages.map((shot) => (
                                <div
                                    key={shot.id}
                                    onClick={() => onSelect(shot.preview_url || shot.candidate_image_urls![0], shot)}
                                    className="group relative cursor-pointer aspect-video rounded-xl overflow-hidden border border-white/10 hover:border-blue-500/50 transition-all shadow-lg"
                                >
                                    <img
                                        src={shot.preview_url || shot.candidate_image_urls![0]}
                                        alt={`Shot ${shot.shot_number}`}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                                        <p className="text-xs font-medium text-white">镜头 {shot.shot_number}</p>
                                        <p className="text-[10px] text-gray-300 truncate mt-0.5">{shot.visual_content || shot.action_description}</p>
                                    </div>
                                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[10px] font-bold text-white border border-white/10">
                                        SHOT {shot.shot_number}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-white/5 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded-full text-sm font-medium text-gray-400 hover:text-white transition-colors"
                    >
                        取消
                    </button>
                </div>
            </div>
        </div>
    );
};
