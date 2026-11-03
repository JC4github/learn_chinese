import { mkdirSync, copyFileSync } from 'node:fs';
mkdirSync('dist/vendor', { recursive: true });
copyFileSync('node_modules/howler/dist/howler.core.min.js', 'dist/vendor/howler.core.min.js');
copyFileSync('node_modules/howler/LICENSE.md', 'dist/vendor/HOWLER-LICENSE.txt');
