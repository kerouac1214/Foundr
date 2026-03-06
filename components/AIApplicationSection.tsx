import React, { useState } from 'react';
import NarrativeGridModal from './NarrativeGridModal';
import ShotAdjustmentModal from './ShotAdjustmentModal';
import VoiceCloneModal from './VoiceCloneModal';
import VoiceDesignModal from './VoiceDesignModal';

interface AIAppCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    onClick: () => void;
    comingSoon?: boolean;
}

const AIAppCard: React.FC<AIAppCardProps> = ({ title, description, icon, onClick, comingSoon }) => (
    <div
        onClick={comingSoon ? undefined : onClick}
        className={`group relative p-8 rounded-[2.5rem] border transition-all duration-500 flex flex-col gap-6 cursor-pointer
            ${comingSoon
                ? 'bg-white/2 border-white/5 opacity-50 grayscale'
                : 'bg-[#121212] border-white/10 hover:border-[#D4AF37]/50 hover:bg-[#1a1a1a] shadow-xl hover:shadow-[#D4AF37]/10'}`}
    >
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-500 group-hover:scale-110 
            ${comingSoon ? 'bg-white/5 text-zinc-600' : 'bg-[#D4AF37]/10 text-[#D4AF37]'}`}>
            {icon}
        </div>
        <div>
            <h3 className="text-xl font-black text-white mb-2 group-hover:text-[#D4AF37] transition-colors tracking-tight italic uppercase serif">{title}</h3>
            <p className="text-sm text-zinc-500 leading-relaxed font-medium">{description}</p>
        </div>
        {!comingSoon && (
            <div className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#D4AF37] opacity-0 group-hover:opacity-100 transition-opacity">
                立即开启 (Launch) →
            </div>
        )}
        {comingSoon && (
            <div className="absolute top-6 right-6 px-3 py-1 bg-white/5 rounded-full text-[8px] font-black uppercase tracking-widest text-zinc-600 border border-white/5">
                开发中 (Coming Soon)
            </div>
        )}
    </div>
);

const AIApplicationSection: React.FC = () => {
    const [showNarrativeGrid, setShowNarrativeGrid] = useState(false);
    const [showShotAdjustment, setShowShotAdjustment] = useState(false);
    const [showVoiceClone, setShowVoiceClone] = useState(false);
    const [showVoiceDesign, setShowVoiceDesign] = useState(false);

    const apps = [
        {
            id: 'narrative-grid',
            title: '九宫格电影叙事',
            description: '基于大师级摄影师思维，将剧本瞬间转化为 3x3 专业电影分镜序列，锁定角色、环境与视觉风格。',
            icon: (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
            ),
            onClick: () => setShowNarrativeGrid(true)
        },
        {
            id: 'shot-adjustment',
            title: '景别调整',
            description: '通过 NB2 模型深度重构镜头，实现俯视、仰视、广角与特写之间的专业视点转换，维持主体连贯性。',
            icon: (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
            ),
            onClick: () => setShowShotAdjustment(true)
        },
        {
            id: 'voice-clone',
            title: '声音克隆',
            description: '通过 3-10 秒样本深度克隆人声特征，实现极高还原度的中英文 TTS 文本转语音，重塑数字声纹。',
            icon: (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
            ),
            onClick: () => setShowVoiceClone(true)
        },
        {
            id: 'voice-design',
            title: '声音设计',
            description: '定义年龄、性别与情绪参数，从零构建极具表现力的虚拟人声，为数字角色注入灵魂。',
            icon: (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
            ),
            onClick: () => setShowVoiceDesign(true)
        },
        {
            id: 'role-consistency',
            title: '角色灵魂采样',
            description: '从单张照片中深度提取角色的 3D 骨架、面部特征与微表情，确保全剧动作高度一致。',
            icon: (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            ),
            comingSoon: true
        },
        {
            id: 'lighting-orchestra',
            title: '光影指挥家',
            description: '通过对剧本情绪的实时理解，自动调配电影级三点光影方案（Key/Fill/Back），打造极致氛围。',
            icon: (
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
            ),
            comingSoon: true
        }
    ];

    return (
        <div className="max-w-6xl mx-auto py-12 px-6">
            <div className="mb-16">
                <h2 className="text-4xl font-black italic uppercase italic bg-gradient-to-r from-white to-zinc-600 bg-clip-text text-transparent mb-4 serif">AI 应用板块 (AI Applications)</h2>
                <p className="text-zinc-500 font-medium tracking-[0.2em] uppercase text-sm">解构创作边界，以 AI 之名重定义视听语言</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {apps.map(app => (
                    <AIAppCard
                        key={app.id}
                        title={app.title}
                        description={app.description}
                        icon={app.icon}
                        onClick={app.onClick || (() => { })}
                        comingSoon={app.comingSoon}
                    />
                ))}
            </div>

            <NarrativeGridModal
                isOpen={showNarrativeGrid}
                onClose={() => setShowNarrativeGrid(false)}
            />

            <ShotAdjustmentModal
                isOpen={showShotAdjustment}
                onClose={() => setShowShotAdjustment(false)}
            />

            <VoiceCloneModal
                isOpen={showVoiceClone}
                onClose={() => setShowVoiceClone(false)}
            />

            <VoiceDesignModal
                isOpen={showVoiceDesign}
                onClose={() => setShowVoiceDesign(false)}
            />
        </div>
    );
};

export default AIApplicationSection;
