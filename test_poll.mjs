import fs from 'fs';

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function runAndPoll(bodyModifier) {
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

    const body = {
        nodeInfoList: [{ nodeId: "59", fieldName: "value", fieldValue: testPayload }],
        ...bodyModifier
    };

    console.log(`\n--- Starting test with body: ${JSON.stringify(body)} ---`);
    const resp = await fetch(URL, {
        method: 'POST',
        headers: {
            "Authorization": `Bearer ${RUNNINGHUB_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    const data = await resp.json();
    console.log("Submit Response:", Object.keys(data), data.errorMessage || data.promptTips);

    if (!data.taskId) {
        console.log("No taskId, aborting poll.");
        return;
    }

    const QUERY_URL = `https://www.runninghub.ai/openapi/v2/query`;
    for (let i = 0; i < 15; i++) {
        await sleep(4000);
        const qResp = await fetch(QUERY_URL, {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${RUNNINGHUB_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ taskId: data.taskId })
        });
        const qData = await qResp.json();
        console.log(`[Poll ${i}] Status: ${qData.status}`);
        if (qData.status === "FAILED") {
            console.log("Error Message:", qData.errorMessage);
            break;
        }
        if (qData.status === "SUCCESS") {
            console.log("Success! Results:", JSON.stringify(qData.results));
            break;
        }
    }
}

async function main() {
    // Test outputs array
    await runAndPoll({ outputs: ["127"] });
    // Test outputNodeId string
    await runAndPoll({ outputNodeId: "127" });
    // Test outputNodeId array
    await runAndPoll({ outputNodeId: ["127"] });
}
main();
