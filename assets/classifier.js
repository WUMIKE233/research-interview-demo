// Browser port of the exported scikit-learn TF-IDF + LinearSVC pipeline.
export function cleanText(value) {
  return String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\u4e00-\u9fffA-Za-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function createClassifier(metadata, vocabulary, buffer) {
  const n = metadata.featureCount;
  const k = metadata.classes.length;
  if (buffer.byteLength !== (n + n * k + k) * 4 || vocabulary.length !== n) {
    throw new Error('模型文件不完整，请重新加载。');
  }
  const values = new Float32Array(buffer);
  const lookup = new Map(vocabulary.map((term, index) => [term, index]));
  const biasOffset = n + n * k;
  return {
    metadata,
    predict(input) {
      const cleaned = cleanText(input);
      const normalized = cleaned.toLowerCase();
      const counts = new Map();
      for (let size = 2; size <= 5; size++) {
        for (let pos = 0; pos <= normalized.length - size; pos++) {
          const index = lookup.get(normalized.slice(pos, pos + size));
          if (index !== undefined) counts.set(index, (counts.get(index) ?? 0) + 1);
        }
      }
      let squared = 0;
      const features = [...counts].map(([index, count]) => {
        const weight = (1 + Math.log(count)) * values[index];
        squared += weight * weight;
        return { index, weight };
      });
      const norm = Math.sqrt(squared) || 1;
      for (const feature of features) feature.weight /= norm;
      const scores = metadata.classes.map((label, classIndex) => {
        const offset = n + classIndex * n;
        let score = values[biasOffset + classIndex];
        for (const feature of features) score += feature.weight * values[offset + feature.index];
        return { label, score, classIndex };
      });
      const ranked = [...scores].sort((a, b) => b.score - a.score);
      const winner = ranked[0];
      const offset = n + winner.classIndex * n;
      const contributions = features.map(feature => ({
        term: vocabulary[feature.index],
        contribution: feature.weight * values[offset + feature.index],
      })).sort((a, b) => b.contribution - a.contribution);
      return { cleaned, featureCount: features.length, prediction: winner.label, scores, ranked, contributions };
    },
  };
}

export async function loadClassifier(base = './assets/model/', onProgress = () => {}) {
  const get = async (path, format, expectedBytes) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(base + path, { signal: AbortSignal.timeout(30000), cache: attempt ? 'reload' : 'default' });
        if (!response.ok) throw new Error('模型资源暂时无法加载，请稍后重试。');
        const result = format === 'binary' ? await response.arrayBuffer() : await response.json();
        if (expectedBytes !== undefined && result.byteLength !== expectedBytes) throw new Error('模型分块传输不完整。');
        return result;
      } catch (error) {
        if (attempt === 2) throw error;
      }
    }
  };
  const metadata = await get('metadata.json');
  const vocabularyPromise = get('vocabulary.json');
  let buffer;
  if (metadata.delivery) {
    const compressed = typeof DecompressionStream !== 'undefined';
    const parts = compressed ? metadata.delivery.compressedParts : metadata.delivery.rawParts;
    const chunks = new Array(parts.length);
    let next = 0;
    let completed = 0;
    const worker = async () => {
      while (next < parts.length) {
        const index = next++;
        const part = parts[index];
        chunks[index] = await get(part.file, 'binary', part.bytes);
        onProgress(++completed, parts.length);
      }
    };
    // Consume both promises together so a vocabulary failure is handled immediately.
    const [vocabulary] = await Promise.all([
      vocabularyPromise,
      Promise.all(Array.from({ length: Math.min(3, parts.length) }, worker)),
    ]);
    const blob = new Blob(chunks);
    buffer = compressed ? await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer() : await blob.arrayBuffer();
    if (globalThis.crypto?.subtle) {
      const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(x => x.toString(16).padStart(2, '0')).join('');
      if (hash !== metadata.weightsSha256) throw new Error('模型完整性校验未通过，请重新加载。');
    }
    return createClassifier(metadata, vocabulary, buffer);
  }
  const [vocabulary, original] = await Promise.all([vocabularyPromise, get('weights.f32', 'binary')]);
  return createClassifier(metadata, vocabulary, original);
}
