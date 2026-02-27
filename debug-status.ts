
const API_KEY = "ab6b4d8b5a0e44e9ba7444885a4492dc";
const TASK_ID = "2021468724149755906"; // Known failed task

async function checkEndpoints() {
    console.log(`Checking endpoints for Task ID: ${TASK_ID}`);

    const methods = [
        { url: "https://www.runninghub.cn/task/openapi/outputs", name: "outputs", method: "POST" },
        { url: "https://www.runninghub.cn/task/openapi/detail", name: "detail", method: "POST" },
        { url: `https://www.runninghub.cn/openapi/v2/tasks/${TASK_ID}`, name: "v2-task-get", method: "GET" }
    ];

    for (const m of methods) {
        try {
            console.log(`\nTesting ${m.name}...`);
            const opts = {
                method: m.method,
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
            };
            if (m.method === 'POST') {
                opts.body = JSON.stringify({ taskId: TASK_ID, apiKey: API_KEY });
            }

            const r = await fetch(m.url, opts);
            const text = await r.text();
            console.log(`${m.name} Status: ${r.status}`);
            console.log(`${m.name} Body: ${text.substring(0, 500)}`);
        } catch (e) {
            console.log(`${m.name} failed:`, e.message);
        }
    }
}

checkEndpoints();
