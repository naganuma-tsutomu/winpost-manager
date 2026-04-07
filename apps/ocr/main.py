"""
WinPost OCR Service
ウイニングポスト10 2025 のゲーム画面をTesseractで解析し、
幼駒評価データ・種牡馬情報・繁殖牝馬情報を構造化して返す。

改善点:
  - 全画面OCR + 正規表現パースを主軸にすることでROI座標依存を排除
  - 適応的二値化(AdaptiveThreshold) + 2倍アップスケールで精度向上
  - 緑ヘッダーバーをHSV色検出して馬名を高精度に抽出
"""
from __future__ import annotations

import io
import logging
import re
from typing import Optional, Dict, List, Tuple

import cv2
import numpy as np
import pytesseract
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="WinPost OCR Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────
# レスポンス型
# ─────────────────────────────────────────

class OcrRawResult(BaseModel):
    key: str
    text: str
    confidence: float
    bbox: list = []

class FoalData(BaseModel):
    name: Optional[str] = None
    gender: Optional[str] = None          # MALE / FEMALE
    birthYear: Optional[int] = None
    sireName: Optional[str] = None
    damName: Optional[str] = None
    kappaMark: Optional[str] = None
    mikaMark: Optional[str] = None
    growthType: Optional[str] = None
    bodyComment: Optional[str] = None
    memo: Optional[str] = None

class StallionData(BaseModel):
    name: Optional[str] = None
    lineageName: Optional[str] = None
    speed: Optional[int] = None
    stamina: Optional[int] = None
    power: Optional[int] = None
    guts: Optional[int] = None
    wisdom: Optional[int] = None
    health: Optional[int] = None
    factors: list[str] = []

class MareData(BaseModel):
    name: Optional[str] = None
    lineageName: Optional[str] = None
    speed: Optional[int] = None
    stamina: Optional[int] = None
    factors: list[str] = []

class OcrResponse(BaseModel):
    raw: list[OcrRawResult]
    foal: FoalData
    confidence: float

class StallionOcrResponse(BaseModel):
    raw: list[OcrRawResult]
    stallion: StallionData
    confidence: float

class MareOcrResponse(BaseModel):
    raw: list[OcrRawResult]
    mare: MareData
    confidence: float

# ─────────────────────────────────────────
# 画像前処理
# ─────────────────────────────────────────

def upscale(img: np.ndarray, scale: float = 2.0) -> np.ndarray:
    """OCR精度向上のため拡大する"""
    h, w = img.shape[:2]
    return cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)

def to_gray(img: np.ndarray) -> np.ndarray:
    if len(img.shape) == 3:
        return cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    return img

def preprocess_adaptive(img: np.ndarray, scale: float = 2.0, invert: bool = False) -> np.ndarray:
    """適応的二値化 + アップスケール (メイン前処理)"""
    gray = to_gray(img)
    if scale != 1.0:
        gray = upscale(gray, scale)
    denoised = cv2.fastNlMeansDenoising(gray, h=10)
    binary = cv2.adaptiveThreshold(
        denoised, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=15, C=8,
    )
    if invert:
        binary = cv2.bitwise_not(binary)
    return binary

def preprocess_otsu(img: np.ndarray, scale: float = 2.0, invert: bool = False) -> np.ndarray:
    """OTSU二値化 (白抜き文字など補助的に使用)"""
    gray = to_gray(img)
    if scale != 1.0:
        gray = upscale(gray, scale)
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    if invert:
        binary = cv2.bitwise_not(binary)
    return binary

# ─────────────────────────────────────────
# 相対座標ROI (1456x816 実測値から算出)
# 座標は画像幅・高さに対する比率で表現するため解像度非依存
#
# 計測基準画像: WinPost10 2025 幼駒評価画面 (1456x816)
#   ヘッダー (黒緑帯):  y=0-42
#   上部白エリア:       y=43-428
#   下部緑エリア:       y=429-816
#   評価印列:           x=1108-1290
# ─────────────────────────────────────────

