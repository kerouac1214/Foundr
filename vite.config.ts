import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3001,
      host: '0.0.0.0',
      headers: {
        // 'Cross-Origin-Embedder-Policy': 'require-corp',
        // 'Cross-Origin-Opener-Policy': 'same-origin',
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
        },
        '/moonshot': {
          target: 'https://api.moonshot.cn',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/moonshot/, '')
        },
        '/glm': {
          target: 'https://maas-api.ai-yuanjing.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/glm/, '')
        }
      }
    },
    plugins: [
      react(),
      electron([
        {
          // Main-Process entry file of the Electron App.
          entry: 'electron/main.ts',
        },
      ]),
      renderer(),
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.RUNNINGHUB_API_KEY': JSON.stringify(env.RUNNINGHUB_API_KEY),
      'process.env.KIMI_API_KEY': JSON.stringify(env.KIMI_API_KEY),
      'process.env.GLM_API_KEY': JSON.stringify(env.GLM_API_KEY),
      'process.env.GEMINI_BASE_URL': JSON.stringify(env.GEMINI_BASE_URL || ''),
      'process.env.VITE_API_BASE_URL': JSON.stringify(env.VITE_API_BASE_URL || ''),
      'process.env.LAF_APP_ID': JSON.stringify(env.LAF_APP_ID || '')
    },
    build: {
      sourcemap: false, // Prevents source code from being viewable in browser dev tools
      minify: 'esbuild', // Faster and default minification
      cssMinify: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor': ['react', 'react-dom', 'zustand', 'dexie'],
            'ai-providers': [
              './services/providers/geminiProvider.ts',
              './services/providers/kimiProvider.ts',
              './services/providers/glm5Provider.ts'
            ]
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
