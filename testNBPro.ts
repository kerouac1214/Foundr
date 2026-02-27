import { runWorkflow, pollTask } from "./services/runningHubService";
import fs from 'fs';
import path from 'path';

const parseEnv = () => {
    try {
        const envContent = fs.readFileSync(path.resolve(process.cwd(), '.env.local'), 'utf-8');
        for (const line of envContent.split('\n')) {
            const [key, val] = line.split('=');
            if (key === 'RUNNINGHUB_API_KEY') return val.trim().replace(/^"|"$/g, '');
        }
    } catch (e) { }
    return null;
};

const testAPI = async () => {
    try {
        console.log("Starting NB Pro Workflow Test...");
        const apiKey = parseEnv();
        const config = { apiBase: 'https://www.runninghub.cn', apiKey };

        // We guess the prompt is node 11 and seed is node 4 based on old defaults
        const taskId = await runWorkflow("2004543847939751938", [
            { nodeId: "11", fieldName: "text", fieldValue: "1girl, solo, cinematic lighting, 4k" },
            { nodeId: "4", fieldName: "seed", fieldValue: "12345" }
        ], config);

        console.log(`Task created with ID: ${taskId}`);
        console.log("Polling for result...");

        const resultUrl = await pollTask(taskId, config);
        console.log("Final Output URL:", resultUrl);

    } catch (e) {
        console.error(e);
    }
};

testAPI();