FOAL_ROI_REL = {
    # (rx, ry, rw, rh) — 全て 0.0〜1.0 の比率
    "name":       (0.047, 0.002, 0.364, 0.049),   # ヘッダー左:  馬名
    "gender":     (0.614, 0.002, 0.140, 0.049),   # ヘッダー右:  性別・毛色
    "sireName":   (0.076, 0.172, 0.260, 0.051),   # 父名テキスト
    "kappaMark":  (0.853, 0.806, 0.028, 0.037),   # 河童木 印記号
    "mikaMark":   (0.853, 0.893, 0.028, 0.037),   # 美香   印記号
    "kappaCombined": (0.763, 0.795, 0.120, 0.048),# 河童木ラベル+印まで
    "mikaCombined":  (0.763, 0.882, 0.120, 0.048),# 美香ラベル+印まで
}

def crop_by_rel(img: np.ndarray, rx: float, ry: float, rw: float, rh: float) -> np.ndarray:
    """相対座標で画像をクロップする"""
    H, W = img.shape[:2]
    x1 = int(rx * W)
    y1 = int(ry * H)
    x2 = min(W, int((rx + rw) * W))
    y2 = min(H, int((ry + rh) * H))
    return img[y1:y2, x1:x2]

def ocr_symbol_roi(img: np.ndarray, roi_key: str) -> Tuple[str, float]:
    """
    相対座標ROIで小さな印記号（◎○△－）を精密OCR。
    評価印はヘッダーと異なり白背景に黒文字なので通常の前処理を使う。
    """
    if roi_key not in FOAL_ROI_REL:
        return "", 0.0

    roi = FOAL_ROI_REL[roi_key]
    crop = crop_by_rel(img, *roi)
    if crop.size == 0:
        return "", 0.0

    # 3倍アップスケール + 適応的二値化
    processed = preprocess_adaptive(crop, scale=3.0, invert=False)

    sh, sw = processed.shape[:2]
    if sh < 10 or sw < 10:
        logger.info(f"Symbol ROI [{roi_key}]: image too small, skipping")
        return "", 0.0

    try:
        config = "--psm 6 --oem 3"   # PSM 6 = テキストブロック (PSM 10 より安定)
        data = pytesseract.image_to_data(
            processed, lang="jpn", config=config, output_type=pytesseract.Output.DICT
        )
        words, confs = [], []
        for i, c in enumerate(data["conf"]):
            ci = int(c)
            if ci > 0 and data["text"][i].strip():
                words.append(data["text"][i])
                confs.append(ci)
        text = "".join(words).strip()
        conf = (sum(confs) / len(confs) / 100.0) if confs else 0.0
    except Exception as e:
        logger.warning(f"Symbol ROI [{roi_key}] OCR failed: {e}")
        return "", 0.0

    logger.info(f"Symbol ROI [{roi_key}]: '{text}' (conf={conf:.2f})")
    return text, conf

def extract_eval_marks_by_roi(img_array: np.ndarray) -> Dict[str, str]:
    """
    評価印（河童木・美香）を相対座標ROIで抽出。
    ラベル+印の広めの領域を OCR してパースする方式を採用
    (記号単体だと Tesseract が認識しにくいため)。
    """
    results: Dict[str, str] = {}
    for key, mark_key in [("kappaMark", "kappaCombined"), ("mikaMark", "mikaCombined")]:
        text, _ = ocr_symbol_roi(img_array, mark_key)
        results[key] = detect_eval_mark(text)
        logger.info(f"Eval mark [{key}] from ROI '{text}' → {results[key]}")
    return results

