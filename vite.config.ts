import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      headers: {
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
      },
      proxy: {
        '/google': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/google/, '')
        },
        '/runninghub': {
          target: 'https://www.runninghub.cn',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/runninghub/, '')
        },
        '/rh-images': {
          target: 'https://rh-images-1252422369.cos.ap-beijing.myqcloud.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/rh-images/, '')
        }
      }
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.RUNNINGHUB_API_KEY': JSON.stringify(env.RUNNINGHUB_API_KEY),
      'process.env.GEMINI_BASE_URL': JSON.stringify(env.GEMINI_BASE_URL || ''),
      'process.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL || '')
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
