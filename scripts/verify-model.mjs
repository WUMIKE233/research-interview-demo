// Cross-runtime numerical check against the source Python model, resumable per case.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClassifier } from '../assets/classifier.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const metadata = read('assets/model/metadata.json');
const vocabulary = read('assets/model/vocabulary.json');
const bytes = fs.readFileSync(path.join(root, 'assets/model/weights.f32'));
const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const classifier = createClassifier(metadata, vocabulary, buffer);
const fixture = read('validation/model-parity.json');
fs.mkdirSync(path.join(root, '.local'), { recursive: true });
if (fixture.modelHash !== metadata.sourceSha256) throw new Error('Stale parity fixture');
const hash = crypto.createHash('sha256').update(bytes)
  .update(fs.readFileSync(path.join(root, 'assets/classifier.js')))
  .update(JSON.stringify(fixture)).digest('hex');
const checkpoint = path.join(root, `.local/js-parity-${hash.slice(0, 12)}.jsonl`);
let done = new Map();
if (fs.existsSync(checkpoint)) {
  for (const line of fs.readFileSync(checkpoint, 'utf8').split('\n').filter(Boolean)) {
    try { const row = JSON.parse(line); done.set(row.index, row); } catch {}
  }
}
for (const [index, item] of fixture.cases.entries()) {
  if (done.has(index)) continue;
  const actual = classifier.predict(item.text);
  const error = Math.max(...actual.scores.map((s, i) => Math.abs(s.score - item.scores[i])));
  const row = { index, error, passed: actual.prediction === item.expected && actual.cleaned === item.cleaned
    && actual.featureCount === item.featureCount && error < 1e-5 };
  fs.appendFileSync(checkpoint, JSON.stringify(row) + '\n');
  done.set(index, row);
}
const records = [...done.values()];
const result = {
  check: 'JavaScript float32 vs source sklearn 1.8.0 float64', cases: fixture.cases.length,
  passed: records.length === fixture.cases.length && records.every(x => x.passed),
  maxAbsoluteScoreError: Math.max(...records.map(x => x.error)), tolerance: 1e-5,
  checkpointResume: true, purpose: 'Export fidelity; not an accuracy benchmark',
};
fs.writeFileSync(path.join(root, '.local/model-verification.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (!result.passed) process.exitCode = 1;
