
const API_KEY = "ab6b4d8b5a0e44e9ba7444885a4492dc";

async function testUpload() {
    console.log("Testing Upload API...");
    const UPLOAD_URLS = [
        `https://www.runninghub.cn/proxy/${API_KEY}/upload/image`,
        `https://www.runninghub.cn/task/openapi/upload?apiKey=${API_KEY}`,
        "https://www.runninghub.cn/openapi/v2/upload",
        "https://www.runninghub.cn/uc/api/file/upload"
    ];

    // Create a small wav buffer
    const buffer = Buffer.from("UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=", "base64");

    // Node.js native fetch FormData
    const { Blob } = await import('node:buffer');

    for (const url of UPLOAD_URLS) {
        try {
            console.log(`\n---------------------------------`);
            console.log(`Trying upload to: ${url}`);
            const formData = new FormData();
            // In Node, we might need a Blob or File. 
            const blob = new Blob([buffer], { type: 'audio/wav' });
            formData.append('file', blob, `test_audio_${Date.now()}.wav`);
            formData.append('apiKey', API_KEY); // Try adding to body


            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
                    "apikey": API_KEY, // Add this
                },
                body: formData
            });

            console.log(`Status: ${resp.status}`);
            const text = await resp.text();
            console.log(`Response: ${text.substring(0, 500)}`); // Print first 500 chars

            if (resp.ok) {
                console.log(">>> SUCCESS! This URL works.");
            }
        } catch (e) {
            console.error(`Failed: ${url}`, e.message || e);
        }
    }
}

testUpload();
