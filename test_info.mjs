import fs from 'fs';

async function checkWorkflowInfo() {
    const RUNNINGHUB_API_KEY = "ab6b4d8b5a0e44e9ba7444885a4492dc";
    const WORKFLOW_ID = "2026205650287599618";

    const endpoints = [
        `https://www.runninghub.ai/openapi/v2/app/info/${WORKFLOW_ID}`,
        `https://www.runninghub.ai/openapi/v1/app/${WORKFLOW_ID}`,
        `https://www.runninghub.ai/openapi/v1/workflow/${WORKFLOW_ID}`
    ];

    for (const URL of endpoints) {
        try {
            console.log(`\nTesting endpoint: ${URL}`);
            const resp = await fetch(URL, {
                method: 'GET',
                headers: {
                    "Authorization": `Bearer ${RUNNINGHUB_API_KEY}`,
                    "Content-Type": "application/json"
                }
            });

            console.log("Status:", resp.status);
            if (resp.status === 200) {
                const data = await resp.json();
                console.log("Response:", JSON.stringify(data).substring(0, 1000));
            }
        } catch (e) {
            console.error("Error", e);
        }
    }
}
checkWorkflowInfo();
