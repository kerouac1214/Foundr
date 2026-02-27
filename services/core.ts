import { GoogleGenAI } from "@google/genai";

// Helper to determine the correct base URL
const getBaseUrl = () => {
    if (typeof window !== 'undefined' && !process.env.VITE_API_BASE_URL) {
        return `${window.location.origin}/google`;
    }
    return `${process.env.VITE_API_BASE_URL || ''}/google`;
};

export const getAIClient = (apiBase?: string) => {
    return new GoogleGenAI({
        apiKey: process.env.API_KEY,
        httpOptions: {
            baseUrl: apiBase || getBaseUrl(),
        }
    });
};

/**
 * 带重试机制的异步函数包装器
 * 自动处理临时性错误（429限流、500服务器错误、网络超时等）
 */
export async function withRetry<T>(fn: () => Promise<T>, retries: number = 3, delay: number = 2000): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        if (retries <= 0) throw error;
        const errorMsg = error?.message?.toLowerCase() || "";

        const isRetryable =
            errorMsg.includes("429") ||
            errorMsg.includes("500") ||
            errorMsg.includes("503") ||
            errorMsg.includes("unavailable") ||
            errorMsg.includes("overloaded") ||
            errorMsg.includes("quota") ||
            errorMsg.includes("fetch") ||
            errorMsg.includes("deadline");

        if (!isRetryable) throw error;

        console.warn(`API 调用失败，${delay / 1000}秒后重试... (剩余重试次数: ${retries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return withRetry(fn, retries - 1, delay * 2);
    }
}

/**
 * 鲁棒的 JSON 解析器
 * 自动提取 Markdown 代码块，尝试修复常见错误（如截断、未转义引号）
 */
export function parseJSONRobust(text: string, fallback: any = {}): any {
    if (!text) return fallback;

    let cleanText = text.trim();

    // 1. Remove Markdown code block ticks if present
    // Just blindly strip ```json and trailing ``` to avoid destroying truncated inner content
    cleanText = cleanText.replace(/^```(?:json)?/, '').trim();
    if (cleanText.endsWith('```')) {
        cleanText = cleanText.substring(0, cleanText.length - 3).trim();
    }

    // If there is still leading garbage before the first brace, strip it
    const firstBrace = cleanText.indexOf('{');
    const firstBracket = cleanText.indexOf('[');
    const firstChar = firstBrace >= 0 && firstBracket >= 0
        ? Math.min(firstBrace, firstBracket)
        : Math.max(firstBrace, firstBracket);

    if (firstChar > 0) {
        cleanText = cleanText.substring(firstChar);
    }
    try {
        return JSON.parse(cleanText);
    } catch (e: any) {
        console.warn("标准 JSON 解析失败，尝试修复并重新解析...", e.message);

        try {
            let repairedText = cleanText;

            // 1. Close unescaped/unterminated strings
            const quoteCount = (repairedText.match(/(?<!\\)"/g) || []).length;
            if (quoteCount % 2 !== 0) {
                repairedText += '"';
            }

            // 2. Fix unescaped internal quotes
            repairedText = repairedText.replace(/(?!^|[{}[\]:,]\s*)"(.*?)"(?=\s*[,}\]])/g, (match, inner) => {
                if (inner.includes('"')) {
                    return `"${inner.replace(/"/g, '”')}"`;
                }
                return match;
            });

            // 3. Remove hanging colons or commas
            repairedText = repairedText.replace(/[,:]\s*$/g, '');

            // 4. Force close structures (simple heuristic for common AI outputs)
            let openBraces = (repairedText.match(/\{/g) || []).length;
            let closeBraces = (repairedText.match(/\}/g) || []).length;
            let openBrackets = (repairedText.match(/\[/g) || []).length;
            let closeBrackets = (repairedText.match(/\]/g) || []).length; // Corrected: should use repairedText

            try {
                let testText = repairedText;
                if (openBraces > closeBraces && testText.lastIndexOf('{') > testText.lastIndexOf('[')) {
                    testText += '}';
                    closeBraces++;
                }
                while (openBrackets > closeBrackets) { testText += ']'; closeBrackets++; }
                while (openBraces > closeBraces) { testText += '}'; closeBraces++; }

                return JSON.parse(testText.replace(/,\s*([}\]])/g, '$1'));
            } catch (e) {
                // 3. To handle brutal truncations, let's just iteratively crop the string from the end
                // until we find a comma, bracket or brace, then close all structures.

                // PASS 1: Simple bracket-counting extraction to rescue valid objects
                const salvagedScript: any[] = [];
                const shotRegex = /\{\s*"shot_type"/g;
                let match;

                while ((match = shotRegex.exec(cleanText)) !== null) {
                    let startIndex = match.index;
                    let openCount = 0;
                    let endIndex = -1;
                    let inString = false;
                    let escapeNext = false;

                    for (let i = startIndex; i < cleanText.length; i++) {
                        const char = cleanText[i];
                        if (escapeNext) { escapeNext = false; continue; }
                        if (char === '\\') { escapeNext = true; continue; }
                        if (char === '"') { inString = !inString; continue; }

                        if (!inString) {
                            if (char === '{') openCount++;
                            else if (char === '}') {
                                openCount--;
                                if (openCount === 0) {
                                    endIndex = i;
                                    break;
                                }
                            }
                        }
                    }

                    if (endIndex !== -1) {
                        try {
                            // We found a fully balanced object!
                            const objText = cleanText.substring(startIndex, endIndex + 1);
                            salvagedScript.push(JSON.parse(objText));
                        } catch (e) { }
                        // No need to manually update index, regex loop does it
                    } else {
                        // The rest of the string is truncated mid-object.
                        // Try to aggressively close it just to save it.
                        try {
                            let partialText = cleanText.substring(startIndex);
                            // If it ends in an open quote, close it.
                            const quoteCount = (partialText.match(/(?<!\\)"/g) || []).length;
                            if (quoteCount % 2 !== 0) partialText += '"';

                            // Strip hanging keys/commas
                            const lastComma = partialText.lastIndexOf(',');
                            if (lastComma > 0) partialText = partialText.substring(0, lastComma);

                            // Close the object
                            for (let i = 0; i < openCount; i++) partialText += '}';

                            salvagedScript.push(JSON.parse(partialText));
                        } catch (e) {
                        }
                        break; // Done, nothing left to scan
                    }
                }

                // PASS 2: Truncate to save the root object (like metadata)
                let attempts = 0;
                let currentText = repairedText;

                while (attempts < 500 && currentText.length > 10) {
                    try {
                        let testText = currentText;

                        let openBraces = (testText.match(/\{/g) || []).length;
                        let closeBraces = (testText.match(/\}/g) || []).length;
                        let openBrackets = (testText.match(/\[/g) || []).length;
                        let closeBrackets = (testText.match(/\]/g) || []).length;

                        if (openBrackets > closeBrackets) {
                            if (openBraces > closeBraces) testText += '}';
                            for (let i = 0; i < (openBrackets - closeBrackets); i++) testText += ']';
                            for (let i = 0; i < (openBraces - closeBraces - 1); i++) testText += '}';
                        } else {
                            for (let i = 0; i < (openBraces - closeBraces); i++) testText += '}';
                        }

                        testText = testText.replace(/,\s*([}\]])/g, '$1');
                        const parsedRoot = JSON.parse(testText);

                        // Merge rescued script into the root object
                        if (salvagedScript.length > 0) {
                            parsedRoot.initial_script = salvagedScript;
                        }

                        return parsedRoot;
                    } catch (e) {
                        currentText = currentText.substring(0, currentText.length - 1);
                        attempts++;
                    }
                }

                // If all root parsing fails, at least return the rescued script wrapped in fallback
                if (salvagedScript.length > 0) {
                    return { ...fallback, initial_script: salvagedScript };
                }

                throw new Error("Repair exhausted");
            } // close inner catch (e)
        } catch (repairError) {
            console.error("JSON 修复失败，返回 Fallback 数据:", cleanText.substring(0, 100) + "...");
            return fallback;
        }
    }
}
