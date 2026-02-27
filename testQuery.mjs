async function checkTasks() {
    const RUNNINGHUB_API_KEY = "ab6b4d8b5a0e44e9ba7444885a4492dc";
    const QUERY_URL = `https://www.runninghub.ai/openapi/v2/query`;

    const tasks = ["2027355000757424129"];

    for (const taskId of tasks) {
        try {
            const resp = await fetch(QUERY_URL, {
                method: 'POST',
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${RUNNINGHUB_API_KEY}`
                },
                body: JSON.stringify({ taskId })
            });
            const result = await resp.json();
            if(result.status === "SUCCESS") {
                console.log("Full results array:", JSON.stringify(result.results, null, 2));
            }
        } catch (e) {
            console.error("Error", e);
        }
    }
}
checkTasks();
