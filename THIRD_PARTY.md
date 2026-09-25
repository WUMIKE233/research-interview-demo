# 第三方资源 / Third-party resources

- **Noto Sans SC and Noto Serif SC:** Google Fonts / Noto contributors. Served as local WOFF2 text subsets retrieved through the official Google Fonts CSS2 API. Licensed under the SIL Open Font License 1.1; notices are included in `assets/fonts/OFL-noto-sans-sc.txt` and `assets/fonts/OFL-noto-serif-sc.txt`. Font source metadata is in `assets/fonts/sources.json`.
- **News data provenance:** [fourteenBDr/toutiao](https://huggingface.co/datasets/fourteenBDr/toutiao), whose dataset card specifies MIT. The original corpus is not redistributed here. Browser examples are newly authored demonstration sentences.
- **Model tooling:** the local exporter uses scikit-learn, NumPy, joblib and the source project's cleaning function. The website implements the TF-IDF / LinearSVC calculation in JavaScript; no Python library bundle is shipped to visitors.
- **Vision tooling:** the source experiment used PyTorch, torchvision and ImageNet-pretrained ResNet18. This site includes selected saved images and activation plots, not pretrained weights or torchvision code.

第三方资源遵循各自许可与来源说明。展示页面、已有实验记录、模型参数与原始数据的来源分开记录，详见 `PROVENANCE.md`。
