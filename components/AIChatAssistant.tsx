import React, { useState, useRef, useEffect } from 'react';
import { useChatStore, ChatMessage } from '../store/useChatStore';
import { getScriptProvider } from '../services/providers';
import { useProjectStore } from '../store/useProjectStore';

const AIChatAssistant: React.FC = () => {
    const { messages, isChatOpen, isTyping, toggleChat, addMessage, setTyping } = useChatStore();
    const globalContext = useProjectStore(s => s.globalContext);
    const [input, setInput] = useState('');
    const [attachedImage, setAttachedImage] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    const handleSend = async () => {
        if (!input.trim() && !attachedImage) return;

        const currentInput = input.trim();
        const currentImage = attachedImage;
        const currentMessages = [...messages];

        const userContent: any[] = [];
        if (currentInput) userContent.push({ type: 'text', text: currentInput });
        if (currentImage) {
            userContent.push({
                type: 'image_url',
                image_url: { url: currentImage }
            });
        }

        const userMsg: Omit<ChatMessage, 'timestamp'> = {
            role: 'user',
            content: userContent
        };

        addMessage(userMsg);
        setInput('');
        setAttachedImage(null);
        setTyping(true);

        try {
            const engine = 'kimi';
            const provider = getScriptProvider(engine);

            // Sync config
            const engineConfigs = globalContext.engine_configs || {};
            if (engineConfigs[engine]) {
                provider.updateConfig(engineConfigs[engine]);
            }

            const fullMessages = [
                {
                    role: 'system',
                    content: `你是一位全能的 AI 影视制作专家与顶级提示词工程师。
你的专长：
1. 视觉提示词 (Image Prompts)：精通 Midjourney, Stable Diffusion 等工具，能将文字描述转化为极具电影感的视觉提示（包含景别、角度、光影、相机参数）。
2. 视频提示词 (Video Prompts)：精通 Kling, Luma 等视频模型，擅长描述镜头运动和物理模拟。
3. 故事架构：擅长分镜拆解、叙事节奏控制。
4. 多模态分析：能通过用户上传的图片，精准分析其视觉元素、影调风格，并以此推演后续分镜。

请以专业、干练、富有创意的语气回答。`
                },
                ...currentMessages.map(m => ({ role: m.role, content: m.content })),
                { role: 'user', content: userContent }
            ];

            const response = await provider.chat(fullMessages);
            addMessage({ role: 'assistant', content: response });
        } catch (error: any) {
            console.error('Chat Assistant Error:', error);
            const errorMsg = error.message?.includes('API Key')
                ? `配置错误：AI 助手当前使用的引擎 (Kimi) 尚未设置有效 API Key。请在设置中检查配置。`
                : '抱歉，我现在遇到了一点技术问题，请稍后再试。';
            addMessage({ role: 'assistant', content: errorMsg });
        } finally {
            setTyping(false);
        }
    };

    const compressImage = (dataUrl: string): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const max = 1024;
                if (width > max || height > max) {
                    if (width > height) {
                        height = (height / width) * max;
                        width = max;
                    } else {
                        width = (width / height) * max;
                        height = max;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.src = dataUrl;
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const compressed = await compressImage(reader.result as string);
                setAttachedImage(compressed);
            };
            reader.readAsDataURL(file);
        }
    };

    if (!isChatOpen) {
        return (
            <button
                onClick={toggleChat}
                title="打开 AI 助手"
                className="fixed bottom-8 right-8 w-16 h-16 bg-[#D4AF37] text-black rounded-full shadow-[0_0_30px_rgba(212,175,55,0.4)] flex items-center justify-center hover:scale-110 transition-all z-50 group"
            >
                <svg className="w-8 h-8 group-hover:rotate-12 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-[#050505] animate-pulse" />
            </button>
        );
    }

    return (
        <div className="fixed bottom-8 right-8 w-[400px] h-[600px] bg-[#0A0A0A] rounded-[2rem] border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.6)] flex flex-col z-50 animate-in slide-in-from-bottom-10 fade-in duration-500 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-white/5 bg-gradient-to-r from-[#D4AF37]/10 to-transparent flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#D4AF37] flex items-center justify-center text-black">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-white">Foundr AI 助手</h4>
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            <span className="text-[10px] text-zinc-500 uppercase tracking-widest">
                                {globalContext.script_engine?.toUpperCase() || 'AI'} ACTIVE
                            </span>
                        </div>
                    </div>
                </div>
                <button onClick={toggleChat} title="关闭" className="text-zinc-500 hover:text-white transition-colors">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-white/5">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] p-4 rounded-2xl text-[13px] leading-relaxed ${msg.role === 'user'
                            ? 'bg-[#D4AF37] text-black font-medium'
                            : 'bg-white/5 text-zinc-300 border border-white/5'
                            }`}>
                            {Array.isArray(msg.content) ? (
                                <div className="space-y-3">
                                    {msg.content.map((item: any, idx: number) => (
                                        item.type === 'text' ? (
                                            <p key={idx}>{item.text}</p>
                                        ) : item.type === 'image_url' ? (
                                            <img key={idx} src={item.image_url.url} alt="Uploaded" className="max-w-full rounded-lg border border-black/10 shadow-sm" />
                                        ) : null
                                    ))}
                                </div>
                            ) : (
                                msg.content
                            )}
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex justify-start">
                        <div className="bg-white/5 p-4 rounded-2xl flex gap-1">
                            <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce" />
                            <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce delay-75" />
                            <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce delay-150" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 border-t border-white/5 bg-[#050505]">
                {attachedImage && (
                    <div className="mb-4 relative w-20 h-20 rounded-lg overflow-hidden border border-[#D4AF37]/50 shadow-lg group">
                        <img src={attachedImage} className="w-full h-full object-cover" alt="upload preview" />
                        <button
                            onClick={() => setAttachedImage(null)}
                            title="移除附件"
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                )}
                <div className="flex items-end gap-3">
                    <div className="flex-1 relative">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="描述您的创意或提问..."
                            title="聊天输入"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 pr-12 text-[13px] text-white placeholder-zinc-700 outline-none focus:border-[#D4AF37]/30 transition-all resize-none h-[80px]"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            title="添加附件"
                            className="absolute right-4 bottom-4 text-zinc-600 hover:text-[#D4AF37] transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            title="图片附件"
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                    </div>
                    <button
                        onClick={handleSend}
                        title="发送"
                        disabled={isTyping || (!input.trim() && !attachedImage)}
                        className="w-12 h-12 rounded-2xl bg-[#D4AF37] text-black flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIChatAssistant;
