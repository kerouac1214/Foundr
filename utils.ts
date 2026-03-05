export const humanizeError = (error: string): { message: string; suggestion?: string; isRateLimited?: boolean; original?: string } => {
    const lowerError = error.toLowerCase();
    if (lowerError.includes('429') || lowerError.includes('quota') || lowerError.includes('rate')) {
        return {
            message: '请求过于频繁，已触发 API 配额限制',
            suggestion: '系统将在 60 秒后自动重试，或您可以先处理其他镜头',
            isRateLimited: true,
            original: error
        };
    }
    if (lowerError.includes('503') || lowerError.includes('overloaded') || lowerError.includes('unavailable')) {
        return {
            message: 'AI 模型服务器过载',
            suggestion: '服务器当前负载过高，请稍等片刻后重试',
            isRateLimited: true,
            original: error
        };
    }
    if (lowerError.includes('api key') || lowerError.includes('apikey')) {
        return {
            message: 'API 密钥未配置或无效',
            suggestion: '请在 .env.local 文件中设置 GEMINI_API_KEY',
            original: error
        };
    }
    if (lowerError.includes('network') || lowerError.includes('fetch') || lowerError.includes('cors')) {
        return {
            message: '网络连接失败',
            suggestion: '请尝试开启代理，或在右上角设置中配置 API 代理地址 (API Base URL)',
            original: error
        };
    }
    if (lowerError.includes('timeout') || lowerError.includes('deadline')) {
        return {
            message: '请求超时',
            suggestion: '服务器响应较慢，请稍后重试',
            original: error
        };
    }
    return { message: error, original: error };
};
export const generateId = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for non-secure contexts or older browsers
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
};
