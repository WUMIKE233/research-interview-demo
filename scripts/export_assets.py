"""Export selected local research artifacts. No training; sources remain unchanged.

Usage: python scripts/export_assets.py --nlp-root PATH --vision-root PATH
       [--sklearn-path PATH]
Outputs are deterministic. The Python parity checkpoint resumes by model hash.
Only explicitly selected aggregate records and visualization assets are exported.
"""
from pathlib import Path
import argparse
import csv
import hashlib
import gzip
import json
import re
import shutil
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--nlp-root', required=True, type=Path)
parser.add_argument('--vision-root', required=True, type=Path)
parser.add_argument('--sklearn-path', type=Path)
args = parser.parse_args()
if args.sklearn_path:
    sys.path.insert(0, str(args.sklearn_path))
sys.path.insert(0, str(args.nlp_root / 'src'))
import joblib
import numpy as np
import sklearn
from news_classifier.data import clean_text

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
DATA = ASSETS / 'data'
MODEL = ASSETS / 'model'
VISION = ASSETS / 'vision'
LOCAL = ROOT / '.local'
VALIDATION = ROOT / 'validation'
for directory in (DATA, MODEL, VISION, LOCAL, VALIDATION):
    directory.mkdir(parents=True, exist_ok=True)

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def write_json(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

source = args.nlp_root / 'models/news_classifier.joblib'
model_hash = digest(source)
artifact = joblib.load(source)
pipeline = artifact['pipeline']
vectorizer = pipeline.named_steps['tfidf']
classifier = pipeline.named_steps['classifier']
assert sklearn.__version__ == '1.8.0', 'Export using the source sklearn version 1.8.0'
assert artifact['model_name'] == 'char_ngram_svm'
assert vectorizer.analyzer == 'char' and vectorizer.ngram_range == (2, 5)
assert vectorizer.norm == 'l2' and vectorizer.sublinear_tf and vectorizer.lowercase
assert vectorizer.preprocessor is None and vectorizer.strip_accents is None
vocab = vectorizer.get_feature_names_out().tolist()
classes = classifier.classes_.tolist()
idf = np.asarray(vectorizer.idf_, dtype='<f4')
coef = np.asarray(classifier.coef_, dtype='<f4')
intercept = np.asarray(classifier.intercept_, dtype='<f4')
weights = np.concatenate([idf.ravel(), coef.ravel(), intercept.ravel()])
weights.tofile(MODEL / 'weights.f32')
write_json(MODEL / 'vocabulary.json', vocab)
def split_payload(payload, prefix):
    parts = []
    for index, offset in enumerate(range(0, len(payload), 512 * 1024)):
        chunk = payload[offset:offset + 512 * 1024]
        filename = f'{prefix}-{index:02d}.bin'
        (MODEL / filename).write_bytes(chunk)
        parts.append({'file': filename, 'bytes': len(chunk), 'sha256': hashlib.sha256(chunk).hexdigest()})
    return parts
raw_bytes = (MODEL / 'weights.f32').read_bytes()
raw_parts = split_payload(raw_bytes, 'weights-raw')
compressed_parts = split_payload(gzip.compress(raw_bytes, compresslevel=9, mtime=0), 'weights-gzip')
write_json(MODEL / 'metadata.json', {
    'schema': 1, 'name': '字符 n-gram SVM', 'modelId': 'char_ngram_svm',
    'classes': classes, 'featureCount': len(vocab), 'ngramRange': [2, 5],
    'sublinearTf': True, 'norm': 'l2', 'lowercase': True,
    'format': 'float32-little-endian', 'layout': ['idf', 'class-major-coefficients', 'intercept'],
    'sourceSha256': model_hash, 'sklearnVersion': sklearn.__version__,
    'weightsSha256': digest(MODEL / 'weights.f32'), 'vocabularySha256': digest(MODEL / 'vocabulary.json'),
    'scoreMeaning': 'Uncalibrated LinearSVC decision score, not probability',
    'delivery': {'chunkBytes': 512 * 1024, 'compressedParts': compressed_parts, 'rawParts': raw_parts},
})

with (args.nlp_root / 'reports/all_model_comparison.csv').open(encoding='utf-8-sig') as f:
    metrics = [{k: (v if k == 'model' else float(v)) for k, v in r.items()} for r in csv.DictReader(f)]
with (args.nlp_root / 'reports/dataset_summary.csv').open(encoding='utf-8-sig') as f:
    counts = [{'label': r['label'], 'count': int(r['count'])} for r in csv.DictReader(f)]
report = (args.nlp_root / 'reports/char_ngram_svm_classification_report.txt').read_text(encoding='utf-8')
per_class = []
for line in report.splitlines():
    match = re.match(r'^\s*([\u4e00-\u9fff]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+(\d+)\s*$', line)
    if match:
        label, precision, recall, f1, support = match.groups()
        per_class.append({'label': label, 'precision': float(precision), 'recall': float(recall), 'f1': float(f1), 'support': int(support)})
assert len(per_class) == 15 and sum(x['support'] for x in per_class) == 8427
write_json(DATA / 'news.json', {
    'kind': 'saved-experiment-records', 'verifiedOn': '2026-09-25',
    'sampleCount': sum(r['count'] for r in counts), 'classCount': len(counts),
    'metrics': metrics, 'distribution': counts, 'classReport': per_class,
    'limitations': ['BERT的eval_dataset参与最佳checkpoint选择；结果不是独立测试结论。',
                    '不同模型的历史指标只作记录对照，本次没有重新训练或完整复评。'],
    'sources': ['all_model_comparison.csv', 'dataset_summary.csv', 'char_ngram_svm_classification_report.txt'],
    'datasetUrl': 'https://huggingface.co/datasets/fourteenBDr/toutiao',
})

features = json.loads((args.vision_root / 'outputs/feature_outputs.json').read_text(encoding='utf-8'))
predictions = json.loads((args.vision_root / 'outputs/predictions.json').read_text(encoding='utf-8'))
names = {
    'cifar_1_airplane.png': ('triangle', '合成飞机', 'airplane'),
    'cifar_2_automobile.png': ('vehicle', '合成汽车', 'automobile'),
    'cifar_3_bird.png': ('bird', '合成小鸟', 'bird'),
    'non_cifar_geometric_scene.png': ('geometry', '几何场景', 'out-of-distribution'),
}
samples = []
for original, (sample_id, title, kind) in names.items():
    input_name = sample_id + '.png'
    shutil.copy2(args.vision_root / 'data/input' / original, VISION / input_name)
    pred = next(r for r in predictions if r['image'] == original)
    layers = []
    for feat in [r for r in features if r['image'] == original]:
        layer = feat['layer']
        grid_name = f'{sample_id}-{layer}-channels.png'
        heat_name = f'{sample_id}-{layer}-heatmap.png'
        for key, target in [('channel_grid', grid_name), ('heatmap', heat_name)]:
            original_name = feat[key].replace('\\', '/').split('/')[-1]
            shutil.copy2(args.vision_root / 'outputs' / original_name, VISION / target)
        layers.append({'id': layer, 'shape': feat['shape'], 'channels': grid_name, 'heatmap': heat_name})
    samples.append({'id': sample_id, 'title': title, 'kind': kind, 'input': input_name,
                    'prediction': pred['predicted_class'], 'score': pred['confidence'], 'top3': pred['top3'], 'layers': layers})
write_json(DATA / 'vision.json', {
    'kind': 'saved-feature-visualizations', 'datasetMode': 'synthetic_cifar_like',
    'model': 'ImageNet预训练ResNet18 + 分类头训练', 'samples': samples,
    'note': '所有特征图来自已保存的合成数据运行；网页切换展示已有结果，不执行ResNet推理。',
    'sources': ['feature_outputs.json', 'predictions.json', 'run_summary.json'],
})

# Authored prompts and transformed combinations exercise preprocessing and TF-IDF.
# They are not copied news articles and are not an accuracy benchmark.
prompts = [
    '人工智能芯片研发取得新进展，云计算平台提升模型训练效率。',
    '球队在篮球决赛最后一节完成逆转，主教练称赞球员防守。',
    '农民采用节水灌溉种植水稻，农技专家指导病虫害防治。',
    '高校公布研究生招生计划，学生备战考试并申请奖学金。',
    '新能源汽车推出新款车型，电池续航和充电速度进一步提升。',
    '上市公司发布季度财报，股票成交量和证券市场指数上涨。',
    '博物馆举办传统书画展览，观众欣赏历史文物与艺术作品。',
    '城市开通新的公交线路，社区居民出行更加便利。',
    '游客参观海滨景区，酒店推出周末旅游优惠。',
    '房产市场推出新楼盘，购房者关注房价与贷款利率。',
    '导演和演员出席电影首映礼，观众讨论剧情与表演。',
    '游戏更新角色技能与地图，玩家讨论新版本竞技模式。',
    '多国代表参加国际会议，讨论经贸合作和地区局势。',
    '新型军用舰艇完成海上演练，检验雷达通信系统。',
    '银行调整存款利率，企业关注经济增长和融资成本。',
    '人工智能辅助篮球训练，算法分析球员的运动轨迹。',
    '芯片 芯片 芯片 科技 科技 2026 AI GPU',
    '<p>人工智能与科技</p> https://example.com/test?q=1 新产品',
    'ABC中文123\n\t科技！🙂',
    '经济，科技；文化。体育 / 教育',
    'abcdefgh xyz12345', '火', '', '!!!🙂',
]
cases = list(dict.fromkeys(prompts + [x + ' ' + x for x in prompts] + [x.upper() for x in prompts]
                           + [x[:12] for x in prompts] + [prompts[i] + prompts[(i+3) % len(prompts)] for i in range(len(prompts))]))
checkpoint = LOCAL / f'python-parity-{model_hash[:12]}.jsonl'
done = {}
if checkpoint.exists():
    for line in checkpoint.read_text(encoding='utf-8').splitlines():
        try:
            item = json.loads(line)
            done[item['text']] = item
        except json.JSONDecodeError:
            pass
with checkpoint.open('a', encoding='utf-8') as output:
    for text in cases:
        if text in done:
            continue
        cleaned = clean_text(text)
        matrix = vectorizer.transform([cleaned])
        scores = classifier.decision_function(matrix)[0]
        item = {'text': text, 'cleaned': cleaned, 'featureCount': int(matrix.nnz),
                'expected': str(classes[int(np.argmax(scores))]), 'scores': scores.tolist()}
        output.write(json.dumps(item, ensure_ascii=False) + '\n')
        output.flush()
        done[text] = item
write_json(VALIDATION / 'model-parity.json', {'modelHash': model_hash, 'sklearnVersion': sklearn.__version__, 'purpose': 'Export fidelity on authored inputs; not a classification benchmark', 'cases': [done[t] for t in cases]})
print(json.dumps({'sklearn': sklearn.__version__, 'features': len(vocab), 'classes': classes,
                  'weightsBytes': (MODEL/'weights.f32').stat().st_size, 'visionSamples': len(samples),
                  'parityCases': len(cases), 'sourceHash': model_hash}, ensure_ascii=False))
