import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 5173,
        host: '0.0.0.0',
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            }
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.HF_TOKEN': JSON.stringify(env.HF_TOKEN),
        'process.env.STABLE_DIFFUSION_KEY': JSON.stringify(env.STABLE_DIFFUSION_KEY),
        'process.env.REPLICATE_TOKEN': JSON.stringify(env.REPLICATE_TOKEN),
        
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
