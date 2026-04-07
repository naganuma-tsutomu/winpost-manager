"""
WinPost OCR Service
ウイニングポスト10 2025 のゲーム画面をTesseract(PSM指定)とOpenCV(二値化)で解析し、
幼駒評価データ・種牡馬情報・繁殖牝馬情報を構造化して返す。
"""
from __future__ import annotations

import io
import logging
import re
from typing import Optional, Dict

import cv2
import numpy as np
import pytesseract
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="WinPost OCR Service", version="1.0.0")

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
    bbox: list = []  # 互換性のため維持

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
# ROI定義 (仮の座標 / 1920x1080 用)
# ※必ず実際のゲーム画面に合わせて微調整してください。
#   x: X座標, y: Y座標, w: 幅, h: 高さ
#   psm: 7=1行のテキスト, 8=1単語, 6=ひとまとまりのテキストブロック
#   lang: "jpn" または "eng" (数字など)
#   invert: 白抜きの文字の場合は True にする
# ─────────────────────────────────────────

FOAL_ROI = {
    "name":        {"x": 200, "y": 100, "w": 400, "h": 50, "psm": 7, "lang": "jpn", "invert": False},
    "gender":      {"x": 200, "y": 150, "w": 100, "h": 40, "psm": 8, "lang": "jpn", "invert": False},
    "birthYear":   {"x": 300, "y": 150, "w": 150, "h": 40, "psm": 7, "lang": "jpn", "invert": False},
    "sireName":    {"x": 200, "y": 200, "w": 400, "h": 40, "psm": 7, "lang": "jpn", "invert": False},
    "damName":     {"x": 200, "y": 240, "w": 400, "h": 40, "psm": 7, "lang": "jpn", "invert": False},
    "growthType":  {"x": 200, "y": 280, "w": 200, "h": 40, "psm": 8, "lang": "jpn", "invert": False},
    "kappaMark":   {"x": 800, "y": 400, "w": 50,  "h": 50, "psm": 8, "lang": "jpn", "invert": False},
    "mikaMark":    {"x": 800, "y": 450, "w": 50,  "h": 50, "psm": 8, "lang": "jpn", "invert": False},
    "bodyComment": {"x": 200, "y": 500, "w": 600, "h": 100, "psm": 6, "lang": "jpn", "invert": False},
}

STALLION_ROI = {
    "name":        {"x": 200, "y": 100, "w": 400, "h": 50, "psm": 7, "lang": "jpn", "invert": False},
    "lineageName": {"x": 200, "y": 150, "w": 300, "h": 40, "psm": 7, "lang": "jpn", "invert": False},
    "speed":       {"x": 200, "y": 300, "w": 100, "h": 40, "psm": 8, "lang": "eng", "invert": False},
    "stamina":     {"x": 200, "y": 350, "w": 100, "h": 40, "psm": 8, "lang": "eng", "invert": False},
    "power":       {"x": 200, "y": 400, "w": 100, "h": 40, "psm": 8, "lang": "eng", "invert": False},
    "guts":        {"x": 300, "y": 300, "w": 100, "h": 40, "psm": 8, "lang": "eng", "invert": False},
    "wisdom":      {"x": 300, "y": 350, "w": 100, "h": 40, "psm": 8, "lang": "eng", "invert": False},
    "health":      {"x": 300, "y": 400, "w": 100, "h": 40, "psm": 8, "lang": "eng", "invert": False},
    "factors_area":{"x": 800, "y": 200, "w": 400, "h": 200, "psm": 6, "lang": "jpn", "invert": False},
}

MARE_ROI = {
    "name":        {"x": 200, "y": 100, "w": 400, "h": 50, "psm": 7, "lang": "jpn", "invert": False},
    "lineageName": {"x": 200, "y": 150, "w": 300, "h": 40, "psm": 7, "lang": "jpn", "invert": False},
    "speed":       {"x": 200, "y": 300, "w": 100, "h": 40, "psm": 8, "lang": "eng", "invert": False},
    "stamina":     {"x": 200, "y": 350, "w": 100, "h": 40, "psm": 8, "lang": "eng", "invert": False},
    "factors_area":{"x": 800, "y": 200, "w": 400, "h": 200, "psm": 6, "lang": "jpn", "invert": False},
}

# ─────────────────────────────────────────
# 画像前処理・OCR処理
# ─────────────────────────────────────────

