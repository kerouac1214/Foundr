import React from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { EXAMPLE_SCRIPTS } from '../constants';

interface ScriptEditorProps {
    className?: string;
}

const ScriptEditor: React.FC<ScriptEditorProps> = ({ className }) => {
    const script = useProjectStore((state) => state.script);
    const setScript = useProjectStore((state) => state.setScript);

    return (
        <div className={`bg-[#050505] p-12 rounded-[4rem] border border-white/10 space-y-8 ${className}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-1 h-6 bg-[#D4AF37] rounded-full" />
                    <h2 className="text-xs font-black uppercase tracking-[0.5em] text-zinc-300">文学剧本输入</h2>
                </div>
            </div>
            <textarea
                value={script}
                onChange={e => setScript(e.target.value)}
                placeholder="输入剧本，或点击右上角选择示例..."
                className="w-full h-[520px] bg-black border border-white/10 rounded-[3rem] p-10 text-base outline-none resize-none serif leading-relaxed"
            />
        </div>
    );
};

export default ScriptEditor;
