
import { runWorkflow, pollTask } from "./services/runningHubService";

const WORKFLOW_ID = "2007837815798763521";

async function main() {
    console.log("=== Character Portrait (Text-to-Image) E2E Test ===");
    console.log("Workflow:", WORKFLOW_ID);

    const prompt = "一个年轻美丽的东方女性角色，长发飘逸，穿着精致的古风服饰，面带微笑，半身像，高清细腻";
    const width = "1024";
    const height = "1024";

    const nodeInfoList = [
        { nodeId: "5", fieldName: "text", fieldValue: prompt },
        { nodeId: "7", fieldName: "width", fieldValue: width },
        { nodeId: "7", fieldName: "height", fieldValue: height }
    ];

    console.log("\n1. Submitting workflow task...");
    console.log("   Prompt:", prompt);
    console.log("   Dimensions:", width, "x", height);

    const taskId = await runWorkflow(WORKFLOW_ID, nodeInfoList);
    console.log("   Task ID:", taskId);

    console.log("\n2. Polling for result (timeout: 240s)...");
    const resultUrl = await pollTask(taskId);
    console.log("\n✅ SUCCESS! Result URL:", resultUrl);
}

main().catch(err => {
    console.error("\n❌ FAILED:", err.message);
    process.exit(1);
});
