# AI Project Notebook · 人工智能项目演示

**在线演示 / Live demo:** https://wumike233.github.io/research-interview-demo/

## 中文说明

面向实习面谈的两个课程项目交互网页。新闻分类提供浏览器内的真实字符 SVM 推理，视觉部分浏览项目已保存的 ResNet18 特征图。

### 可以演示什么

- 自由输入中文新闻，或使用自编示例，查看 15 类中的预测类别、前三名决策分数和正向字符特征贡献。
- 切换 4 张合成输入、5 个网络阶段、通道网格／平均热力图，并放大查看原图。
- 切换宏 F1／准确率，查看五种模型的已有记录；按类别检查字符 SVM 的 F1、召回率和样本数。
- 进入讲解模式，按“预测 → 特征 → 实验记录”讲解。方向键切换，Esc 退出；可下载实验摘要。

### 演示边界

新闻分类使用原项目已训练的 `char_ngram_svm`，不是规则匹配或伪造输出。TF-IDF 和 LinearSVC 的参数以 float32 导出，在浏览器中计算。决策分数不是概率，片段贡献不是因果解释。用户输入不发送给推理服务器，也不写入本地存储。

BERT 只展示已有结果，没有在网页中部署 BERT 推理。原 BERT 实验使用评测集选择最佳 checkpoint 后再报告该集成绩，因此不能把表中数字称为独立测试结果。本次没有重新训练或完整复评模型。

视觉输入均来自项目的合成数据运行，网页切换已有特征图，不进行在线 ResNet 推理。合成数据上的验证结果不能代表真实 CIFAR-10 性能；平均激活图不是 Grad-CAM。

### 本地运行

无需前端构建或 API 密钥。使用 Python 启动静态服务器后访问 `http://localhost:8766`：

```sh
python -m http.server 8766
```

### 文件结构

```text
index.html                 网页入口
assets/app.js              交互、图表与讲解导航
assets/classifier.js       浏览器 TF-IDF + LinearSVC 推理
assets/model/              词表、模型元信息与 float32 参数
assets/data/               脱离原始路径的实验摘要
assets/vision/             选取的合成输入和保存的特征图
assets/fonts/              自托管 Noto 字体子集及 OFL
scripts/                   本地导出和发布核查工具
validation/                自编输入的Python参考输出，可独立复核浏览器移植
PROVENANCE.md              结果来源与适用范围
THIRD_PARTY.md             第三方资源说明
```

如需从原项目重新导出，提供两个本地项目目录并使用 scikit-learn 1.8.0：

```sh
python scripts/export_assets.py --nlp-root /path/to/nlp-project --vision-root /path/to/vision-project
node scripts/verify-model.mjs
node scripts/verify-release.mjs
```

导出脚本只读取原项目，选取指定结果与图片。仓库包含93个自编及变换输入的Python参考输出，克隆后可直接运行两条Node核查命令。模型一致性核查按模型内容与实现哈希保存逐例断点，重新运行可以继续；本地核查记录放在已忽略的 `.local/`。不包含训练脚本或原始语料。

### 部署

GitHub Pages 从 `main` 分支根目录发布；`.nojekyll` 保留静态目录。所有运行资源均随仓库提供，无外部字体 CDN 或付费服务依赖。

## English

An interview-oriented interactive portfolio for two coursework projects: Chinese news classification and ResNet18 feature visualization.

- **Live browser inference:** the original trained character n-gram TF-IDF + LinearSVC model predicts one of 15 news classes. View decision scores and weighted feature contributions. Text stays in the browser.
- **Saved vision experiment:** explore four synthetic inputs across five ResNet18 stages, switching between channel grids and mean activation maps. This is a saved-output viewer, not live ResNet inference.
- **Evidence and presentation:** compare recorded macro-F1/accuracy, inspect per-class results, download an experiment summary, and follow a three-step presentation mode.

Run `python -m http.server 8766` from the repository root. No frontend build, API key, backend or external font service is needed. GitHub Pages publishes the root of `main`.

The model export was compared with the source scikit-learn 1.8.0 model on **93 authored and transformed inputs**. Predicted labels matched; the maximum absolute decision-score difference was below **1e-6**. This validates export fidelity, not classification accuracy. Local checks support resumable per-case checkpoints in the ignored `.local/` directory.

Recorded BERT results reuse an evaluation set that participated in checkpoint selection and are **not independent test results**. Synthetic vision results do not establish performance on real CIFAR-10. Mean activation maps and linear feature contributions are not causal explanations. See [PROVENANCE.md](./PROVENANCE.md) and [THIRD_PARTY.md](./THIRD_PARTY.md).
