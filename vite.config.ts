import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'download-attachment-middleware',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const cleanUrl = req.url ? req.url.split('?')[0] : '';
            if (cleanUrl === '/download' || cleanUrl === '/download/DB2K-002.html') {
              const filePath = path.resolve(import.meta.dirname, 'public/DB2K-002.html');
              if (fs.existsSync(filePath)) {
                const stat = fs.statSync(filePath);
                res.writeHead(200, {
                  'Content-Type': 'application/octet-stream',
                  'Content-Disposition': 'attachment; filename="DB2K-002.html"',
                  'Content-Length': stat.size,
                });
                fs.createReadStream(filePath).pipe(res);
                return;
              }
            }
            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
