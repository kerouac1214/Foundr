# 如何部署 Foundr API 中转服务 (Cloudflare Workers)

此服务用于解决两个核心问题：
1.  **RunningHub 跨域问题**：允许浏览器直接调用 RunningHub API。
2.  **Google Gemini 墙的问题**：允许国内用户免 VPN 调用 Gemini。

## 步骤 1: 注册 Cloudflare 账号
1.  打开 [Cloudflare 官网](https://dash.cloudflare.com/sign-up) 并注册（如果已有账号请登录）。
2.  在左侧菜单点击 **Workers & Pages**。
3.  点击 **Create Application** (创建应用)。
4.  点击 **Create Worker** (创建 Worker)。
5.  给它起个名字，比如 `foundr-proxy`，然后点击 **Deploy** (部署)。

## 步骤 2: 粘贴代码
1.  部署成功后，点击 **Edit code** (编辑代码)。
2.  你会看到一个代码编辑器。请删除里面现有的所有代码。
3.  打开你项目里的 `cloudflare_worker.js` 文件，复制全部内容。
4.  把代码粘贴到 Cloudflare 的编辑器里。
5.  点击右上角的 **Save and Deploy** (保存并部署)。

> [!IMPORTANT]
> **每次修改 `cloudflare_worker.js` 后，都必须重复此步骤重新部署，否则改动不会生效！**


## 步骤 3: 获取中转地址
1.  部署完成后，你会看到一个 URL，格式通常是 `https://foundr-proxy.你的用户名.workers.dev`。
2.  **复制这个地址**。这就是你的专属 API 中转地址。

## 步骤 4: 在 Foundr 中配置
1.  回到 Foundr 项目。
2.  打开 `config.ts` (或相关配置文件，稍后我们会更新)。
3.  将 API Base URL 替换为你的 Worker 地址：
    *   RunningHub 原地址: `https://www.runninghub.cn` -> `https://foundr-proxy.xxx.workers.dev/runninghub`
    *   Google 原地址: `https://generativelanguage.googleapis.com` -> `https://foundr-proxy.xxx.workers.dev/google`

## 测试
在浏览器里访问 `https://foundr-proxy.xxx.workers.dev/runninghub/task/history` (加上你的 Key 尝试)，如果返回 JSON 而不是网络错误，说明中转成功！
