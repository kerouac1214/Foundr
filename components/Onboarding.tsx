import React, { useState, useEffect } from 'react';

const ONBOARDING_KEY = 'foundr_onboarding_completed';

export interface OnboardingStep {
    title: string;
    description: string;
    target?: string; // 可选的目标元素描述
}

const STEPS: OnboardingStep[] = [
    {
        title: '👋 欢迎使用 Foundr',
        description: '这是一个 AI 驱动的短片制作工具。让我们快速了解工作流程。'
    },
    {
        title: '📝 步骤 1: 输入剧本',
        description: '在剧本输入区域输入您的故事，或点击示例按钮快速体验（悬停查看详情）。'
    },
    {
        title: '🎬 步骤 2: 生成分镜',
        description: '点击"生成分镜"，AI 将自动拆解剧本为镜头序列，提取角色信息。'
    },
    {
        title: '🎨 步骤 3: 渲染画面',
        description: '提取角色资产后，可以批量渲染所有镜头，或单独渲染特定镜头。'
    },
    {
        title: '🔒 锁定与重试',
        description: '满意的镜头可以锁定，批量操作时会自动跳过。遇到错误时可使用重试按钮。'
    },
    {
        title: '✨ 开始创作吧！',
        description: '如需再次查看引导，可点击右上角的帮助按钮。'
    }
];

interface OnboardingProps {
    onComplete: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
    const [step, setStep] = useState(0);
    const [visible, setVisible] = useState(true);

    const handleNext = () => {
        if (step < STEPS.length - 1) {
            setStep(step + 1);
        } else {
            localStorage.setItem(ONBOARDING_KEY, 'true');
            setVisible(false);
            setTimeout(onComplete, 300);
        }
    };

    const handlePrevious = () => {
        if (step > 0) {
            setStep(step - 1);
        }
    };

    const handleSkip = () => {
        localStorage.setItem(ONBOARDING_KEY, 'true');
        setVisible(false);
        setTimeout(onComplete, 300);
    };

    if (!visible) return null;

    const currentStep = STEPS[step];

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in duration-500">
            <div className="max-w-md w-full mx-4">
                {/* 进度指示器 */}
                <div className="flex gap-2 mb-8 justify-center">
                    {STEPS.map((_, idx) => (
                        <div
                            key={idx}
                            className={`h-1.5 rounded-full transition-all ${idx === step ? 'w-8 bg-[#D4AF37]' : idx < step ? 'w-4 bg-[#D4AF37]/50' : 'w-4 bg-white/20'}`}
                        />
                    ))}
                </div>

                {/* 内容卡片 */}
                <div className="bg-[#0a0a0a] rounded-[2rem] border border-white/10 p-10 text-center">
                    <h2 className="text-2xl font-black mb-4">{currentStep.title}</h2>
                    <p className="text-zinc-400 text-sm leading-relaxed mb-8">{currentStep.description}</p>

                    <div className="flex gap-4 justify-center">
                        {step > 0 && (
                            <button
                                onClick={handlePrevious}
                                className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-400 hover:text-white rounded-xl text-sm font-bold transition-all"
                            >
                                上一步
                            </button>
                        )}
                        <button
                            onClick={handleSkip}
                            className="px-6 py-3 text-zinc-500 hover:text-white text-sm font-bold transition-colors"
                        >
                            跳过引导
                        </button>
                        <button
                            onClick={handleNext}
                            className="px-8 py-3 bg-[#D4AF37] text-black rounded-xl text-sm font-black transition-all hover:scale-105"
                        >
                            {step < STEPS.length - 1 ? '下一步' : '开始使用'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const useOnboarding = () => {
    const [showOnboarding, setShowOnboarding] = useState(false);

    useEffect(() => {
        const completed = localStorage.getItem(ONBOARDING_KEY);
        if (!completed) {
            setShowOnboarding(true);
        }
    }, []);

    const resetOnboarding = () => {
        localStorage.removeItem(ONBOARDING_KEY);
        setShowOnboarding(true);
    };

    return { showOnboarding, setShowOnboarding, resetOnboarding };
};

export default Onboarding;
