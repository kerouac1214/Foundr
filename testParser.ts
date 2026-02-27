import { parseJSONRobust } from './services/core.ts';

const kimiOutput = `\`\`\`json
{
  "metadata": {
    "bpm": 120,
    "energy_level": "Medium"
  },
  "initial_script": [
    {
      "shot_type": "LS",
      "action_description": "陈霄独自走在`;

console.log("Parsing Truncated Output...");
const result = parseJSONRobust(kimiOutput, { metadata: {}, initial_script: [] });
console.log("Initial Script Length:", result.initial_script?.length);
console.log(JSON.stringify(result, null, 2));
