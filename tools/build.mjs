import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');
const files = [
  'index.html', 'guide.html', 'beginner-guide.html', 'settings-guide.html',
  'effects-guide.html', 'about.html', 'contact.html', 'privacy-policy.html',
  'terms.html', '404.html', 'style.css', 'app.js', 'premium-fx.js',
  'ad-config.js', 'ad-service.js', 'ad-system.js', 'ads.txt',
  'robots.txt', 'sitemap.xml'
];
await mkdir(output, { recursive: true });
// Refuse stale output instead of silently publishing files outside the allowlist.
const unexpected = (await readdir(output)).filter(name => !files.includes(name));
if (unexpected.length) throw new Error('Unexpected files in dist: ' + unexpected.join(', '));
for (const name of files) await copyFile(resolve(root, name), resolve(output, name));
console.log('Built ' + files.length + ' public files in dist.');
