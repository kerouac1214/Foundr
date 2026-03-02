import { GoogleGenAI } from "@google/genai";

// ========== AI Client Management ==========
let geminiClientInstance: GoogleGenAI | null = null;

export const getAIClient = (apiBase?: string) => {
    if (!geminiClientInstance) {
        const options: any = { apiKey: process.env.GEMINI_API_KEY || '' };
        if (apiBase) options.baseUrl = apiBase;
        geminiClientInstance = new GoogleGenAI(options);
    }
    return geminiClientInstance;
};

// ========== Retry Logic ==========
const isRetryableError = (errorMsg: string) => {
    const lower = errorMsg.toLowerCase();
    return (
        lower.includes("429") ||
        lower.includes("500") ||
        lower.includes("503") ||
        lower.includes("unavailable") ||
        lower.includes("overloaded") ||
        lower.includes("quota") ||
        lower.includes("fetch") ||
        lower.includes("deadline") ||
        lower.includes("timeout")
    );
};

export const withRetry = async <T>(
    fn: () => Promise<T>,
    maxAttempts = 3,
    baseDelay = 4000
): Promise<T> => {
    let lastErr: unknown;
    for (let i = 0; i < maxAttempts; i++) {
        try {
            return await fn();
        } catch (err: any) {
            lastErr = err;
            const msg = err?.message || String(err);
            if (!isRetryableError(msg)) throw err;
            const delay = baseDelay * Math.pow(2, i);
            console.warn(`[withRetry] Attempt ${i + 1} failed: ${msg}. Retrying in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    throw lastErr;
};

/**
 * 鲁棒的 JSON 解析器
 * 自动提取 Markdown 代码块，尝试修复常见错误（如截断、未转义引号）
 */
export function parseJSONRobust(text: string, fallback: any = {}): any {
    if (!text) return fallback;

    let cleanText = text.trim();

    // 1. Remove Markdown code block ticks if present
    cleanText = cleanText.replace(/^```(?:json)?/, '').trim();
    if (cleanText.endsWith('```')) {
        cleanText = cleanText.substring(0, cleanText.length - 3).trim();
    }

    // Strip leading garbage before the first brace/bracket
    const firstBrace = cleanText.indexOf('{');
    const firstBracket = cleanText.indexOf('[');
    const firstChar = firstBrace >= 0 && firstBracket >= 0
        ? Math.min(firstBrace, firstBracket)
        : Math.max(firstBrace, firstBracket);
    if (firstChar > 0) cleanText = cleanText.substring(firstChar);

    // --- Attempt 1: Standard parse ---
    try { return JSON.parse(cleanText); } catch (e: any) {
        console.warn("标准 JSON 解析失败，尝试修复并重新解析...", e.message);
    }

    // --- Attempt 2: Truncation recovery (most common for AI token-limit truncation) ---
    // Walk the string character by character, tracking depth. Record the last position
    // at which a top-level array/object item was fully closed (depth returns to 1).
    try {
        let depth = 0;
        let inString = false;
        let escapeNext = false;
        let lastGoodClose = -1;

        for (let i = 0; i < cleanText.length; i++) {
            const ch = cleanText[i];
            if (escapeNext) { escapeNext = false; continue; }
            if (ch === '\\' && inString) { escapeNext = true; continue; }
            if (ch === '"') { inString = !inString; continue; }
            if (inString) continue;
            if (ch === '{' || ch === '[') depth++;
            else if (ch === '}' || ch === ']') {
                depth--;
                // Track any close at depth 1 or 2:
                // depth==1: top-level keys like "metadata" and "shots" array finished
                // depth==2: individual shot objects finished inside the shots array
                if (depth <= 2 && depth >= 1) lastGoodClose = i;
            }
        }

        if (lastGoodClose > 0) {
            let rescued = cleanText.substring(0, lastGoodClose + 1).replace(/,\s*$/, '');
            const ob = (rescued.match(/\{/g) || []).length;
            const cb = (rescued.match(/\}/g) || []).length;
            const oB = (rescued.match(/\[/g) || []).length;
            const cB = (rescued.match(/\]/g) || []).length;
            for (let i = 0; i < oB - cB; i++) rescued += ']';
            for (let i = 0; i < ob - cb; i++) rescued += '}';
            rescued = rescued.replace(/,\s*([}\]])/g, '$1');
            try {
                const result = JSON.parse(rescued);
                console.warn(`parseJSONRobust: Recovered truncated JSON (salvaged ${lastGoodClose} chars)`);
                return result;
            } catch (_) { }
        }
    } catch (_) { }

    // --- Attempt 3: Quote + brace close ---
    try {
        let fixed = cleanText;
        const quoteCount = (fixed.match(/(?<!\\)"/g) || []).length;
        if (quoteCount % 2 !== 0) fixed += '"';
        fixed = fixed.replace(/[,:]\s*$/g, '');
        const ob = (fixed.match(/\{/g) || []).length;
        const cb = (fixed.match(/\}/g) || []).length;
        const oB = (fixed.match(/\[/g) || []).length;
        const cB = (fixed.match(/\]/g) || []).length;
        for (let i = 0; i < oB - cB; i++) fixed += ']';
        for (let i = 0; i < ob - cb; i++) fixed += '}';
        fixed = fixed.replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(fixed);
    } catch (_) { }

    // --- Attempt 4: Shot-level salvage ---
    // Match top-level shot objects by "shot_number" key (the actual top-level field in storyboard JSON)
    try {
        const salvagedShots: any[] = [];
        const shotRegex = /\{\s*"shot_number"\s*:/g;
        let match;
        while ((match = shotRegex.exec(cleanText)) !== null) {
            let openCount = 0;
            let endIndex = -1;
            let inStr = false;
            let esc = false;
            for (let i = match.index; i < cleanText.length; i++) {
                const ch = cleanText[i];
                if (esc) { esc = false; continue; }
                if (ch === '\\' && inStr) { esc = true; continue; }
                if (ch === '"') { inStr = !inStr; continue; }
                if (inStr) continue;
                if (ch === '{') openCount++;
                else if (ch === '}') { openCount--; if (openCount === 0) { endIndex = i; break; } }
            }
            if (endIndex !== -1) {
                try { salvagedShots.push(JSON.parse(cleanText.substring(match.index, endIndex + 1))); } catch (_) { }
            }
        }
        if (salvagedShots.length > 0) {
            console.warn(`parseJSONRobust: Salvaged ${salvagedShots.length} shots from broken JSON`);
            return { ...fallback, shots: salvagedShots };
        }
    } catch (_) { }

    console.error("JSON 修复失败，返回 Fallback:", cleanText.substring(0, 100) + "...");
    return fallback;
}
