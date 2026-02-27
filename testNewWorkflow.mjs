async function checkWorkflow() {
    const RUNNINGHUB_API_KEY = "ab6b4d8b5a0e44e9ba7444885a4492dc";
    const WORKFLOW_ID = "2026270585814261762";

    // Test original workflow ID
    const endpoints = [
        `https://www.runninghub.ai/openapi/v2/run/workflow/${WORKFLOW_ID}`,
        `https://www.runninghub.ai/openapi/v2/run/ai-app/${WORKFLOW_ID}`
    ];

    for (const URL of endpoints) {
        try {
            console.log(`\nTesting endpoint: ${URL}`);
            const resp = await fetch(URL, {
                method: 'POST',
                headers: {
                    "Authorization": `Bearer ${RUNNINGHUB_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    nodeInfoList: [{ nodeId: "59", fieldName: "value", fieldValue: "test info" }],
                    instanceType: "default",
                    usePersonalQueue: "false",
                    addMetadata: true
                })
            });

            console.log("Run Status:", resp.status);
            const text = await resp.text();
            console.log("Run Output:", text);
        } catch (e) {
            console.error("Error", e);
        }
    }
}
checkWorkflow();