def crop_image(img_array: np.ndarray, roi: Dict) -> np.ndarray:
    x, y, w, h = roi["x"], roi["y"], roi["w"], roi["h"]
    H, W = img_array.shape[:2]
    y1, y2 = max(0, y), min(H, y + h)
    x1, x2 = max(0, x), min(W, x + w)
    return img_array[y1:y2, x1:x2]

def preprocess_image(img_array: np.ndarray, invert: bool = False, threshold: int = 120) -> np.ndarray:
    """OpenCVで画像をグレースケール化＆二値化処理する"""
    if len(img_array.shape) == 3:
        # BGR (OpenCV) または RGB (PIL) をグレースケールへ
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
    else:
        gray = img_array

    # 二値化 (OTSUを使うと自動で閾値設定できるが、今回は固定値。調整可能)
    _, binary = cv2.threshold(gray, threshold, 255, cv2.THRESH_BINARY)
    
    if invert:
        binary = cv2.bitwise_not(binary)
        
    return binary

def run_tesseract(cropped_img: np.ndarray, psm: int = 7, lang: str = "jpn") -> tuple[str, float]:
    """Tesseractを実行し、テキストと信頼度を返す"""
    config = f"--psm {psm} --oem 3"
    
    # whitelist 数字のみの場合は精度が上がる
    if lang == "eng" and psm == 8:
        config += " -c tessedit_char_whitelist=0123456789"

    # image_to_data で抽出して信頼度を計算
    data = pytesseract.image_to_data(cropped_img, lang=lang, config=config, output_type=pytesseract.Output.DICT)
    
    text_parts = []
    conf_parts = []
    for i, conf in enumerate(data['conf']):
        c = int(conf)
        if c > 0:
            text_parts.append(data['text'][i])
            conf_parts.append(c)
            
    avg_conf = sum(conf_parts) / len(conf_parts) if conf_parts else 0.0
    text_result = "".join(text_parts).strip()
    return text_result, round(avg_conf / 100.0, 4)

def process_rois(img_array: np.ndarray, rois: Dict[str, Dict]) -> tuple[Dict[str, str], list[OcrRawResult], float]:
    results = {}
    raw_list = []
    confs = []

    for key, roi in rois.items():
        cropped = crop_image(img_array, roi)
        processed = preprocess_image(cropped, invert=roi.get("invert", False))
        
        text, conf = run_tesseract(processed, psm=roi.get("psm", 7), lang=roi.get("lang", "jpn"))
        
        logger.info(f"ROI [{key}]: extracted '{text}' (conf: {conf})")
        results[key] = text
        raw_list.append(OcrRawResult(key=key, text=text, confidence=conf))
        if conf > 0:
            confs.append(conf)

    total_conf = sum(confs) / len(confs) if confs else 0.0
    return results, raw_list, round(total_conf, 4)


# ─────────────────────────────────────────
# テキスト解決ロジック (解析結果文字列からの抽出)
# ─────────────────────────────────────────

def detect_eval_mark(text: str) -> str:
    if re.search(r"◎|⊚|◉|@|©|回", text): return "DOUBLE_CIRCLE"
    if re.search(r"○|〇|Ｏ|O|o|0|０|◯|Q|C", text): return "CIRCLE"
    if re.search(r"▲|△|A", text): return "TRIANGLE"
    return "NONE"

def detect_growth_type(text: str) -> Optional[str]:
    if "超早熟" in text: return "SUPER_EARLY"
    if "早熟" in text: return "EARLY"
    if "晩成" in text: return "LATE"
    if "超晩成" in text: return "SUPER_LATE"
    if re.search(r"普通|標準", text): return "NORMAL"
    return None

def detect_gender(text: str) -> Optional[str]:
    if re.search(r"牡|♂", text): return "MALE"
    if re.search(r"牝|♀", text): return "FEMALE"
    return None

def extract_factors(text: str) -> list[str]:
    factors = set()
    mappings = {
        "GREAT_SIRE": r"大種牡馬|大種牡",
        "FAMOUS_SIRE": r"名種牡馬|名種牡",
        "SPEED": r"スピード",
        "STAMINA": r"スタミナ",
        "POWER": r"パワー",
        "TENACITY": r"根性|勝負根性",
        "AGILITY": r"瞬発力",
        "HEALTH": r"健康",
        "SPIRIT": r"精神力",
        "WISDOM": r"賢さ",
    }
    for key, pat in mappings.items():
        if re.search(pat, text):
            factors.add(key)
    return list(factors)

