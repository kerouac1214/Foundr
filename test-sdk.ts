
import { GoogleGenAI } from "@google/genai";

const API_KEY = "test-key";
const PROXY_URL = "http://localhost:3000/google"; // Local Proxy

async function main() {
    console.log("Testing SDK with baseUrl:", PROXY_URL);
    const ai = new GoogleGenAI({
        apiKey: API_KEY,
        httpOptions: {
            baseUrl: PROXY_URL,
        }
    });

    try {
        console.log("Sending request...");
        const response = await ai.models.generateContent({
            model: 'gemini-1.5-flash',
            contents: 'test',
        });
        console.log("Response received (unexpected success)");
    } catch (error: any) {
        console.log("Error caught!");
        console.log("Error message:", error.message);
        console.log("Error status:", error.status);
        console.log("Error name:", error.name);
        // If the error mentions parsing JSON from HTML (Baidu response), then baseUrl worked.
        // If the error is network timeout/fail, then it ignored baseUrl (tried google) OR Baidu rejected it weirdly.
    }
}

main();
