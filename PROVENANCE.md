# 结果来源 / Result provenance

核查日期 / Verified: 2026-09-25.

## 中文新闻分类

数据准备脚本引用 [fourteenBDr/toutiao](https://huggingface.co/datasets/fourteenBDr/toutiao)，该数据卡标注 MIT。当前网页没有发布原始新闻语料；输入框示例为此演示自编。

项目记录的样本总数为33,708，类别数为15。对比指标来自原项目 `reports/all_model_comparison.csv`；类别数量来自 `reports/dataset_summary.csv`；字符 SVM 分类别记录来自 `reports/char_ngram_svm_classification_report.txt`，其报告总支持数为8,427，分类别指标按原报告的两位小数保留。

| 模型 | 记录准确率 | 记录宏 F1 |
| --- | --- | --- |
| BERT | 0.8772991574700368 | 0.8422844419792553 |
| 字符 n-gram SVM | 0.8578379019817254 | 0.8228118227064023 |
| 词特征 SVM | 0.7917408330366679 | 0.75795414565316 |
| 逻辑回归 | 0.7910288358846564 | 0.754427909194062 |
| 朴素贝叶斯 | 0.7848581939005578 | 0.7315726321310251 |

网页的实时分类来自原项目 `models/news_classifier.joblib`，模型身份为 `char_ngram_svm`。导出使用与持久化模型一致的 scikit-learn 1.8.0，保留80,000个字符特征、2至5阶 n-gram、子线性词频、IDF、L2归一化、15类系数和截距。原模型 SHA-256：

```text
5bab92fa3f62a1a60972469f65931d741f031b29d55fdb888dad868790ad8975
```

参数从 float64 转为 float32 以控制下载大小。以93个自编及变换输入对照 Python 输出：类别一致，最大分数绝对误差约 `8.9403e-8`。这仅核查移植一致性，不是新准确率评测。零特征或空输入在界面中不展示偏置项产生的无依据分类。

原 BERT 脚本使用 `eval_dataset` 选择最佳 checkpoint 后，又在同一集合报告成绩。已有对比记录不应称为独立测试结果或严格同条件排名。需要另设独立测试集才能进一步确认泛化差异。

## ResNet18 特征可视化

图像直接选自原视觉项目的输入与输出文件，没有重新计算或用生成图替代实验图。四个输入的原文件名为 `cifar_1_airplane.png`、`cifar_2_automobile.png`、`cifar_3_bird.png` 和 `non_cifar_geometric_scene.png`；虽有 CIFAR 文件名前缀，运行记录、项目报告与图像本身均表明它们是合成数据。

特征形状和图片映射来自 `feature_outputs.json`；保存的类别分数来自 `predictions.json`；运行数据模式在 `run_summary.json` 中为 `synthetic_cifar_like`。模型加载ImageNet预训练ResNet18，冻结主干参数并训练分类头；不将此称为主干所有状态完全固定，因为训练模式下BatchNorm统计量仍可能更新。

通道网格显示前16个通道，各通道独立归一化；热力图为通道均值后归一化，颜色强度不适合直接跨图比较。类别 softmax 分数不是校准后的可靠性保证。网页只提供保存结果浏览，不部署 ResNet18 权重。

## English summary

The website uses selected local coursework artifacts, not newly trained models or newly established benchmark results. News aggregates originate from the listed CSV/text reports; real browser inference uses a float32 export of the trained character SVM. The original Python model and JavaScript port were numerically compared on 93 authored/transformed cases. This is an implementation-fidelity check only.

The vision gallery contains actual saved synthetic inputs and intermediate activations, with predictions transcribed from the original JSON. It does not run ResNet in the browser. Neither real CIFAR-10 performance nor causal explanations are claimed. The repository excludes original corpora, personal academic documents, full BERT/ResNet checkpoints, and the supervisor's papers.
