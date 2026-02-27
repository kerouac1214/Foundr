import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { StoryboardItem } from '../types';

export class VideoSynthesisService {
    private ffmpeg: FFmpeg | null = null;
    private loaded = false;

    async load() {
        if (this.loaded) return;
        this.ffmpeg = new FFmpeg();

        // Load ffmpeg.wasm with local/CDN resources
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        await this.ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        this.loaded = true;
    }

    async synthesize(storyboard: StoryboardItem[], onProgress?: (msg: string) => void): Promise<string> {
        if (!this.loaded) await this.load();
        const ffmpeg = this.ffmpeg!;

        // 1. Prepare files
        onProgress?.('正在准备素材...');
        const inputFiles: string[] = [];
        for (let i = 0; i < storyboard.length; i++) {
            const shot = storyboard[i];
            if (!shot.video_url) continue;

            const fileName = `input_${i}.mp4`;
            await ffmpeg.writeFile(fileName, await fetchFile(shot.video_url));
            inputFiles.push(fileName);
        }

        if (inputFiles.length === 0) throw new Error("没有可合成的视频镜头");

        // 2. Create concat list
        const listContent = inputFiles.map(name => `file '${name}'`).join('\n');
        await ffmpeg.writeFile('concat_list.txt', listContent);

        // 3. Run concat command
        onProgress?.('正在拼接视频 (FFmpeg)...');
        // Using concat demuxer if all videos have same encoding (Gemini/RunningHub usually output H.264)
        // If they differ, we might need a more complex filter_complex
        await ffmpeg.exec([
            '-f', 'concat',
            '-safe', '0',
            '-i', 'concat_list.txt',
            '-c', 'copy',
            'output.mp4'
        ]);

        // 4. Read output
        onProgress?.('合成完成，正在导出...');
        const data = await ffmpeg.readFile('output.mp4');
        const url = URL.createObjectURL(new Blob([(data as any).buffer], { type: 'video/mp4' }));

        // Cleanup
        for (const name of inputFiles) await ffmpeg.deleteFile(name);
        await ffmpeg.deleteFile('concat_list.txt');
        await ffmpeg.deleteFile('output.mp4');

        return url;
    }
}

export const videoSynthesisService = new VideoSynthesisService();
