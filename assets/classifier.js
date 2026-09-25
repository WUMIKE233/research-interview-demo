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

export async function loadClassifier(base = './assets/model/') {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const get = async (path, format) => {
      const response = await fetch(base + path, { signal: controller.signal });
      if (!response.ok) throw new Error('模型资源暂时无法加载，请稍后重试。');
      return format === 'binary' ? response.arrayBuffer() : response.json();
    };
    const [metadata, vocabulary, buffer] = await Promise.all([
      get('metadata.json'), get('vocabulary.json'), get('weights.f32', 'binary'),
    ]);
    return createClassifier(metadata, vocabulary, buffer);
  } finally {
    clearTimeout(timer);
  }
}
