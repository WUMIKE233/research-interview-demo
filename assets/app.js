import { loadClassifier, cleanText } from './classifier.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escapeHTML = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const percent = value => (value * 100).toFixed(2) + '%';
const examples = [
  ['科技', '人工智能芯片研发取得新进展，云计算平台提升模型训练效率。'],
  ['体育', '球队在篮球决赛最后一节完成逆转，主教练称赞球员防守。'],
  ['农业', '农民采用节水灌溉种植水稻，农技专家指导病虫害防治。'],
  ['教育', '高校公布研究生招生计划，学生备战考试并申请奖学金。'],
  ['混合主题', '人工智能辅助篮球训练，算法分析球员的运动轨迹。'],
];
let classifier;
let modelPromise;
let newsRecords;
let visionRecords;
let currentMetric = 'f1_macro';
let sampleIndex = 0;
let layerIndex = 4;
let featureView = 'channels';
let tourIndex = 0;
let toastTimer;
const tour = [
  { target: '#nlp', title: '01 / 从一次真实预测开始', hint: '修改示例，比较类别分数，再解释支持判断的字符片段。' },
  { target: '#vision', title: '02 / 沿着网络观察特征', hint: '切换输入与网络层，区分通道激活、平均热力图和结论边界。' },
  { target: '#evidence', title: '03 / 回到实验与下一步', hint: '看宏 F1 和薄弱类别，说明独立测试集与真实图像验证的计划。' },
];

async function getJSON(path) {
  const response = await fetch(path, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error('记录暂时无法加载，请刷新页面重试。');
  return response.json();
}

function showToast(text) {
  clearTimeout(toastTimer);
  $('#toast').textContent = text;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3200);
}

function updateCount() {
  $('#character-count').textContent = `${$('#news-input').value.length} / 1200`;
  $('#input-error').hidden = true;
}

function resetOutput(message = '等待一次新的观察') {
  $('#prediction-result').hidden = true;
  $('#result-placeholder').hidden = false;
  $('#result-placeholder p').textContent = message;
}

async function ensureModel() {
  if (classifier) return classifier;
  if (modelPromise) return modelPromise;
  $('#model-status').textContent = '正在载入已训练模型，首次访问可能需要数秒…';
  $('#model-dot').className = 'status-dot loading';
  $('#retry-model').hidden = true;
  $('#predict-button').disabled = true;
  modelPromise = loadClassifier('./assets/model/', (loaded, total) => {
    $('#model-status').textContent = `模型载入 ${Math.round(loaded / total * 100)}% · 首次访问请稍候`;
  }).then(model => {
    classifier = model;
    $('#model-status').textContent = '模型已就绪 · 计算在浏览器内完成';
    $('#model-dot').className = 'status-dot';
    return model;
  }).catch(error => {
    $('#model-status').textContent = '模型加载未完成，请检查网络后重试。';
    $('#model-dot').className = 'status-dot error';
    $('#retry-model').hidden = false;
    modelPromise = undefined;
    throw error;
  }).finally(() => { $('#predict-button').disabled = false; });
  return modelPromise;
}

async function predict() {
  const text = $('#news-input').value;
  if (!cleanText(text)) {
    $('#input-error').textContent = '请输入包含中文、字母或数字的新闻文本。';
    $('#input-error').hidden = false;
    resetOutput();
    $('#news-input').focus();
    return;
  }
  try {
    const model = await ensureModel();
    const started = performance.now();
    const result = model.predict($('#news-input').value);
    const elapsed = performance.now() - started;
    if (!result.featureCount) {
      $('#input-error').textContent = '没有匹配到训练词表中的字符片段，请尝试一段更完整的中文新闻。';
      $('#input-error').hidden = false;
      resetOutput('信息不足，暂不展示类别');
      return;
    }
    $('#input-error').hidden = true;
    $('#result-placeholder').hidden = true;
    $('#prediction-result').hidden = false;
    $('#prediction-label').textContent = result.prediction;
    $('#feature-count').textContent = result.featureCount;
    $('#inference-time').textContent = `本次计算 ${elapsed.toFixed(1)} ms`;
    const top = result.ranked.slice(0, 3);
    const maxAbs = Math.max(...top.map(x => Math.abs(x.score)), 1e-12);
    $('#score-list').innerHTML = top.map(item => {
      const width = Math.abs(item.score) / maxAbs * 47;
      const left = item.score >= 0 ? 50 : 50 - width;
      return `<div class="score-row"><span>${escapeHTML(item.label)}</span><div class="signed-track" aria-hidden="true"><i class="signed-fill ${item.score < 0 ? 'negative' : ''}" style="left:${left}%;width:${width}%"></i></div><span>${item.score >= 0 ? '+' : ''}${item.score.toFixed(3)}</span></div>`;
    }).join('');
    const supportive = result.contributions.filter(x => x.contribution > 0).slice(0, 8);
    $('#contributions').innerHTML = supportive.length ? supportive.map(item => `<span class="contribution-chip">${escapeHTML(item.term)}<small>+${item.contribution.toFixed(3)}</small></span>`).join('') : '<span class="result-note">当前输入没有正向特征贡献，需谨慎解读。</span>';
  } catch {
    $('#input-error').textContent = '模型资源加载失败，请使用下方“重试加载”。';
    $('#input-error').hidden = false;
    resetOutput('等待模型重新载入');
  }
}

