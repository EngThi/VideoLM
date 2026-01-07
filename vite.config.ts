import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');

    // Helper to gather API keys (support rotation)
    const getKeys = (prefix: string) => {
        const keys: string[] = [];
        // 1. Add the main key if it exists
        if (env[prefix]) keys.push(env[prefix]);
        // 2. Add indexed keys (e.g., GEMINI_API_KEY_2, GEMINI_API_KEY_3...)
        Object.keys(env).forEach(k => {
            if (k.startsWith(prefix + '_') && env[k]) {
                keys.push(env[k]);
            }
        });
        // 3. Handle comma-separated keys in the main variable
        if (env[prefix] && env[prefix].includes(',')) {
             return env[prefix].split(',').map((k: string) => k.trim()).filter((k: string) => k);
        }
        return keys;
    };

    return {
      server: {
        port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
        strictPort: true,
        host: '0.0.0.0',
        allowedHosts: true, // Allow all hosts for cloud preview
        hmr: {
          port: process.env.HMR_PORT ? parseInt(process.env.HMR_PORT) : undefined,
        },
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                timeout: 900000, // 15 minutes
                proxyTimeout: 900000, // 15 minutes
            },
            '/socket.io': {
                target: 'http://localhost:3001',
                ws: true,
                changeOrigin: true
            }
        }
      },
      plugins: [react()],
      define: {
        // Legacy single keys (for backward compatibility)
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.HF_TOKEN': JSON.stringify(env.HF_TOKEN),
        'process.env.STABLE_DIFFUSION_KEY': JSON.stringify(env.STABLE_DIFFUSION_KEY),
        'process.env.REPLICATE_TOKEN': JSON.stringify(env.REPLICATE_TOKEN),
        
        // Key Rotation Arrays
        'process.env.GEMINI_API_KEYS': JSON.stringify(getKeys('GEMINI_API_KEY')),
        'process.env.HF_TOKENS': JSON.stringify(getKeys('HF_TOKEN')),
        'process.env.STABLE_DIFFUSION_KEYS': JSON.stringify(getKeys('STABLE_DIFFUSION_KEY')),
        'process.env.REPLICATE_TOKENS': JSON.stringify(getKeys('REPLICATE_TOKEN')),

        // Mappings for ImageGeneratorPro compatibility
        'process.env.VITE_GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.VITE_POLLINATIONS_API_KEY': JSON.stringify(env.POLLINATIONS_API_KEY),
        'process.env.VITE_HF_TOKEN': JSON.stringify(env.HF_TOKEN),
        'process.env.VITE_STABLE_DIFFUSION_KEY': JSON.stringify(env.STABLE_DIFFUSION_KEY),
        'process.env.VITE_REPLICATE_TOKEN': JSON.stringify(env.REPLICATE_TOKEN),
        'process.env.VITE_CRAIYON_ENABLED': JSON.stringify(env.CRAIYON_ENABLED || 'true'),
        'process.env.VITE_API_URL': JSON.stringify(env.VITE_BACKEND_URL || 'http://localhost:3000'),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
