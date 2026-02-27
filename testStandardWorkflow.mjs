async function testStandard() {
    const RUNNINGHUB_API_KEY = "ab6b4d8b5a0e44e9ba7444885a4492dc";

    // Original scene workflow
    const WORKFLOW_ID = "2026161270482804737";
    const URL = `https://www.runninghub.ai/openapi/v2/run/ai-app/${WORKFLOW_ID}`;

    try {
        const resp = await fetch(URL, {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${RUNNINGHUB_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                nodeInfoList: [
                    { nodeId: "2", fieldName: "prompt", fieldValue: "a beautiful landscape" },
                    { nodeId: "2", fieldName: "aspectRatio", fieldValue: "16:9" },
                    { nodeId: "2", fieldName: "resolution", fieldValue: "1k" }
                ],
                instanceType: "default",
                usePersonalQueue: "false",
                addMetadata: true
            })
        });

        const text = await resp.text();
        console.log("Response:", text);
    } catch (e) {
        console.error("Error", e);
    }
}
testStandard();
