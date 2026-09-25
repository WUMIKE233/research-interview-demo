import { TOPICS, WRAP_FIELDS } from './topics.js';

const STORAGE = 'research-dialogue.meetings.v2';
const APP = 'research-dialogue';
const IDS = [...TOPICS.map(topic => topic.id), 'next'];
const STATUS = { open: '待讨论', done: '已讨论', later: '留待之后' };
const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const text = (value, max = 10000) => typeof value === 'string' ? value.slice(0, max) : '';
const id = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
function fresh() {
  return { id: id(), title: '实习面谈', date: '', active: 'direction', updatedAt: new Date().toISOString(),
    topics: Object.fromEntries(TOPICS.map(topic => [topic.id, { status: 'open', lens: 0, notes: '', questions: '' }])),
    ideas: [], wrap: Object.fromEntries(WRAP_FIELDS.map(field => [field.id, ''])), confirmed: false };
}
function normalize(input) {
  if (!input || typeof input !== 'object' || !input.topics || typeof input.topics !== 'object') throw new Error('文件中没有可读取的话题记录。');
  const result = fresh();
  result.id = text(input.id, 80) || result.id;
  result.title = text(input.title, 60) || '实习面谈';
  result.date = typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : '';
  result.active = IDS.includes(input.active) ? input.active : 'direction';
  result.updatedAt = typeof input.updatedAt === 'string' && !Number.isNaN(Date.parse(input.updatedAt)) ? input.updatedAt : result.updatedAt;
  for (const topic of TOPICS) {
    const entry = input.topics[topic.id] || {};
    result.topics[topic.id] = { status: Object.hasOwn(STATUS, entry.status) ? entry.status : 'open', lens: Number.isInteger(entry.lens) && entry.lens >= 0 && entry.lens < topic.lenses.length ? entry.lens : 0, notes: text(entry.notes), questions: text(entry.questions, 5000) };
  }
  result.ideas = Array.isArray(input.ideas) ? [...new Set(input.ideas.filter(value => TOPICS.some(topic => topic.id === value)))] : [];
  for (const field of WRAP_FIELDS) result.wrap[field.id] = text(input.wrap?.[field.id]);
  result.confirmed = input.confirmed === true;
  return result;
}
let writable = true;
let loadMessage = '';
function restore() {
  const first = fresh();
  const empty = { version: 2, currentId: first.id, sessions: [first], large: false };
  try {
    const raw = localStorage.getItem(STORAGE);
    if (!raw) return empty;
    const saved = JSON.parse(raw);
    if (saved.version !== 2 || !Array.isArray(saved.sessions) || !saved.sessions.length) throw new Error('记录格式无法识别');
    const sessions = saved.sessions.map(normalize);
    return { version: 2, currentId: sessions.some(item => item.id === saved.currentId) ? saved.currentId : sessions[0].id, sessions, large: saved.large === true };
  } catch {
    writable = false;
    loadMessage = '无法读取本地记录，请用导出保存本次内容';
    return empty;
  }
}
const state = restore();
const current = () => state.sessions.find(item => item.id === state.currentId);
let active = IDS.includes(location.hash.slice(1)) ? location.hash.slice(1) : current().active;
let toastTimer;
function notify(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3800);
}
function persist() {
  current().updatedAt = new Date().toISOString();
  if (writable) {
    try { localStorage.setItem(STORAGE, JSON.stringify(state)); }
    catch { writable = false; loadMessage = '自动保存不可用，请及时导出记录'; }
  }
  $('#save-status').textContent = writable ? '已保存到此浏览器' : loadMessage;
  $('#save-dot').classList.toggle('warning', !writable);
}
function renderMeta() {
  $('#meeting-title').value = current().title;
  $('#meeting-date').value = current().date;
  $('#session-select').innerHTML = state.sessions.map(item => `<option value="${esc(item.id)}">${esc(item.title)} · ${esc(item.date || '日期待定')}</option>`).join('');
  $('#session-select').value = current().id;
  applyLargeMode();
}
function renderNav() {
  const completed = TOPICS.filter(topic => current().topics[topic.id].status === 'done').length;
  $('#done-count').textContent = String(completed).padStart(2, '0');
  $('#progress-fill').style.width = `${completed / TOPICS.length * 100}%`;
  $('#topic-nav').innerHTML = TOPICS.map((topic, index) => {
    const entry = current().topics[topic.id];
    return `<button type="button" class="agenda-item ${active === topic.id ? 'active' : ''} ${entry.status}" data-topic="${topic.id}" ${active === topic.id ? 'aria-current="step"' : ''}><span class="agenda-number">${String(index + 1).padStart(2, '0')}</span><span class="agenda-copy"><strong>${esc(topic.short)}</strong><small>${esc(topic.subtitle)}</small></span><span class="agenda-indicator" aria-label="${STATUS[entry.status]}">${entry.status === 'done' ? '✓' : entry.status === 'later' ? '·' : ''}</span></button>`;
  }).join('') + `<button type="button" class="agenda-item wrap-nav ${active === 'next' ? 'active' : ''}" data-topic="next" ${active === 'next' ? 'aria-current="step"' : ''}><span class="agenda-number">↗</span><span class="agenda-copy"><strong>一起定下一步</strong><small>任务、标准与汇报</small></span></button>`;
}
function renderTopic(topic) {
  const entry = current().topics[topic.id];
  const index = TOPICS.indexOf(topic);
  const lens = topic.lenses[entry.lens];
  $('#notes-panel').hidden = false;
  $('.workspace').classList.remove('wrapup');
  $('#discussion').innerHTML = `<div class="topic-topline"><span class="topic-label">${esc(topic.category)}</span><span>${esc(topic.minutes)}</span></div>
    <div class="topic-title"><span class="topic-number">${String(index + 1).padStart(2, '0')}</span><h2>${esc(topic.title)}</h2></div>
    <p class="context">${esc(topic.context)}</p>
    <div class="question-card"><span class="section-kicker">从这个问题聊起</span><p>${esc(topic.question)}</p><span class="question-mark" aria-hidden="true">?</span></div>
    <section class="explore-section" aria-labelledby="explore-heading"><div class="section-heading"><h3 id="explore-heading">一起展开</h3><span>选一个角度，继续聊</span></div>
      <div class="lens-options" role="group" aria-label="讨论角度">${topic.lenses.map((item, i) => `<button type="button" data-lens="${i}" aria-pressed="${i === entry.lens}">${esc(item.label)}</button>`).join('')}</div>
      <div class="lens-panel" aria-live="polite"><h4>${esc(lens.title)}</h4><p>${esc(lens.question)}</p><small>${esc(lens.hint)}</small></div>
    </section>
    <div class="thinking-flow" aria-label="讨论结构">${topic.flow.map((step, i) => `<div><span>0${i + 1}</span><p>${esc(step)}</p></div>${i < 2 ? '<span class="flow-arrow" aria-hidden="true">→</span>' : ''}`).join('')}</div>
    <section class="starter"><div class="section-heading"><h3>可以从这一步开始</h3><span class="draft-tag">待商量的任务</span></div><p>${esc(topic.starter)}</p><button type="button" class="text-button" id="add-idea" ${current().ideas.includes(topic.id) ? 'disabled' : ''}>${current().ideas.includes(topic.id) ? '✓ 已加入下一步候选' : '＋ 加入下一步候选'}</button></section>
    <details class="reading-note"><summary>阅读线索与讨论边界 <span aria-hidden="true">＋</span></summary><div><strong>${esc(topic.basis)}</strong><p>${esc(topic.grounding)}</p><p class="boundary">${esc(topic.boundary)}</p>${topic.sources.length ? `<div class="source-links">${topic.sources.map(source => `<a href="${source.url}" target="_blank" rel="noopener noreferrer">${esc(source.label)} ↗</a>`).join('')}</div>` : ''}</div></details>
    <div class="topic-bottom"><button type="button" class="button quiet" id="previous-topic" ${index === 0 ? 'disabled' : ''}>← 上一话题</button><span>${index + 1} / 5</span><button type="button" class="button outline" id="next-topic">${index === 4 ? '一起定下一步' : '下一话题'} →</button></div>`;
  $('#notes-panel').innerHTML = `<div class="notes-topline"><span class="note-symbol" aria-hidden="true">✎</span><span>共同留下的线索</span></div><h3 id="notes-heading">边聊，边记。</h3><p class="notes-intro">记录共识，也保留不同的看法。</p>
    <label for="topic-notes">交流要点</label><textarea id="topic-notes" data-note="notes" rows="7" maxlength="10000" placeholder="老师的建议、自己的理解、想继续追问的内容……">${esc(entry.notes)}</textarea>
    <label for="topic-questions">仍需确认</label><textarea id="topic-questions" data-note="questions" rows="4" maxlength="5000" placeholder="还缺哪些信息？哪些判断需要实验验证？">${esc(entry.questions)}</textarea>
    <label class="status-label" for="topic-status">这个话题</label><select id="topic-status"><option value="open">待讨论</option><option value="done">已讨论</option><option value="later">留待之后</option></select>
    <button type="button" id="mark-done" class="button ${entry.status === 'done' ? 'outline' : 'primary'}">${entry.status === 'done' ? '✓ 已讨论' : '✓ 标记已讨论'}</button>
    <p class="local-note">输入时自动保存。导出纪要后，可以带走或分享给老师。</p>`;
  $('#topic-status').value = entry.status;
}
function renderWrap() {
  $('#notes-panel').hidden = true;
  $('.workspace').classList.add('wrapup');
  const ideas = current().ideas.map(key => TOPICS.find(topic => topic.id === key));
  $('#discussion').innerHTML = `<div class="topic-topline"><span class="topic-label">从交流，走向行动</span><span>结束前一起确认</span></div><div class="wrap-title"><span class="small-arrow" aria-hidden="true">↗</span><div><h2>把下一步，写具体。</h2><p>一项任务，一个验收标准，一个汇报时间。</p></div></div>
    <div class="wrap-layout"><div class="wrap-fields">${WRAP_FIELDS.map(field => `<div class="wrap-field"><label for="wrap-${field.id}"><span>${field.number}</span>${esc(field.label)}</label><textarea id="wrap-${field.id}" data-wrap="${field.id}" rows="${field.rows}" maxlength="10000" placeholder="${esc(field.placeholder)}">${esc(current().wrap[field.id])}</textarea></div>`).join('')}</div>
    <aside class="idea-panel"><p class="section-kicker">刚才留下的可能性</p><h3>起步任务候选</h3>${ideas.length ? ideas.map(topic => `<article class="idea-card"><span>${esc(topic.short)}</span><p>${esc(topic.starter)}</p><button class="text-button" type="button" data-use-idea="${topic.id}">补充到第一项任务 ↗</button></article>`).join('') : '<p class="empty-ideas">还没有加入候选。可以直接填写左侧安排，也可以回到话题，把值得尝试的小任务留下来。</p>'}<div class="meeting-recap"><span>讨论进度</span>${TOPICS.map(topic => `<p><b>${esc(topic.short)}</b><small>${STATUS[current().topics[topic.id].status]}</small></p>`).join('')}</div></aside></div>
    <div class="agreement"><label><input id="agreement" type="checkbox" ${current().confirmed ? 'checked' : ''}><span>现场已确认上述安排</span></label><small id="agreement-status">${current().confirmed ? '已标记为现场确认；修改安排后将恢复待确认。' : '未勾选时，导出的安排会保留为讨论草案。'}</small></div>
    <div class="wrap-actions"><button type="button" class="button primary" id="export-wrap">导出本次纪要 ↗</button><button type="button" class="button outline" id="print-wrap">打印 / 存为 PDF</button><span>标题、话题记录与下一步安排将一起导出。</span></div>`;
}
function render() {
  renderNav();
  if (active === 'next') renderWrap();
  else renderTopic(TOPICS.find(topic => topic.id === active));
}
function navigate(next, scroll = true) {
  if (!IDS.includes(next)) return;
  active = next;
  current().active = next;
  history.replaceState(null, '', `#${next}`);
  persist();
  render();
  if (scroll) { $('#discussion').focus({ preventScroll: true }); if (window.innerWidth < 980) $('#discussion').scrollIntoView({ block: 'start', behavior: 'smooth' }); }
}
function applyLargeMode() {
  document.body.classList.toggle('large-mode', state.large);
  $('#large-mode').setAttribute('aria-pressed', String(state.large));
  $('#large-label').textContent = state.large ? '恢复字号' : '大字模式';
}
function setStatus(value) {
  current().topics[active].status = value;
  persist();
  renderNav();
  $('#topic-status').value = value;
  $('#mark-done').textContent = value === 'done' ? '✓ 已讨论' : '✓ 标记已讨论';
  $('#mark-done').className = `button ${value === 'done' ? 'outline' : 'primary'}`;
}
function invalidateAgreement() {
  current().confirmed = false;
  if ($('#agreement')) $('#agreement').checked = false;
  if ($('#agreement-status')) $('#agreement-status').textContent = '安排有更新，现场确认后可重新勾选。';
}
function markdown() {
  const session = current();
  const lines = [`# ${session.title}`, '', `面谈日期：${session.date || '待定'}`, `记录导出：${new Date().toLocaleString('zh-CN', { hour12: false })}`, '', '> 本文为面谈记录。论文属于相应作者；讨论问题与起步任务不代表已完成实验。', ''];
  for (const [i, topic] of TOPICS.entries()) {
    const entry = session.topics[topic.id];
    lines.push(`## ${i + 1}. ${topic.short}`, '', `状态：${STATUS[entry.status]}`, '', `讨论问题：${topic.question}`, '', `当前讨论角度：${topic.lenses[entry.lens].label}`, '', '### 交流要点', '', entry.notes || '（未记录）', '', '### 仍需确认', '', entry.questions || '（未记录）', '');
  }
  lines.push('## 下一步安排', '', `确认状态：${session.confirmed ? '现场已确认（由记录者勾选）' : '讨论草案，尚未标记现场确认'}`, '');
  for (const field of WRAP_FIELDS) lines.push(`### ${field.label}`, '', session.wrap[field.id] || '（未填写）', '');
  if (session.ideas.length) { lines.push('### 起步任务候选', ''); for (const key of session.ideas) lines.push(`- ${TOPICS.find(topic => topic.id === key).starter}`); lines.push(''); }
  lines.push('## 阅读入口', '');
  const sources = new Map(TOPICS.flatMap(topic => topic.sources).map(source => [source.url, source.label]));
  for (const [url, label] of sources) lines.push(`- [${label}](${url})`);
  return lines.join('\n');
}
function download(content, extension, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${current().title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 50)}_${current().date || '日期待定'}.${extension}`;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportMarkdown() { download(markdown(), 'md', 'text/markdown;charset=utf-8'); notify('已生成纪要下载，内容包含所有话题记录。'); }
function printSheet() {
  const session = current();
  $('#print-sheet').innerHTML = `<header><p>研究对话 · 实习面谈纪要</p><h1>${esc(session.title)}</h1><span>面谈日期：${esc(session.date || '待定')}　｜　${session.confirmed ? '安排已由记录者标记现场确认' : '安排为讨论草案'}</span></header>${TOPICS.map((topic, i) => { const entry = session.topics[topic.id]; return `<section class="print-topic"><h2>${i + 1}. ${esc(topic.short)} <small>${STATUS[entry.status]}</small></h2><p class="print-question">${esc(topic.question)}</p><p>讨论角度：${esc(topic.lenses[entry.lens].label)}</p><h3>交流要点</h3><div class="print-note">${esc(entry.notes || '（未记录）')}</div><h3>仍需确认</h3><div class="print-note">${esc(entry.questions || '（未记录）')}</div></section>`; }).join('')}<section class="print-topic"><h2>下一步安排</h2>${WRAP_FIELDS.map(field => `<h3>${esc(field.label)}</h3><div class="print-note">${esc(session.wrap[field.id] || '（未填写）')}</div>`).join('')}${session.ideas.length ? `<h3>起步任务候选</h3><ul>${session.ideas.map(key => `<li>${esc(TOPICS.find(topic => topic.id === key).starter)}</li>`).join('')}</ul>` : ''}</section><footer>本记录来自同屏面谈页。论文属于相应作者；讨论草案不代表已完成实验。</footer>`;
}
function print() { printSheet(); window.print(); }

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.topic) return navigate(button.dataset.topic);
  if (button.dataset.lens !== undefined) {
    current().topics[active].lens = Number(button.dataset.lens); persist(); renderTopic(TOPICS.find(topic => topic.id === active));
    $(`[data-lens="${button.dataset.lens}"]`).focus({ preventScroll: true }); return;
  }
  if (button.dataset.useIdea) {
    const idea = TOPICS.find(topic => topic.id === button.dataset.useIdea).starter;
    if (!current().wrap.task.includes(idea)) current().wrap.task = [current().wrap.task, idea].filter(Boolean).join('\n');
    invalidateAgreement(); persist(); renderWrap(); notify('已补充到第一项任务，原有文字保留。'); return;
  }
  switch (button.id) {
    case 'large-mode': state.large = !state.large; applyLargeMode(); persist(); break;
    case 'previous-topic': navigate(IDS[Math.max(0, IDS.indexOf(active) - 1)]); break;
    case 'next-topic': navigate(IDS[IDS.indexOf(active) + 1]); break;
    case 'mark-done': setStatus('done'); break;
    case 'add-idea': if (!current().ideas.includes(active)) current().ideas.push(active); persist(); button.disabled = true; button.textContent = '✓ 已加入下一步候选'; notify('已放入“下一步”的候选区，最终安排可在结束时填写。'); break;
    case 'export-markdown': case 'export-wrap': exportMarkdown(); break;
    case 'export-json': download(JSON.stringify({ app: APP, version: 2, exportedAt: new Date().toISOString(), meeting: current() }, null, 2), 'json', 'application/json'); notify('已生成备份，可用“导入记录”在其他浏览器恢复。'); break;
    case 'import-button': $('#import-file').click(); break;
    case 'print-button': case 'print-wrap': print(); break;
    case 'new-session': { const next = fresh(); state.sessions.push(next); state.currentId = next.id; renderMeta(); navigate('direction'); $('.more-menu').open = false; notify('已新建面谈，旧记录仍可在“已有面谈”中打开。'); break; }
  }
});
document.addEventListener('input', event => {
  const input = event.target;
  if (input.dataset.note) current().topics[active][input.dataset.note] = input.value;
  else if (input.dataset.wrap) { current().wrap[input.dataset.wrap] = input.value; invalidateAgreement(); }
  else if (input.id === 'meeting-title') current().title = input.value;
  else if (input.id === 'meeting-date') current().date = input.value;
  else return;
  persist();
});
document.addEventListener('change', async event => {
  const input = event.target;
  if (input.id === 'topic-status') return setStatus(input.value);
  if (input.id === 'agreement') { current().confirmed = input.checked; persist(); $('#agreement-status').textContent = input.checked ? '已标记为现场确认；修改安排后将恢复待确认。' : '未勾选时，导出的安排会保留为讨论草案。'; }
  if (input.id === 'meeting-title') { if (!current().title.trim()) current().title = '实习面谈'; persist(); renderMeta(); }
  if (input.id === 'meeting-date') renderMeta();
  if (input.id === 'session-select') { state.currentId = input.value; renderMeta(); navigate(current().active); $('.more-menu').open = false; }
  if (input.id === 'import-file') {
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 512 * 1024) throw new Error('文件超过 512 KB，请选择本页面导出的单次面谈备份。');
      const payload = JSON.parse(await file.text());
      if (payload.app !== APP || payload.version !== 2) throw new Error('请使用本页面导出的面谈 JSON 备份。');
      const imported = normalize(payload.meeting);
      imported.id = id(); imported.title = `${imported.title.slice(0, 54)}（导入）`;
      state.sessions.push(imported); state.currentId = imported.id; renderMeta(); navigate(imported.active); $('.more-menu').open = false;
      notify('已作为新记录导入，原有记录保留。');
    } catch (error) { notify(`导入失败：${error instanceof SyntaxError ? 'JSON 格式无效。' : error.message}`); }
    finally { input.value = ''; }
  }
});
document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
  if (event.key === 'Escape' && state.large) { state.large = false; applyLargeMode(); persist(); return; }
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault(); const position = IDS.indexOf(active); navigate(IDS[Math.max(0, Math.min(IDS.length - 1, position + (event.key === 'ArrowRight' ? 1 : -1)))]);
  }
});
window.addEventListener('hashchange', () => { const next = location.hash.slice(1); if (IDS.includes(next)) navigate(next, false); });
window.addEventListener('beforeprint', printSheet);
renderMeta(); render(); persist();
