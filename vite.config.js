import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import aurelia from '@aurelia/vite-plugin';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/src/main.ts'],
            refresh: true,
        }),
        tailwindcss(),
        aurelia({
            include: 'resources/js/src/**/*.{ts,js,html}',
        }),
    ],
    esbuild: {
        target: 'es2022',
    },
    build: {
        target: 'es2022',
    },
    server: {
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});
