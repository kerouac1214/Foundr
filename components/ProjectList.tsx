import React, { useState, useEffect } from 'react';
import { AppState } from '../types';
import { importProjectFromZip } from '../services/exportService';
import { useUIStore } from '../store/useUIStore';

const PROJECTS_KEY = 'foundr_projects';

export interface SavedProject {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    state: AppState;
}

interface ProjectListProps {
    currentState: AppState;
    onLoadProject: (state: AppState) => void;
    onClose: () => void;
}

const ProjectList: React.FC<ProjectListProps> = ({ currentState, onLoadProject, onClose }) => {
    const [projects, setProjects] = useState<SavedProject[]>([]);
    const [newProjectName, setNewProjectName] = useState('');
    const { setIsAnalyzing, setStatusMessage } = useUIStore();

    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = () => {
        try {
            const saved = localStorage.getItem(PROJECTS_KEY);
            if (saved) {
                setProjects(JSON.parse(saved));
            }
        } catch (e) {
            console.error('Failed to load projects', e);
        }
    };

    const saveProjects = (updated: SavedProject[]) => {
        localStorage.setItem(PROJECTS_KEY, JSON.stringify(updated));
        setProjects(updated);
    };

    const saveCurrentAsNew = () => {
        if (!newProjectName.trim()) return;
        const newProject: SavedProject = {
            id: `proj_${Date.now()}`,
            name: newProjectName.trim(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            state: currentState
        };
        saveProjects([newProject, ...projects]);
        setNewProjectName('');
    };

    const updateProject = (id: string) => {
        const updated = projects.map(p =>
            p.id === id
                ? { ...p, state: currentState, updatedAt: new Date().toISOString() }
                : p
        );
        saveProjects(updated);
    };

    const deleteProject = (id: string) => {
        if (window.confirm('确定要删除这个项目吗？')) {
            saveProjects(projects.filter(p => p.id !== id));
        }
    };

    const exportProject = (project: SavedProject) => {
        const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.name}.foundr.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const importProject = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.name.endsWith('.zip')) {
            setIsAnalyzing(true);
            try {
                const projectData = await importProjectFromZip(file, setStatusMessage);
                const imported: SavedProject = {
                    id: `proj_${Date.now()}`,
                    name: `${projectData.projectName || '未命名'} (导入)`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    state: {
                        lyrics: projectData.script,
                        project: {
                            metadata: projectData.projectMetadata,
                            storyboard: projectData.storyboard
                        },
                        global_context: projectData.globalContext,
                        // Defaults for other fields
                        isAnalyzing: false,
                        progress: 0,
                        statusMessage: '',
                        phase: 'idle',
                        error: null,
                        activeView: 'foundry'
                    } as any
                };
                saveProjects([imported, ...projects]);
            } catch (err: any) {
                alert(`导入 ZIP 失败: ${err.message}`);
            } finally {
                setIsAnalyzing(false);
                setStatusMessage('');
            }
        } else {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const imported = JSON.parse(event.target?.result as string) as SavedProject;
                    imported.id = `proj_${Date.now()}`;
                    imported.name = `${imported.name} (导入)`;
                    saveProjects([imported, ...projects]);
                } catch (err) {
                    alert('导入失败：文件格式无效');
                }
            };
            reader.readAsText(file);
        }
        e.target.value = '';
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in">
            <div className="w-full max-w-2xl mx-4 bg-[#0a0a0a] rounded-[2rem] border border-white/10 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-white/10">
                    <h2 className="text-xl font-black">项目管理</h2>
                    <button onClick={onClose} className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white">✕</button>
                </div>

                {/* New Project */}
                <div className="px-8 py-6 border-b border-white/10 flex gap-4">
                    <input
                        value={newProjectName}
                        onChange={e => setNewProjectName(e.target.value)}
                        placeholder="新项目名称..."
                        className="flex-grow px-4 py-3 bg-black border border-white/10 rounded-xl text-sm outline-none focus:border-[#D4AF37]/50"
                        onKeyDown={e => e.key === 'Enter' && saveCurrentAsNew()}
                    />
                    <button onClick={saveCurrentAsNew} className="px-6 py-3 bg-[#D4AF37] text-black rounded-xl text-sm font-bold">保存当前</button>
                    <label className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-sm font-bold cursor-pointer hover:bg-white/10 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        导入 (.json / .zip)
                        <input type="file" accept=".json,.zip" onChange={importProject} className="hidden" />
                    </label>
                </div>

                {/* Project List */}
                <div className="max-h-[400px] overflow-y-auto">
                    {projects.length === 0 ? (
                        <div className="px-8 py-12 text-center text-zinc-500">
                            <p className="text-sm">暂无保存的项目</p>
                            <p className="text-xs mt-2">输入名称并点击"保存当前"按钮开始</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {projects.map(project => (
                                <div key={project.id} className="px-8 py-4 flex items-center gap-4 hover:bg-white/5 group">
                                    <div className="flex-grow">
                                        <p className="font-bold text-sm">{project.name}</p>
                                        <p className="text-xs text-zinc-500">创建于 {formatDate(project.createdAt)} · 更新于 {formatDate(project.updatedAt)}</p>
                                    </div>
                                    <button onClick={() => onLoadProject(project.state)} className="px-4 py-2 bg-[#D4AF37]/10 text-[#D4AF37] rounded-lg text-xs font-bold hover:bg-[#D4AF37] hover:text-black transition-all">加载</button>
                                    <button onClick={() => updateProject(project.id)} className="px-4 py-2 bg-white/5 rounded-lg text-xs font-bold text-zinc-400 hover:text-white opacity-0 group-hover:opacity-100">覆盖</button>
                                    <button onClick={() => exportProject(project)} className="px-4 py-2 bg-white/5 rounded-lg text-xs font-bold text-zinc-400 hover:text-white opacity-0 group-hover:opacity-100">导出</button>
                                    <button onClick={() => deleteProject(project.id)} className="px-4 py-2 bg-red-500/10 rounded-lg text-xs font-bold text-red-400 hover:bg-red-500 hover:text-white opacity-0 group-hover:opacity-100">删除</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProjectList;
