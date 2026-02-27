import JSZip from 'jszip';
import { GlobalContext, StoryboardItem, ProjectMetadata } from '../types';

/**
 * 助手函数：将 URL (或 DataURL) 转换为 Blob
 */
async function fetchToBlob(url: string): Promise<Blob> {
    if (url.startsWith('data:')) {
        const resp = await fetch(url);
        return await resp.blob();
    }
    // 处理外部 URL (确保服务器支持跨域或通过代理)
    const response = await fetch(url);
    if (!response.ok) throw new Error(`无法获取资产: ${url}`);
    return await response.blob();
}

/**
 * 导出完整项目到 ZIP
 */
export async function exportProjectToZip(
    projectName: string,
    script: string,
    globalContext: GlobalContext,
    storyboard: StoryboardItem[],
    projectMetadata: ProjectMetadata | null,
    onProgress?: (message: string) => void
) {
    const zip = new JSZip();
    const assetsFolder = zip.folder("assets")!;
    const assetMap: Record<string, string> = {}; // 原始 URL -> 本地路径映射

    // 1. 收集所有需要打包的资产
    const assetsToDownload: { url: string; path: string; id: string }[] = [];

    // 角色预览图
    globalContext.characters.forEach((char, i) => {
        if (char.preview_url) {
            const ext = char.preview_url.split(';')[0]?.split('/')[1] || 'png';
            const filename = `char_${char.char_id}.${ext}`;
            assetsToDownload.push({ url: char.preview_url, path: `assets/${filename}`, id: `char_${char.char_id}` });
        }
    });

    // 场景预览图
    globalContext.scenes.forEach((scene, i) => {
        if (scene.preview_url) {
            const ext = scene.preview_url.split(';')[0]?.split('/')[1] || 'png';
            const filename = `scene_${scene.scene_id}.${ext}`;
            assetsToDownload.push({ url: scene.preview_url, path: `assets/${filename}`, id: `scene_${scene.scene_id}` });
        }
    });

    // 分镜图与视频
    storyboard.forEach((item, i) => {
        if (item.preview_url) {
            const ext = item.preview_url.split(';')[0]?.split('/')[1] || 'png';
            const filename = `shot_${item.id}_img.${ext}`;
            assetsToDownload.push({ url: item.preview_url, path: `assets/${filename}`, id: `shot_${item.id}_img` });
        }
        if (item.video_url) {
            const filename = `shot_${item.id}_vid.mp4`;
            assetsToDownload.push({ url: item.video_url, path: `assets/${filename}`, id: `shot_${item.id}_vid` });
        }
    });

    // 2. 执行下载并添加到 ZIP
    for (let i = 0; i < assetsToDownload.length; i++) {
        const asset = assetsToDownload[i];
        if (onProgress) onProgress(`正在打包素材 (${i + 1}/${assetsToDownload.length}): ${asset.path}`);

        try {
            const blob = await fetchToBlob(asset.url);
            assetsFolder.file(asset.path.replace('assets/', ''), blob);
            assetMap[asset.url] = asset.path;
        } catch (e) {
            console.warn(`跳过损坏资产: ${asset.url}`, e);
        }
    }

    // 3. 生成项目清单 (Manifest)
    // 我们需要克隆一份数据，将里面的 URL 替换为本地相对路径
    const exportState = {
        version: "1.0",
        projectName,
        script,
        projectMetadata,
        globalContext: JSON.parse(JSON.stringify(globalContext)),
        storyboard: JSON.parse(JSON.stringify(storyboard)),
        exportDate: new Date().toISOString()
    };

    // 替换角色 URL
    exportState.globalContext.characters.forEach((c: any) => {
        if (c.preview_url && assetMap[c.preview_url]) c.preview_url = assetMap[c.preview_url];
    });

    // 替换场景 URL
    exportState.globalContext.scenes.forEach((s: any) => {
        if (s.preview_url && assetMap[s.preview_url]) s.preview_url = assetMap[s.preview_url];
    });

    // 替换分镜 URL
    exportState.storyboard.forEach((item: any) => {
        if (item.preview_url && assetMap[item.preview_url]) item.preview_url = assetMap[item.preview_url];
        if (item.video_url && assetMap[item.video_url]) item.video_url = assetMap[item.video_url];
    });

    zip.file("project.foundr.json", JSON.stringify(exportState, null, 2));

    // 4. 生成并触发下载
    if (onProgress) onProgress("正在生成压缩包...");
    const content = await zip.generateAsync({ type: "blob" });

    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `${projectName || 'Project'}_${new Date().getTime()}.foundr.zip`;
    link.click();

    if (onProgress) onProgress("项目已导出");
}

/**
 * 从 ZIP 文件导入项目
 */
export async function importProjectFromZip(
    zipFile: File,
    onProgress?: (message: string) => void
): Promise<any> {
    if (onProgress) onProgress("正在解析压缩包...");
    const zip = await JSZip.loadAsync(zipFile);

    const manifestFile = zip.file("project.foundr.json");
    if (!manifestFile) throw new Error("无效的项目包：找不到 project.foundr.json");

    const manifestJson = await manifestFile.async("string");
    const state = JSON.parse(manifestJson);

    if (onProgress) onProgress("正在还原素材...");

    // 还原 URL 映射
    const restoreUrl = async (path: string) => {
        if (!path.startsWith('assets/')) return path;
        const file = zip.file(path.replace('assets/', ''));
        if (!file) return path;
        const blob = await file.async("blob");
        return URL.createObjectURL(blob);
    };

    // 还原角色
    for (const c of state.globalContext.characters) {
        if (c.preview_url) c.preview_url = await restoreUrl(c.preview_url);
    }

    // 还原场景
    for (const s of state.globalContext.scenes) {
        if (s.preview_url) s.preview_url = await restoreUrl(s.preview_url);
    }

    // 还原分镜
    for (const item of state.storyboard) {
        if (item.preview_url) item.preview_url = await restoreUrl(item.preview_url);
        if (item.video_url) item.video_url = await restoreUrl(item.video_url);
    }

    if (onProgress) onProgress("项目还原完成");
    return state;
}