$('#example-buttons').innerHTML = examples.map(([label], index) => `<button type="button" data-example="${index}">${escapeHTML(label)}</button>`).join('');
$('#example-buttons').addEventListener('click', event => {
  const button = event.target.closest('[data-example]');
  if (!button) return;
  $('#news-input').value = examples[Number(button.dataset.example)][1];
  updateCount();
  predict();
});
$('#news-input').addEventListener('input', () => { updateCount(); resetOutput('文本已更改，点击运行分类'); });
$('#news-input').addEventListener('keydown', event => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); predict(); }
});
$('#predict-button').addEventListener('click', predict);
$('#retry-model').addEventListener('click', () => {
  ensureModel().then(() => { if (cleanText($('#news-input').value)) predict(); }).catch(() => {});
});
$('#clear-button').addEventListener('click', () => { $('#news-input').value = ''; updateCount(); resetOutput(); $('#news-input').focus(); });
updateCount();

const classNames = { airplane: '飞机', automobile: '汽车', bird: '鸟', cat: '猫', deer: '鹿', dog: '狗', frog: '青蛙', horse: '马', ship: '船', truck: '卡车' };
const layerInfo = [
  ['conv1', '卷积入口', '高分辨率响应。可以比较不同通道对局部颜色与轮廓的响应。'],
  ['layer1', '残差阶段 1', '观察浅层特征的空间分布；单个激活区域不等于完整语义解释。'],
  ['layer2', '残差阶段 2', '空间分辨率下降、通道增加，可以比较不同输入引起的响应变化。'],
  ['layer3', '残差阶段 3', '在更低的空间分辨率上观察特征，注意不要把颜色亮度直接解释成重要性。'],
  ['layer4', '残差阶段 4', '最后一个残差阶段输出 512 个通道。网格显示前 16 个通道，并非全部特征。'],
];
function renderVision() {
  if (!visionRecords) return;
  const sample = visionRecords.samples[sampleIndex];
  const layer = sample.layers[layerIndex];
  $('#sample-buttons').innerHTML = visionRecords.samples.map((item, index) => `<button class="sample-button" type="button" data-sample="${index}" aria-pressed="${index === sampleIndex}"><img src="./assets/vision/${item.input}" alt="" width="22" height="22"><span>${escapeHTML(item.title)}</span></button>`).join('');
  $('#layer-buttons').innerHTML = layerInfo.map(([id], index) => `<button class="layer-button" type="button" data-layer="${index}" aria-pressed="${index === layerIndex}">${id}</button>`).join('');
  $$('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === featureView)));
  $('#selected-input').src = `./assets/vision/${sample.input}`;
  $('#selected-input').alt = `${sample.title}：项目保存的合成输入图像`;
  $('#input-caption').textContent = sample.title + (sample.kind === 'out-of-distribution' ? ' / 非训练风格' : ' / 合成验证输入');
  $('#vision-prediction').textContent = classNames[sample.prediction] ?? sample.prediction;
  $('#vision-score').textContent = `softmax 类别分数 ${percent(sample.score)}`;
  $('#layer-description').textContent = layerInfo[layerIndex][1];
  $('#feature-shape').textContent = `C × H × W = ${layer.shape.slice(1).join(' × ')}`;
  $('#feature-image').src = `./assets/vision/${layer[featureView]}`;
  $('#feature-image').alt = `${sample.title}在${layer.id}的${featureView === 'channels' ? '前16个通道网格' : '通道均值热力图'}`;
  $('#layer-note').textContent = featureView === 'heatmap' ? '对通道取均值后归一化。各图独立归一化，颜色强度不适合直接跨图比较。' : layerInfo[layerIndex][2];
  $('#layer-step').textContent = `${String(layerIndex + 1).padStart(2, '0')} / 05`;
}

$('#sample-buttons').addEventListener('click', event => {
  const button = event.target.closest('[data-sample]');
  if (button) { sampleIndex = Number(button.dataset.sample); renderVision(); $(`[data-sample="${sampleIndex}"]`).focus({ preventScroll: true }); }
});
$('#layer-buttons').addEventListener('click', event => {
  const button = event.target.closest('[data-layer]');
  if (button) { layerIndex = Number(button.dataset.layer); renderVision(); $(`[data-layer="${layerIndex}"]`).focus({ preventScroll: true }); }
});
$$('[data-view]').forEach(button => button.addEventListener('click', () => { featureView = button.dataset.view; renderVision(); }));
$('#expand-feature').addEventListener('click', () => {
  if (!visionRecords) return;
  $('#dialog-title').textContent = $('#feature-image').alt;
  $('#dialog-image').src = $('#feature-image').src;
  $('#dialog-image').alt = $('#feature-image').alt;
  $('#image-dialog').showModal();
});
$('#close-dialog').addEventListener('click', () => $('#image-dialog').close());
$('#image-dialog').addEventListener('click', event => { if (event.target === $('#image-dialog')) $('#image-dialog').close(); });

const modelLabels = { bert: 'BERT', char_ngram_svm: '字符 n-gram SVM', linear_svm: '词特征 SVM', logistic_regression: '逻辑回归', naive_bayes: '朴素贝叶斯' };
function renderComparison() {
  if (!newsRecords) return;
  const name = currentMetric === 'accuracy' ? '准确率' : '宏 F1';
  $('#metric-label').textContent = name;
  $('#comparison-chart').innerHTML = newsRecords.metrics.map(item => `<div class="chart-row ${item.model === 'char_ngram_svm' ? 'active' : ''}" aria-label="${modelLabels[item.model]}，${name} ${percent(item[currentMetric])}"><span>${modelLabels[item.model]}</span><div class="chart-track" aria-hidden="true"><div class="chart-fill" style="width:${item[currentMetric] * 100}%"></div></div><span>${percent(item[currentMetric])}</span></div>`).join('');
  $$('[data-metric]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.metric === currentMetric)));
}
function renderClass() {
  if (!newsRecords) return;
  const label = $('#class-select').value;
  const item = newsRecords.classReport.find(row => row.label === label);
  const total = newsRecords.distribution.find(row => row.label === label);
  $('#class-f1').textContent = item.f1.toFixed(2);
  $('#class-recall').textContent = Math.round(item.recall * 100) + '%';
  $('#class-samples').textContent = `类别样本 ${total.count.toLocaleString()} 条 / 报告评测样本 ${item.support} 条`;
}
$$('[data-metric]').forEach(button => button.addEventListener('click', () => { currentMetric = button.dataset.metric; renderComparison(); }));
$('#class-select').addEventListener('change', renderClass);
$('#download-summary').addEventListener('click', () => {
  if (!newsRecords || !visionRecords) { showToast('实验记录尚未加载完成，请稍后再试。'); return; }
  const summary = { news: newsRecords, vision: { model: visionRecords.model, datasetMode: visionRecords.datasetMode, note: visionRecords.note, sources: visionRecords.sources }, provenance: 'Existing local experiment records, verified 2026-09-25. Not a new benchmark.' };
  const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'experiment-records.json'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  showToast('已生成实验记录摘要。');
});

function renderTour() {
  $('#tour-counter').textContent = `0${tourIndex + 1}/03`;
  $('#tour-title').textContent = tour[tourIndex].title;
  $('#tour-hint').textContent = tour[tourIndex].hint;
  $('#tour-prev').disabled = tourIndex === 0;
  $('#tour-next').textContent = tourIndex === tour.length - 1 ? '完成讲解 ✓' : '下一项 →';
  $(tour[tourIndex].target).scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}
function closeTour() {
  document.body.classList.remove('presenting');
  $('#tour-bar').hidden = true;
  $('#present-button').setAttribute('aria-pressed', 'false');
}
$('#present-button').setAttribute('aria-pressed', 'false');
$('#present-button').addEventListener('click', () => {
  if (document.body.classList.contains('presenting')) { closeTour(); return; }
  tourIndex = 0; document.body.classList.add('presenting'); $('#tour-bar').hidden = false;
  $('#present-button').setAttribute('aria-pressed', 'true'); renderTour();
});
$('#tour-next').addEventListener('click', () => {
  if (tourIndex < tour.length - 1) { tourIndex++; renderTour(); } else { closeTour(); showToast('演示结束，回到问题与讨论。'); }
});
$('#tour-prev').addEventListener('click', () => { if (tourIndex > 0) { tourIndex--; renderTour(); } });
$('#tour-close').addEventListener('click', closeTour);
document.addEventListener('keydown', event => {
  if (!document.body.classList.contains('presenting') || $('#image-dialog').open) return;
  if (event.key === 'Escape') { closeTour(); return; }
  if (/TEXTAREA|INPUT|SELECT/.test(event.target.tagName)) return;
  if (event.key === 'ArrowRight') { event.preventDefault(); $('#tour-next').click(); }
  if (event.key === 'ArrowLeft') { event.preventDefault(); $('#tour-prev').click(); }
});

getJSON('./assets/data/vision.json').then(data => {
  visionRecords = data; renderVision(); $('#vision-loading').hidden = true; $('#vision-workbench').hidden = false;
}).catch(error => { $('#vision-loading').textContent = error.message; });
getJSON('./assets/data/news.json').then(data => {
  newsRecords = data;
  $('#class-select').innerHTML = data.classReport.map(row => `<option value="${escapeHTML(row.label)}">${escapeHTML(row.label)}</option>`).join('');
  $('#class-select').value = '证券'; renderComparison(); renderClass();
}).catch(error => {
  $('#comparison-chart').textContent = error.message;
  $('#class-explanation').textContent = error.message;
});
ensureModel().then(() => { if ($('#news-input').value === examples[0][1]) predict(); }).catch(() => {});
