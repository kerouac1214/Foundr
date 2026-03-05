# Foundry 1.0 - AI 漫剧创作平台

Foundry 是一个专为 AI 漫剧逻辑设计的工业级分镜与叙事编排工具。

## 🏗️ 架构说明 (Architecture)

本项目是一个**纯前端 (Pure Frontend)** Web 应用，基于 **Vite + React + TailwindCSS** 构建。

- **直连模式**：应用直接在您的浏览器中运行，通过 API 直连各 AI 供应商（如 Google Gemini, Moonshot, ZhipuAI）。
- **零后端**：没有传统的后端服务器，也不存储您的剧本数据（仅存储在浏览器本地 IndexedDB 中）。
- **网络建议**：如果您在访问 Google Gemini 等海外模型时遇到“网络连接失败”，**请在右上角设置中配置 API 代理地址 (API Base URL)** 或确保您的网络环境支持直接访问。

## 🚀 快速开始 (Getting Started)

### 前置要求

- Node.js (建议 v18+)
- 源码包

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

将 `.env.local.example` 复制并重命名为 `.env.local`：

```bash
cp .env.local.example .env.local
```

在 `.env.local` 中填入您的 API 密钥：

- `GEMINI_API_KEY`: Google AI SDK 密钥 (必需)
- `GLM_API_KEY`: 智谱 AI 密钥 (可选，用于增强剧本分析)
- `KIMI_API_KEY`: 月之暗面 Kimi 密钥 (可选，建议用于 AI 聊天助手)
- `RUNNINGHUB_API_KEY`: RunningHub (绘世) 密钥 (可选，用于分镜渲染)

### 3. 运行开发服务器

```bash
npm run dev
```

打开浏览器访问 `http://localhost:5173`。

## ⚙️ 进阶配置

进入应用后，点击右上角的 **“⚙️ 设置”** 按钮：

- **API 代理**：如果无法直连 Gemini，请在“Google”引擎配置中填入代理地址（例如：`https://your-proxy.com/v1`）。
- **模型切换**：您可以根据需求为剧本分析、提取资产和聊天助手分别选择不同的 AI 模型。
