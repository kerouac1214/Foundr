import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useUIStore } from '../store/useUIStore';
import { generateId } from '../utils';

interface ProjectListProps {
    onClose: () => void;
}

const ProjectList: React.FC<ProjectListProps> = ({ onClose }) => {
    const [newProjectName, setNewProjectName] = useState('');
    const { setIsAnalyzing, setStatusMessage } = useUIStore();

    // Cloud Store Actions & State
    const cloudProjects = useProjectStore(s => s.cloudProjects);
    const isSyncing = useProjectStore(s => s.isSyncing);
    const fetchCloudProjects = useProjectStore(s => s.fetchCloudProjects);
    const saveToCloud = useProjectStore(s => s.saveToCloud);
    const loadCloudProject = useProjectStore(s => s.loadCloudProject);
    const deleteCloudProject = useProjectStore(s => s.deleteCloudProject);
    const setProjectMetadata = useProjectStore(s => s.setProjectMetadata);

    useEffect(() => {
        fetchCloudProjects();
    }, []);

    const saveCurrentAsNew = async () => {
        if (!newProjectName.trim()) return;

        // Update local metadata first
        setProjectMetadata({
            id: `proj_${generateId()}`,
            name: newProjectName.trim(),
            bpm: 120,
            energy_level: 'High',
            overall_mood: 'Cinematic',
            transitions: []
        });

        await saveToCloud();
        setNewProjectName('');
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in">
            <div className="w-full max-w-2xl mx-4 bg-[#0a0a0a] rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <h2 className="text-xl font-black">云端项目管理</h2>
                        {isSyncing && (
                            <div className="flex items-center gap-2 px-2 py-1 bg-[#D4AF37]/10 rounded-full">
                                <span className="w-1.5 h-1.5 bg-[#D4AF37] rounded-full animate-pulse" />
                                <span className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-wider">Syncing</span>
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white transition-colors">✕</button>
                </div>

                {/* New Project */}
                <div className="px-8 py-6 border-b border-white/10 flex gap-4">
                    <input
                        value={newProjectName}
                        onChange={e => setNewProjectName(e.target.value)}
                        placeholder="新项目名称..."
                        disabled={isSyncing}
                        className="flex-grow px-4 py-3 bg-black border border-white/10 rounded-xl text-sm outline-none focus:border-[#D4AF37]/50 disabled:opacity-50"
                        onKeyDown={e => e.key === 'Enter' && saveCurrentAsNew()}
                    />
                    <button
                        onClick={saveCurrentAsNew}
                        disabled={isSyncing || !newProjectName.trim()}
                        className="px-6 py-3 bg-[#D4AF37] text-black rounded-xl text-sm font-bold disabled:opacity-50 hover:brightness-110 active:scale-95 transition-all"
                    >
                        新建存档
                    </button>
                </div>

                {/* Project List */}
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                    {cloudProjects.length === 0 ? (
                        <div className="px-8 py-12 text-center text-zinc-500">
                            <p className="text-sm">云端暂无保存的项目</p>
                            <p className="text-xs mt-2">输入剧本名称并点击"新建存档"开始</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {cloudProjects.map(project => (
                                <div key={project._id} className="px-8 py-5 flex items-center gap-4 hover:bg-white/5 group transition-colors">
                                    <div className="flex-grow">
                                        <p className="font-bold text-sm text-white group-hover:text-[#D4AF37] transition-colors">{project.projectMetadata?.name || '未命名项目'}</p>
                                        <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest font-mono">ID: {project.projectMetadata?.id?.slice(0, 8)}...</p>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={async () => {
                                                await loadCloudProject(project._id);
                                                onClose();
                                            }}
                                            disabled={isSyncing}
                                            className="px-4 py-2 bg-[#D4AF37]/10 text-[#D4AF37] rounded-lg text-xs font-bold hover:bg-[#D4AF37] hover:text-black transition-all"
                                        >
                                            加载
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (window.confirm('确定要从云端删除此项目吗？')) {
                                                    deleteCloudProject(project.projectMetadata.id);
                                                }
                                            }}
                                            disabled={isSyncing}
                                            className="px-4 py-2 bg-red-500/10 rounded-lg text-xs font-bold text-red-400 hover:bg-red-500 hover:text-white transition-all"
                                        >
                                            删除
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="px-8 py-4 bg-white/[0.02] border-t border-white/5 flex justify-between items-center">
                    <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold">Laf Cloud Storage Enabled</p>
                    <p className="text-[10px] text-zinc-400">所有数据已在 20 人群组内共享</p>
                </div>
            </div>
        </div>
    );
};

export default ProjectList;
