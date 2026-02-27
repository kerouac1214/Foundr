import fs from 'fs';

async function checkWorkflow() {
    const RUNNINGHUB_API_KEY = "ab6b4d8b5a0e44e9ba7444885a4492dc";
    const WORKFLOW_ID = "2026205650287599618";
    const URL = `https://www.runninghub.ai/openapi/v2/run/ai-app/${WORKFLOW_ID}`;

    const testPayload = JSON.stringify({
        "Identity_Consistency_Protocol": {
            "Gender": "Female",
            "Age": "20",
            "Appearance": {
                "Face": "Asian face, clean",
                "Hair": "Black long hair",
                "Body": "Slim",
                "Clothing": "White t-shirt"
            }
        }
    });

    for (const fieldName of ["value", "text", "string", "prompt"]) {
        try {
            console.log(`\nTesting fieldName: ${fieldName}`);
            const resp = await fetch(URL, {
                method: 'POST',
                headers: {
                    "Authorization": `Bearer ${RUNNINGHUB_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    nodeInfoList: [{ nodeId: "59", fieldName: fieldName, fieldValue: testPayload }]
                })
            });

            console.log("Status:", resp.status);
            const data = await resp.json();
            console.log("promptTips:", data.promptTips);
        } catch (e) {
            console.error("Error", e);
        }
    }
}
checkWorkflow();
