const fetch = require('node-fetch');
const RUNNINGHUB_API_KEY = process.env.RUNNINGHUB_API_KEY || "e1b4c7fc39ba4c0bb6d3a87071f00af8"; // fallback if needed

async function checkWorkflow() {
    const WORKFLOW_ID = "2026205650287599618";
    const URL = `https://www.runninghub.ai/openapi/v2/run/workflow/${WORKFLOW_ID}`;
    const fallbackURL = `https://www.runninghub.ai/openapi/v1/workflow/${WORKFLOW_ID}`;

    try {
        // Just try hitting it with a dummy payload to get an error about missing fields or bad fields
        const resp = await fetch(URL, {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${RUNNINGHUB_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                nodeInfoList: [{ nodeId: "59", fieldName: "DUMMY", fieldValue: "test" }]
            })
        });

        console.log("Run Status:", resp.status);
        const text = await resp.text();
        console.log("Run Output:", text);

    } catch (e) {
        console.error("Error", e);
    }
}
checkWorkflow();
