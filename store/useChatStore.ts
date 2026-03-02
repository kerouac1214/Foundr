import { create } from 'zustand';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string | any[];
    timestamp: number;
}

interface ChatState {
    messages: ChatMessage[];
    isChatOpen: boolean;
    isTyping: boolean;

    // Actions
    toggleChat: () => void;
    addMessage: (message: Omit<ChatMessage, 'timestamp'>) => void;
    setTyping: (isTyping: boolean) => void;
    clearHistory: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
    messages: [
        {
            role: 'assistant',
            content: '你好！我是您的 AI 创作助手。我可以帮您构思剧情、编写分镜提示词，甚至直接分析您上传的参考图。有什么可以帮您的吗？',
            timestamp: Date.now()
        }
    ],
    isChatOpen: false,
    isTyping: false,

    toggleChat: () => set((state) => ({ isChatOpen: !state.isChatOpen })),

    addMessage: (message) => set((state) => ({
        messages: [...state.messages, { ...message, timestamp: Date.now() }]
    })),

    setTyping: (isTyping) => set({ isTyping }),

    clearHistory: () => set({
        messages: [
            {
                role: 'assistant',
                content: '对话记录已清空。有什么新想法吗？',
                timestamp: Date.now()
            }
        ]
    })
}));
