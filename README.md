<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1xc8b3nG9-tWi-h9MK1e3OBCnqnZxBSbN

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Copy `.env.local.example` to `.env.local` and configure:
   ```bash
   cp .env.local.example .env.local
   ```
3. Set API keys in `.env.local`:
   - `GEMINI_API_KEY` - Your Gemini API key (required)
   - `RUNNINGHUB_API_KEY` - Your RunningHub API key (optional, for video generation)
4. Run the app:
   `npm run dev`
