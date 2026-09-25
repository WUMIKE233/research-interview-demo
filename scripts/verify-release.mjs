import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const excluded = new Set(['.git', '.local', 'output', 'node_modules', '.playwright-cli', '__pycache__']);
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => excluded.has(item.name) ? [] :
    item.isDirectory() ? files(path.join(dir, item.name)) : [path.join(dir, item.name)]);
}
const entries = files(root);
const failures = [];
const required = ['index.html', '.nojekyll', 'README.md', 'PROVENANCE.md', 'THIRD_PARTY.md', 'assets/discussion.js', 'assets/topics.js', 'assets/discussion.css', 'assets/discussion-mark.svg', 'assets/fonts/noto-sans-sc.woff2', 'assets/fonts/noto-serif-sc.woff2'];
for (const file of required) if (!fs.existsSync(path.join(root, file))) failures.push(`Missing ${file}`);
for (const filename of entries.filter(x => /\.(?:html|js|mjs|css|md|json|py|txt)$/.test(x))) {
  const content = fs.readFileSync(filename, 'utf8');
  const relative = path.relative(root, filename).replaceAll('\\', '/');
  if (/\b[A-Z]:[\\/]/.test(content)) failures.push(`Workstation path in ${relative}`);
  if (/gh[pousr]_[A-Za-z0-9]{30,}|-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----/.test(content)) failures.push(`Credential-like content in ${relative}`);
  if (content.includes('\ufffd')) failures.push(`Replacement character in ${relative}`);
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:href|src)="(\.\/[^"#]+)"/g)) {
  if (!fs.existsSync(path.join(root, match[1]))) failures.push(`Broken HTML asset: ${match[1]}`);
}
if (/id="(?:nlp|vision|evidence|predict-button)"|src="\.\/assets\/app\.js"/.test(html)) failures.push('Legacy demo appears on the dialogue page');
const css = fs.readFileSync(path.join(root, 'assets/discussion.css'), 'utf8');
for (const match of css.matchAll(/url\('([^']+)'\)/g)) {
  if (!fs.existsSync(path.join(root, 'assets', match[1]))) failures.push(`Broken CSS asset: ${match[1]}`);
}
const vision = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/vision.json'), 'utf8'));
for (const sample of vision.samples) {
  for (const filename of [sample.input, ...sample.layers.flatMap(x => [x.channels, x.heatmap])]) {
    if (!fs.existsSync(path.join(root, 'assets/vision', filename))) failures.push(`Missing vision image: ${filename}`);
  }
}
const metadata = JSON.parse(fs.readFileSync(path.join(root, 'assets/model/metadata.json'), 'utf8'));
for (const part of [...metadata.delivery.compressedParts, ...metadata.delivery.rawParts]) {
  const file = path.join(root, 'assets/model', part.file);
  if (!fs.existsSync(file)) { failures.push(`Missing model part: ${part.file}`); continue; }
  const bytes = fs.readFileSync(file);
  if (bytes.length !== part.bytes || crypto.createHash('sha256').update(bytes).digest('hex') !== part.sha256) failures.push(`Invalid model part: ${part.file}`);
}
for (const [filename, expected] of [['weights.f32', metadata.weightsSha256], ['vocabulary.json', metadata.vocabularySha256]]) {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'assets/model', filename))).digest('hex');
  if (hash !== expected) failures.push(`Model hash mismatch: ${filename}`);
}
const news = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/news.json'), 'utf8'));
if (news.sampleCount !== 33708 || news.classCount !== 15 || news.classReport.length !== 15) failures.push('News summary mismatch');
if (vision.datasetMode !== 'synthetic_cifar_like' || vision.samples.length !== 4) failures.push('Vision provenance mismatch');
const sizes = entries.map(file => ({ file: path.relative(root, file).replaceAll('\\', '/'), bytes: fs.statSync(file).size }));
const result = { passed: failures.length === 0, failures, files: sizes.length, totalBytes: sizes.reduce((s, x) => s + x.bytes, 0), largest: [...sizes].sort((a, b) => b.bytes - a.bytes).slice(0, 4) };
fs.mkdirSync(path.join(root, '.local'), { recursive: true });
fs.writeFileSync(path.join(root, '.local/release-verification.json'), JSON.stringify(result, null, 2));
fs.writeFileSync(path.join(root, '.local/publish-manifest.json'), JSON.stringify(sizes, null, 2));
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
