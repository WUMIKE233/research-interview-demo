# 研究对话 · 实习面谈 / Research Dialogue

**在线使用 / Live:** https://wumike233.github.io/research-interview-demo/

## 中文

为同屏交流设计的面谈网页。五个话题覆盖当前研究重点、无参数微调的样本稳定性、SAM鲁棒性与干净精度、受控实验设计，以及Agent执行过程的安全。最后一页共同填写首项任务、验收标准、第一次汇报和所需资源。

### 使用

1. 选择一个话题，点击“讨论角度”继续展开；方向键可切换话题，输入时不会触发切换。
2. 现场填写“交流要点”和“仍需确认”，标记已讨论或留待之后。
3. 把可尝试的小任务加入“下一步候选”，在结束时填写具体安排。
4. 现场确认后勾选确认框；后续修改安排会自动恢复为待确认草案。
5. 导出Markdown纪要，或打印/存为PDF。更多菜单支持JSON备份、导入和新建面谈。

记录自动保存在当前浏览器，不会上传服务器或同步到其他设备。换浏览器、清理浏览器存储或使用隐私模式时，请先导出。JSON导入会创建新记录，保留原记录；新建面谈也不会覆盖已有内容。没有登录、模型服务、付费API或外部字体请求。

论文属于相应作者；网页问题和起步任务属于交流草案。详见 [PROVENANCE.md](./PROVENANCE.md)。原先的新闻分类、视觉特征与实验图表已从主页移除；仓库中的v1资源保留但不由当前页面加载。

### 本地运行与检查

```sh
python -m http.server 8766
node --check assets/discussion.js
node scripts/verify-release.mjs
```

打开 `http://localhost:8766/`。无需前端构建。GitHub Pages 从 main 根目录发布。

- `index.html`：面谈页面入口
- `assets/discussion.js`：切换、记录、持久化、导入导出和打印
- `assets/topics.js`：问题、讨论角度、任务草案与公开来源
- `assets/discussion.css`：桌面、手机、大字和打印版式
- `assets/fonts/`：自托管字体子集及OFL许可

## English

A shared-screen discussion notebook for a research internship meeting. Five topics cover research priorities, sample-selection stability in parameter-free adaptation, SAM robustness trade-offs, controlled evaluation, and Agent process safety. A closing page captures the first task, acceptance criteria, reporting arrangement, and resources.

Select a topic and a discussion angle, write notes and open questions, and collect possible starting tasks. Mark topics as discussed or deferred. Confirm the next-step plan explicitly; editing the plan returns it to draft status. Export Markdown minutes or print/save a PDF. JSON backup/import and multiple local meetings are available in the more menu. Import creates a separate record and does not overwrite existing meetings.

Notes remain in the current browser's local storage. There is no server upload or live synchronization. Export before switching browsers, clearing site data, or leaving private browsing. No authentication, model service, paid API, or external font request is required.

Run `python -m http.server 8766` and open `http://localhost:8766/`. Validate with `node --check assets/discussion.js` and `node scripts/verify-release.mjs`. GitHub Pages deploys the root of main. Earlier project demonstrations have been removed from the homepage; retained v1 assets are not loaded by the dialogue interface.

Discussion ideas are proposals, not completed experiments. Referenced faculty papers belong to their respective authors. See [sources and scope](./PROVENANCE.md) and [third-party notices](./THIRD_PARTY.md).
