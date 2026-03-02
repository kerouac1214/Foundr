import React from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useUIStore } from '../store/useUIStore';
import { EXAMPLE_SCRIPTS } from '../constants';

import { parseFile } from '../services/fileParsingService';

interface ScriptEditorProps {
    className?: string;
    script?: string;
    onChange?: (val: string) => void;
}

const ScriptEditor: React.FC<ScriptEditorProps> = ({ className, script: propScript, onChange }) => {
    const storeScript = useProjectStore((state) => state.script);
    const setStoreScript = useProjectStore((state) => state.setScript);
    const showToast = useUIStore((state) => state.showToast);

    const [localValue, setLocalValue] = React.useState(propScript || storeScript || '');
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Sync local state with props when they change (e.g. example script selection or chapter switch)
    React.useEffect(() => {
        const val = propScript !== undefined ? propScript : storeScript;
        console.log('ScriptEditor: Syncing localValue. Length:', val?.length || 0, 'Source:', propScript !== undefined ? 'prop' : 'store', 'ID:', propScript !== undefined ? 'Chapter' : 'Global');
        setLocalValue(val || '');
    }, [propScript, storeScript]);

    const handleScriptChange = (val: string) => {
        setLocalValue(val);
        if (onChange) {
            onChange(val);
        } else {
            setStoreScript(val);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        showToast(`正在解析文件: ${file.name}...`, 'info');

        try {
            const content = await parseFile(file);
            if (content && content.trim()) {
                handleScriptChange(content);
                showToast(`剧本导入成功 (${content.length} 字符)`, 'success');
            } else {
                showToast('文件内容为空或无法识别', 'info');
            }
        } catch (error) {
            console.error('File import error:', error);
            showToast(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
        } finally {
            // Reset input so the same file can be uploaded again
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className={`bg-[#050505] p-12 rounded-[4rem] border border-white/10 space-y-8 ${className}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-1 h-6 bg-[#D4AF37] rounded-full" />
                    <h2 className="text-xs font-black uppercase tracking-[0.5em] text-zinc-300">文学剧本输入</h2>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        title="选择示例剧本"
                        onChange={(e) => {
                            if (e.target.value) {
                                handleScriptChange(e.target.value);
                                showToast('已成功加载示例剧本', 'success');
                            }
                        }}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest text-zinc-400 outline-none cursor-pointer transition-all"
                    >
                        <option value="">快捷填充示例...</option>
                        {EXAMPLE_SCRIPTS.map(s => (
                            <option key={s.name} value={s.content}>{s.name}</option>
                        ))}
                    </select>
                    <input
                        type="file"
                        title="上传剧本文件"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".txt,.md,.docx,.pdf,.xlsx,.xls,.csv"
                        className="hidden"
                    />
                    <button
                        onClick={() => {
                            console.log('Upload button clicked');
                            fileInputRef.current?.click();
                        }}
                        className="flex items-center gap-2 px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest text-[#D4AF37] transition-all active:scale-95"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        导入剧本
                    </button>
                </div>
            </div>
            <textarea
                value={localValue}
                onChange={e => {
                    console.log('Textarea onChange triggered, length:', e.target.value.length);
                    handleScriptChange(e.target.value);
                }}
                onPaste={e => {
                    const pastedText = e.clipboardData.getData('text');
                    console.log('Textarea onPaste triggered, length:', pastedText?.length || 0);
                }}
                placeholder="在此输入剧本内容..."
                className="w-full h-[520px] bg-black border border-white/10 rounded-[3rem] p-10 text-base outline-none resize-none serif leading-relaxed text-zinc-200 selection:bg-[#D4AF37]/30"
            />
        </div>
    );
};

export default ScriptEditor;