def parse_number(text: str) -> Optional[int]:
    m = re.search(r"\b([0-9]{1,3})\b", text)
    if m:
        return int(m.group(1))
    return None


def parse_foal(extracted: Dict[str, str]) -> FoalData:
    foal = FoalData()
    foal.name = extracted.get("name", "")
    foal.gender = detect_gender(extracted.get("gender", ""))
    
    # birthYear parsing (extract year numbers like 1983 or 83 -> 1983)
    y_str = extracted.get("birthYear", "")
    m_year = re.search(r"(19[89]\d|20[0-9]\d)", y_str)
    if m_year:
        foal.birthYear = int(m_year.group(1))
    
    foal.sireName = extracted.get("sireName", "").replace("父", "").replace(":", "").replace("：", "").strip()
    foal.damName = extracted.get("damName", "").replace("母", "").replace(":", "").replace("：", "").strip()
    
    foal.growthType = detect_growth_type(extracted.get("growthType", ""))
    foal.kappaMark = detect_eval_mark(extracted.get("kappaMark", ""))
    foal.mikaMark = detect_eval_mark(extracted.get("mikaMark", ""))
    foal.bodyComment = extracted.get("bodyComment", "")
    return foal

def parse_stallion(extracted: Dict[str, str]) -> StallionData:
    st = StallionData()
    st.name = extracted.get("name", "")
    st.lineageName = extracted.get("lineageName", "")
    st.speed = parse_number(extracted.get("speed", ""))
    st.stamina = parse_number(extracted.get("stamina", ""))
    st.power = parse_number(extracted.get("power", ""))
    st.guts = parse_number(extracted.get("guts", ""))
    st.wisdom = parse_number(extracted.get("wisdom", ""))
    st.health = parse_number(extracted.get("health", ""))
    st.factors = extract_factors(extracted.get("factors_area", ""))
    return st

def parse_mare(extracted: Dict[str, str]) -> MareData:
    ma = MareData()
    ma.name = extracted.get("name", "")
    ma.lineageName = extracted.get("lineageName", "")
    ma.speed = parse_number(extracted.get("speed", ""))
    ma.stamina = parse_number(extracted.get("stamina", ""))
    ma.factors = extract_factors(extracted.get("factors_area", ""))
    return ma


# ─────────────────────────────────────────
# API エンドポイント
# ─────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "winpost-ocr"}


@app.post("/ocr/foal", response_model=OcrResponse)
async def ocr_foal(
    file: UploadFile = File(..., description="ゲームのスクリーンショット画像"),
):
    data = await file.read()
    img = Image.open(io.BytesIO(data)).convert("RGB")
    img_array = np.array(img)

    extracted, raw_list, conf = process_rois(img_array, FOAL_ROI)
    foal = parse_foal(extracted)
    return OcrResponse(raw=raw_list, foal=foal, confidence=conf)

@app.post("/ocr/stallion", response_model=StallionOcrResponse)
async def ocr_stallion(
    file: UploadFile = File(..., description="種牡馬情報画面のスクリーンショット"),
):
    data = await file.read()
    img = Image.open(io.BytesIO(data)).convert("RGB")
    img_array = np.array(img)

    extracted, raw_list, conf = process_rois(img_array, STALLION_ROI)
    stallion = parse_stallion(extracted)
    return StallionOcrResponse(raw=raw_list, stallion=stallion, confidence=conf)

@app.post("/ocr/mare", response_model=MareOcrResponse)
async def ocr_mare(
    file: UploadFile = File(..., description="繁殖牝馬情報画面のスクリーンショット"),
):
    data = await file.read()
    img = Image.open(io.BytesIO(data)).convert("RGB")
    img_array = np.array(img)

    extracted, raw_list, conf = process_rois(img_array, MARE_ROI)
    mare = parse_mare(extracted)
    return MareOcrResponse(raw=raw_list, mare=mare, confidence=conf)

@app.post("/ocr/raw")
async def ocr_raw(
    file: UploadFile = File(...),
):
    """生の OCR デバッグ用。全画面を PSM 6 で読み取る（重いため非推奨）"""
    data = await file.read()
    img = Image.open(io.BytesIO(data)).convert("RGB")
    img_array = np.array(img)
    
    processed = preprocess_image(img_array)
    text, conf = run_tesseract(processed, psm=6, lang="jpn")

    return {
        "text": text,
        "confidence": conf
    }