def extract_header_dark_text(img_array: np.ndarray, rx: float, ry: float, rw: float, rh: float) -> str:
    """
    ヘッダーバーの暗背景・白文字領域をROIで直接OCRする。
    性別 (牡/牝) などヘッダー右側にある情報の取得に使う。
    """
    crop = crop_by_rel(img_array, rx, ry, rw, rh)
    if crop.size == 0:
        return ""
    gray = to_gray(crop)
    scaled = upscale(gray, 3.0)
    # 白文字 on 暗背景 → 反転二値化
    _, binary = cv2.threshold(scaled, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    try:
        config = "--psm 7 --oem 3"
        text = pytesseract.image_to_string(binary, lang="jpn", config=config).strip()
        logger.info(f"Header dark ROI ({rx:.2f},{ry:.2f}): '{text}'")
        return text
    except Exception as e:
        logger.warning(f"Header dark ROI OCR failed: {e}")
        return ""

# ─────────────────────────────────────────
# 色検出: 緑ヘッダーバーから馬名を抽出
# ─────────────────────────────────────────

def extract_green_header(img_array: np.ndarray) -> Tuple[str, float]:
    """
    WinPost の緑ヘッダーバー(馬名が書いてある帯)を HSV で検出し、
    その領域だけ OCR する。白文字なので反転二値化する。

    ヘッダーバーは画像上部 15% に必ず存在する。
    下部のナビバーと混同しないよう検索範囲を上部に限定する。
    """
    H, W = img_array.shape[:2]
    # 上部 15% のみを検索対象にする
    search_h = max(1, int(H * 0.15))
    search_area = img_array[:search_h, :]

    hsv = cv2.cvtColor(search_area, cv2.COLOR_RGB2HSV)
    # WinPost ヘッダーの暗い緑〜黒緑 (Saturation が低めの暗い緑)
    lower = np.array([30, 20, 20])
    upper = np.array([100, 255, 180])
    mask = cv2.inRange(hsv, lower, upper)

    # ノイズ除去
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 3))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        logger.info("Green header: no contour found in top 15%")
        return "", 0.0

    # 最も横に長い領域 = ヘッダーバー
    best = max(contours, key=lambda c: cv2.boundingRect(c)[2])
    x, y, w, h = cv2.boundingRect(best)
    logger.info(f"Green header bbox (in search_area): x={x} y={y} w={w} h={h}")

    # 元画像の座標は search_area 内のまま (y < search_h が保証される)

    if w < 50 or h < 10:
        return "", 0.0

    roi = search_area[y : y + h, x : x + w]
    # 白文字 on 緑背景 → グレースケールにして OTSU 反転
    gray = to_gray(roi)
    scaled = upscale(gray, 3.0)
    sh, sw = scaled.shape[:2]
    if sh < 10 or sw < 10:
        logger.info("Green header: scaled image too small, skipping OCR")
        return "", 0.0

    _, binary = cv2.threshold(scaled, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    try:
        config = "--psm 7 --oem 3"
        data = pytesseract.image_to_data(
            binary, lang="jpn", config=config, output_type=pytesseract.Output.DICT
        )
        words, confs = [], []
        for i, c in enumerate(data["conf"]):
            ci = int(c)
            if ci > 0 and data["text"][i].strip():
                words.append(data["text"][i])
                confs.append(ci)
        text = "".join(words).strip()
        conf = (sum(confs) / len(confs) / 100.0) if confs else 0.0
    except Exception as e:
        logger.warning(f"Green header OCR failed: {e}")
        return "", 0.0

    logger.info(f"Green header OCR: '{text}' (conf={conf:.2f})")
    return text, conf

# ─────────────────────────────────────────
# 全画面 OCR (メイン手法)
# ─────────────────────────────────────────

def full_image_ocr(img_array: np.ndarray) -> Tuple[str, List[OcrRawResult], float]:
    """
    画像全体を PSM 6 で OCR し、テキストと行単位の raw 結果を返す。
    """
    processed = preprocess_adaptive(img_array, scale=2.0)
    config = "--psm 6 --oem 3"
    data = pytesseract.image_to_data(
        processed, lang="jpn+eng", config=config, output_type=pytesseract.Output.DICT
    )

    # 行ごとにテキストを結合
    lines: Dict[Tuple[int, int, int], List[str]] = {}
    confs_all: List[int] = []
    for i, conf in enumerate(data["conf"]):
        ci = int(conf)
        word = data["text"][i].strip()
        if ci > 0 and word:
            key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
            lines.setdefault(key, []).append(word)
            confs_all.append(ci)

    raw_list: List[OcrRawResult] = []
    full_lines: List[str] = []
    for idx, (k, words) in enumerate(sorted(lines.items())):
        line_text = " ".join(words)
        full_lines.append(line_text)
        raw_list.append(OcrRawResult(key=f"line_{idx}", text=line_text, confidence=0.0))

    full_text = "\n".join(full_lines)
    avg_conf = (sum(confs_all) / len(confs_all) / 100.0) if confs_all else 0.0
    logger.info(f"Full OCR done: {len(full_lines)} lines, conf={avg_conf:.2f}")
    # INFO レベルで全テキストを出力 (デバッグ用)
    logger.info(f"Full OCR text:\n{full_text}")
    return full_text, raw_list, round(avg_conf, 4)

# ─────────────────────────────────────────
# テキスト解析ロジック
# ─────────────────────────────────────────

def detect_eval_mark(text: str) -> str:
    if re.search(r"◎|⊚|◉|@|©|回", text):
        return "DOUBLE_CIRCLE"
    if re.search(r"○|〇|Ｏ|◯|Q", text):
        return "CIRCLE"
    if re.search(r"▲|△", text):
        return "TRIANGLE"
    return "NONE"

def detect_growth_type(text: str) -> Optional[str]:
    if "超晩成" in text: return "SUPER_LATE"
    if "超早熟" in text: return "SUPER_EARLY"
    if "晩成" in text:   return "LATE"
    if "早熟" in text:   return "EARLY"
    if re.search(r"普通|標準", text): return "NORMAL"
    return None

def detect_gender(text: str) -> Optional[str]:
    if re.search(r"牡|♂", text): return "MALE"
    if re.search(r"牝|♀", text): return "FEMALE"
    return None

def extract_factors(text: str) -> list[str]:
    factors: set[str] = set()
    mappings = {
        "GREAT_SIRE":  r"大種牡馬|大種牡",
        "FAMOUS_SIRE": r"名種牡馬|名種牡",
        "SPEED":       r"スピード",
        "STAMINA":     r"スタミナ",
        "POWER":       r"パワー",
        "TENACITY":    r"根性|勝負根性",
        "AGILITY":     r"瞬発力",
        "HEALTH":      r"健康",
        "SPIRIT":      r"精神力",
        "WISDOM":      r"賢さ",
    }
    for key, pat in mappings.items():
        if re.search(pat, text):
            factors.add(key)
    return list(factors)

def parse_number(text: str) -> Optional[int]:
    m = re.search(r"\b([0-9]{1,3})\b", text)
    return int(m.group(1)) if m else None

# ─────────────────────────────────────────
# 幼駒パーサー (全画面OCRテキスト + 緑ヘッダー結果を受け取る)
# ─────────────────────────────────────────

# 除外ワード: これらが含まれる行は馬名・親名として採用しない
_NOISE_WORDS = [
    "評価額", "取引額", "円", "調教", "生産", "馬主", "繁養", "リーディング",
    "週", "月", "基本", "能力", "スピード", "パワー", "根性", "賢さ", "健康",
    "コメント", "メモ", "詳細", "血統", "牧場", "出身", "取引",
]

def _clean_name(raw: str) -> str:
    """OCRノイズ文字を除去して馬名っぽい文字列に整形"""
    # 記号ゴミを除去
    cleaned = re.sub(r"[「」『』【】\[\]（）()｜|＼/\\]", "", raw)
    cleaned = cleaned.strip()
    # カタカナ主体の名前に末尾ひらがなノイズが付く場合は除去
    # 例: "バクスアメリカーナん" → "バクスアメリカーナ"
    katakana_count = len(re.findall(r"[ァ-ヴー]", cleaned))
    if katakana_count >= 3:
        cleaned = re.sub(r"[ぁ-ん]+$", "", cleaned)
    return cleaned

def parse_foal_from_ocr(full_text: str, header_text: str, roi_marks: Optional[Dict[str, str]] = None) -> FoalData:
    foal = FoalData()
    lines = [ln.strip() for ln in full_text.split("\n") if ln.strip()]

    # ── 馬名: 緑ヘッダーから優先取得 ──
    if header_text:
        # ヘッダーには "馬名 性別 毛色" が並ぶ → 最初のカタカナ/漢字ブロックが馬名
        m = re.search(r"([ぁ-ヴー一-龯]+(?:\d{1,2})?)", header_text)
        if m:
            foal.name = _clean_name(m.group(1))
        # 性別もヘッダーから
        if not foal.gender:
            foal.gender = detect_gender(header_text)

    # ── 父馬 ──
    for line in lines:
        if re.search(r"父", line):
            m = re.search(r"父[：:　\s]*([ぁ-ヴー一-龯A-Za-zａ-ｚＡ-Ｚ・]+(?:\s+[ぁ-ヴー一-龯A-Za-zａ-ｚＡ-Ｚ・]+)*)", line)
            if m:
                # OCRが空白で単語を分割している場合も連結して取得
                raw = re.sub(r"\s+", "", m.group(1))
                name = _clean_name(raw)
                if len(name) >= 2:
                    foal.sireName = name
                    break

    # ── 母馬 ──
    for line in lines:
        if re.search(r"母", line) and "父" not in line:
            m = re.search(r"母[：:　\s]*([ぁ-ヴー一-龯A-Za-zａ-ｚＡ-Ｚ・]+(?:\s+[ぁ-ヴー一-龯A-Za-zａ-ｚＡ-Ｚ・]+)*)", line)
            if m:
                raw = re.sub(r"\s+", "", m.group(1))
                name = _clean_name(raw)
                if len(name) >= 2:
                    foal.damName = name
                    break

    # ── 性別 (ヘッダーで未取得の場合) ──
    if not foal.gender:
        for line in lines:
            g = detect_gender(line)
            if g:
                foal.gender = g
                break

    # ── 誕生年 ──
    for line in lines:
        m = re.search(r"(19[89]\d|20[012]\d)", line)
        if m:
            foal.birthYear = int(m.group(1))
            break

    # ── 成長型 ──
    for line in lines:
        gt = detect_growth_type(line)
        if gt:
            foal.growthType = gt
            break

    # ── 評価印 (河童木・美香): ROI が NONE でなければ使用、それ以外は全文検索 ──
    if roi_marks:
        k = roi_marks.get("kappaMark", "NONE")
        m = roi_marks.get("mikaMark", "NONE")
        if k != "NONE":
            foal.kappaMark = k
        if m != "NONE":
            foal.mikaMark = m

    # ROI で取れなかった場合は全文 OCR から探す
    if not foal.kappaMark or foal.kappaMark == "NONE":
        for line in lines:
            if re.search(r"河童|かっぱ|カッパ", line):
                foal.kappaMark = detect_eval_mark(line)
                break
    if not foal.mikaMark or foal.mikaMark == "NONE":
        for line in lines:
            if re.search(r"美香|みか|ミカ", line):
                foal.mikaMark = detect_eval_mark(line)
                break

    # ── 馬体コメント ──
    for i, line in enumerate(lines):
        if re.search(r"コメント|comment", line, re.IGNORECASE):
            if i + 1 < len(lines):
                foal.bodyComment = lines[i + 1]
            break

    logger.info(f"Parsed foal: {foal}")
    return foal

def parse_stallion_from_ocr(full_text: str, header_text: str) -> StallionData:
    st = StallionData()
    lines = [ln.strip() for ln in full_text.split("\n") if ln.strip()]

    if header_text:
        m = re.search(r"([ぁ-ヴー一-龯]+(?:\d{1,2})?)", header_text)
        if m:
            st.name = _clean_name(m.group(1))

    # 系統
    for line in lines:
        if re.search(r"系統|系", line):
            m = re.search(r"([ぁ-ヴー一-龯]+系)", line)
            if m:
                st.lineageName = m.group(1)
                break

    # 能力値: "スピード: 80" のようなパターン
    ability_map = {
        "speed":   r"スピード",
        "stamina": r"スタミナ",
        "power":   r"パワー",
        "guts":    r"根性",
        "wisdom":  r"賢さ",
        "health":  r"健康",
    }
    for line in lines:
        for attr, pat in ability_map.items():
            if re.search(pat, line) and getattr(st, attr) is None:
                n = parse_number(line)
                if n:
                    setattr(st, attr, n)

    st.factors = extract_factors(full_text)
    return st

def parse_mare_from_ocr(full_text: str, header_text: str) -> MareData:
    ma = MareData()
    lines = [ln.strip() for ln in full_text.split("\n") if ln.strip()]

    if header_text:
        m = re.search(r"([ぁ-ヴー一-龯]+(?:\d{1,2})?)", header_text)
        if m:
            ma.name = _clean_name(m.group(1))

    for line in lines:
        if re.search(r"系統|系", line):
            m = re.search(r"([ぁ-ヴー一-龯]+系)", line)
            if m:
                ma.lineageName = m.group(1)
                break

    for line in lines:
        if re.search(r"スピード", line) and ma.speed is None:
            ma.speed = parse_number(line)
        if re.search(r"スタミナ", line) and ma.stamina is None:
            ma.stamina = parse_number(line)

    ma.factors = extract_factors(full_text)
    return ma

# ─────────────────────────────────────────
# API エンドポイント
# ─────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "winpost-ocr"}

@app.get("/ready")
def ready_check():
    return {"ready": True}

@app.post("/ocr/foal", response_model=OcrResponse)
async def ocr_foal(file: UploadFile = File(...)):
    data = await file.read()
    img = Image.open(io.BytesIO(data)).convert("RGB")
    img_array = np.array(img)
    logger.info(f"Image size: {img_array.shape[1]}x{img_array.shape[0]}")

    header_text, header_conf = extract_green_header(img_array)
    full_text, raw_list, conf = full_image_ocr(img_array)

    # ヘッダー右側 (性別エリア) を暗背景ROIで直接取得
    # 性別 "牝0" "牡0" はヘッダーバーの右側・暗背景部分にある
    gender_text = extract_header_dark_text(img_array, rx=0.53, ry=0.0, rw=0.16, rh=0.055)
    header_gender = detect_gender(gender_text) if gender_text else None

    # ヘッダー結果を raw に追加
    raw_list.insert(0, OcrRawResult(key="green_header", text=header_text, confidence=header_conf))
    raw_list.insert(1, OcrRawResult(key="gender_roi", text=gender_text, confidence=0.0))

    roi_marks = extract_eval_marks_by_roi(img_array)
    foal = parse_foal_from_ocr(full_text, header_text, roi_marks)

    # ROIで取得した性別を優先
    if header_gender:
        foal.gender = header_gender

    # 信頼度: ヘッダー検出できた場合は少し加点
    combined_conf = round((conf + (header_conf * 0.3 if header_text else 0)) / (1.3 if header_text else 1.0), 4)
    return OcrResponse(raw=raw_list, foal=foal, confidence=combined_conf)

@app.post("/ocr/stallion", response_model=StallionOcrResponse)
async def ocr_stallion(file: UploadFile = File(...)):
    data = await file.read()
    img = Image.open(io.BytesIO(data)).convert("RGB")
    img_array = np.array(img)

    header_text, _ = extract_green_header(img_array)
    full_text, raw_list, conf = full_image_ocr(img_array)
    raw_list.insert(0, OcrRawResult(key="green_header", text=header_text, confidence=0.0))

    stallion = parse_stallion_from_ocr(full_text, header_text)
    return StallionOcrResponse(raw=raw_list, stallion=stallion, confidence=conf)

@app.post("/ocr/mare", response_model=MareOcrResponse)
async def ocr_mare(file: UploadFile = File(...)):
    data = await file.read()
    img = Image.open(io.BytesIO(data)).convert("RGB")
    img_array = np.array(img)

    header_text, _ = extract_green_header(img_array)
    full_text, raw_list, conf = full_image_ocr(img_array)
    raw_list.insert(0, OcrRawResult(key="green_header", text=header_text, confidence=0.0))

    mare = parse_mare_from_ocr(full_text, header_text)
    return MareOcrResponse(raw=raw_list, mare=mare, confidence=conf)

@app.post("/ocr/raw")
async def ocr_raw(file: UploadFile = File(...)):
    """デバッグ用: 全画面生テキストを返す"""
    data = await file.read()
    img = Image.open(io.BytesIO(data)).convert("RGB")
    img_array = np.array(img)

    full_text, _, conf = full_image_ocr(img_array)
    return {"text": full_text, "confidence": conf}
