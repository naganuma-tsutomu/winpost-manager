"""
WinPost OCR Service
ウイニングポスト10 2025 のゲーム画面をEasyOCRで解析し、
幼駒評価データ・種牡馬情報・繁殖牝馬情報を構造化して返す。
"""
from __future__ import annotations

import io
import logging
import re
from typing import Optional

import easyocr
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
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

# EasyOCR リーダー（起動時に一度だけ初期化）
_reader: Optional[easyocr.Reader] = None


def get_reader() -> easyocr.Reader:
    global _reader
    if _reader is None:
        logger.info("EasyOCR reader を初期化中（初回起動は時間がかかります）...")
        _reader = easyocr.Reader(["ja", "en"], gpu=False)
        logger.info("EasyOCR reader の初期化完了")
    return _reader


# ─────────────────────────────────────────
# レスポンス型
# ─────────────────────────────────────────

class OcrRawResult(BaseModel):
    text: str
    confidence: float
    bbox: list


class FoalData(BaseModel):
    """幼駒評価シートから抽出した構造化データ"""
    name: Optional[str] = None
    gender: Optional[str] = None          # MALE / FEMALE
    birthYear: Optional[int] = None
    sireName: Optional[str] = None        # 父馬名
    damName: Optional[str] = None         # 母馬名
    kappaMark: Optional[str] = None       # DOUBLE_CIRCLE / CIRCLE / TRIANGLE / NONE
    mikaMark: Optional[str] = None        # 同上
    growthType: Optional[str] = None      # SUPER_EARLY / EARLY / NORMAL / LATE / SUPER_LATE
    bodyComment: Optional[str] = None     # 馬体コメント
    memo: Optional[str] = None


class StallionData(BaseModel):
    """種牡馬情報画面から抽出した構造化データ"""
    name: Optional[str] = None
    lineageName: Optional[str] = None     # 系統名（テキスト）
    speed: Optional[int] = None
    stamina: Optional[int] = None
    power: Optional[int] = None
    guts: Optional[int] = None           # 勝負根性
    wisdom: Optional[int] = None         # 賢さ
    health: Optional[int] = None         # 健康
    factors: list[str] = []              # SPEED / STAMINA / POWER / etc.


class MareData(BaseModel):
    """繁殖牝馬情報画面から抽出した構造化データ"""
    name: Optional[str] = None
    lineageName: Optional[str] = None     # 系統名（テキスト）
    speed: Optional[int] = None
    stamina: Optional[int] = None
    factors: list[str] = []


class OcrResponse(BaseModel):
    raw: list[OcrRawResult]
    foal: FoalData
    confidence: float                     # 全体信頼度 (0.0〜1.0)


class StallionOcrResponse(BaseModel):
    raw: list[OcrRawResult]
    stallion: StallionData
    confidence: float


class MareOcrResponse(BaseModel):
    raw: list[OcrRawResult]
    mare: MareData
    confidence: float


# ─────────────────────────────────────────
# 印・成長型のパターン（共通）
# ─────────────────────────────────────────

EVAL_MARK_PATTERNS = {
    "DOUBLE_CIRCLE": re.compile(r"◎|⊚|◉|@|©|回"),
    "CIRCLE":        re.compile(r"○|〇|Ｏ|O|o|0|０|◯|Q|C"),
    "TRIANGLE":      re.compile(r"▲|△|A"),
}

GROWTH_TYPE_PATTERNS = {
    "SUPER_EARLY": re.compile(r"超早熟"),
    "EARLY":       re.compile(r"早熟"),
    "NORMAL":      re.compile(r"普通|標準"),
    "LATE":        re.compile(r"晩成"),
    "SUPER_LATE":  re.compile(r"超晩成"),
}

GENDER_PATTERNS = {
    "MALE":   re.compile(r"牡|♂|社"),
    "FEMALE": re.compile(r"牝|♀|牝馬|北口|北[0O○〇]"),
}

# WP10のゲーム年度 (1983〜)
YEAR_PATTERN = re.compile(r"(19[89]\d|20[0-9]\d)年")

# 因子パターン: OCR上のテキストとenumキーのマッピング
FACTOR_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"大種牡馬|大種牡"), "GREAT_SIRE"),
    (re.compile(r"名種牡馬|名種牡"), "FAMOUS_SIRE"),
    (re.compile(r"スピード"), "SPEED"),
    (re.compile(r"スタミナ"), "STAMINA"),
    (re.compile(r"パワー"), "POWER"),
    (re.compile(r"根性|勝負根性"), "TENACITY"),
    (re.compile(r"瞬発力"), "AGILITY"),
    (re.compile(r"健康"), "HEALTH"),
    (re.compile(r"精神力"), "SPIRIT"),
    (re.compile(r"賢さ"), "WISDOM"),
]

# 能力値ラベルのパターン
ABILITY_LABEL_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"スピード"), "speed"),
    (re.compile(r"スタミナ"), "stamina"),
    (re.compile(r"パワー"), "power"),
    (re.compile(r"勝負根性|根性"), "guts"),
    (re.compile(r"瞬発力|賢さ"), "wisdom"),
    (re.compile(r"健康"), "health"),
]


def detect_eval_mark(text: str) -> Optional[str]:
    for mark, pat in EVAL_MARK_PATTERNS.items():
        if pat.search(text):
            return mark
    return "NONE"


def detect_growth_type(text: str) -> Optional[str]:
    for gt, pat in GROWTH_TYPE_PATTERNS.items():
        if pat.search(text):
            return gt
    return None


def detect_gender(text: str) -> Optional[str]:
    for g, pat in GENDER_PATTERNS.items():
        if pat.search(text):
            return g
    return None


def extract_number_near(texts: list[str], index: int, window: int = 3) -> Optional[int]:
    """指定インデックスの近傍テキストから数値(0-100)を抽出する"""
    for j in range(index, min(len(texts), index + window + 1)):
        m = re.search(r"\b([0-9]{1,3})\b", texts[j])
        if m:
            val = int(m.group(1))
            if 0 <= val <= 100:
                return val
    return None


def detect_factors(all_texts: list[str]) -> list[str]:
    """因子テキストを検出してenumキーのリストを返す（重複なし）"""
    # 因子欄は「〇〇因子」という形式
    factor_section = False
    detected: set[str] = set()

    for text in all_texts:
        # 「因子」という単語が含まれるブロックに入ったらファクター検出モード
        if "因子" in text:
            factor_section = True
        if factor_section:
            for pat, key in FACTOR_PATTERNS:
                if pat.search(text):
                    detected.add(key)

    # セクション未検出の場合は全体から探す
    if not detected:
        for text in all_texts:
            for pat, key in FACTOR_PATTERNS:
                if pat.search(text) and "因子" in text:
                    detected.add(key)

    return list(detected)


def detect_lineage_name(all_texts: list[str]) -> Optional[str]:
    """系統名を抽出する。「〇〇系」または「系統」ラベルの近傍テキストを探す"""
    lineage_pattern = re.compile(r"^(.{1,10})系$")
    lineage_label = re.compile(r"系統|血統系統")

    # 「〇〇系」という形式を直接探す
    for text in all_texts:
        m = lineage_pattern.match(text.strip())
        if m:
            return m.group(0).strip()

    # 「系統」ラベルの次のテキストを探す
    for i, text in enumerate(all_texts):
        if lineage_label.search(text):
            if i + 1 < len(all_texts):
                candidate = all_texts[i + 1].strip()
                if 1 < len(candidate) <= 15:
                    return candidate

    return None


# ─────────────────────────────────────────
# OCR テキストから各種データを抽出する
# ─────────────────────────────────────────

def parse_foal_data(ocr_results: list[tuple]) -> FoalData:
    """
    EasyOCR の結果リスト（[bbox, text, conf]）から
    ウイニングポスト10の幼駒評価シートを解析する。
    """
    all_texts = [r[1] for r in ocr_results]
    full_text = " ".join(all_texts)

    foal = FoalData()

    # ─── 性別 ───
    for raw in all_texts:
        g = detect_gender(raw)
        if g:
            foal.gender = g
            break

    # ─── 成長型 ───
    for raw in all_texts:
        gt = detect_growth_type(raw)
        if gt:
            foal.growthType = gt
            break

    # ─── 年度 ───
    m = YEAR_PATTERN.search(full_text)
    if m:
        try:
            foal.birthYear = int(m.group(1))
        except ValueError:
            pass

    # ─── 評価印の検出 ───
    kappa_found = False
    mika_found = False

    for i, raw in enumerate(all_texts):
        lower_raw = raw
        is_kappa_row = re.search(r"河童|かっぱ|カッパ|木", lower_raw)
        is_mika_row = re.search(r"美香|みか|ﾐｶ", lower_raw)

        if is_kappa_row and not kappa_found:
            combined = " ".join(all_texts[max(0, i-1): min(len(all_texts), i+3)])
            foal.kappaMark = detect_eval_mark(combined) or "NONE"
            kappa_found = True

        if is_mika_row and not mika_found:
            combined = " ".join(all_texts[max(0, i-1): min(len(all_texts), i+3)])
            foal.mikaMark = detect_eval_mark(combined) or "NONE"
            mika_found = True

    if not kappa_found or not mika_found:
        marks_found = []
        for raw in all_texts:
            m = detect_eval_mark(raw)
            if m and m != "NONE":
                marks_found.append(m)
        if len(marks_found) >= 1 and not kappa_found:
            foal.kappaMark = marks_found[0]
        if len(marks_found) >= 2 and not mika_found:
            foal.mikaMark = marks_found[1]

    # ─── 父馬名・母馬名 ───
    for i, raw in enumerate(all_texts):
        sire_match = re.search(r"^父\s*[:：]?\s*(.+)$", raw.strip())
        if sire_match:
            foal.sireName = sire_match.group(1).strip()
        elif re.search(r"^父[：:]?$|^父$", raw.strip()):
            if i + 1 < len(all_texts):
                foal.sireName = all_texts[i + 1].strip()

        dam_match = re.search(r"^母\s*[:：]?\s*(.+)$", raw.strip())
        if dam_match:
            foal.damName = dam_match.group(1).strip()
        elif re.search(r"^母[：:]?$|^母$", raw.strip()):
            if i + 1 < len(all_texts):
                foal.damName = all_texts[i + 1].strip()

    if foal.sireName and foal.sireName in ["リーディング", "ーディング", "ディング"]:
        foal.sireName = None

    # ─── 馬名 ───
    exclude_words = {"評価額", "取引額", "基本能力", "瞬発力", "柔軟性", "精神力", "スピード", "勝負根性", "パワー", "健康", "賢さ", "ウマーソナリティ", "未獲得", "河童木", "育成中", "詳細", "血統", "能力", "北口"}

    katakana_num_pattern = re.compile(r"^[\u30A0-\u30FFー]+[0-9０-９]{0,4}$")
    general_name_pattern = re.compile(r"^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{2,12}$")

    for t in all_texts:
        clean_t = t.strip()
        if clean_t in exclude_words:
            continue
        if len(clean_t) < 2:
            continue
        if katakana_num_pattern.match(clean_t) or general_name_pattern.match(clean_t):
            foal.name = clean_t
            break

    # ─── 誕生年の簡易推定 ───
    if not foal.birthYear and foal.name:
        m = re.search(r"([0-9０-９]{2})$", foal.name)
        if m:
            yy_str = m.group(1).translate(str.maketrans('０１２３４５６７８９', '0123456789'))
            yy = int(yy_str)
            foal.birthYear = 1900 + yy if yy >= 70 else 2000 + yy

    # ─── 馬体コメント ───
    comment_keywords = re.compile(r"馬体|コメント|特徴|診断")
    for i, raw in enumerate(all_texts):
        if comment_keywords.search(raw):
            if i + 1 < len(all_texts):
                foal.bodyComment = all_texts[i + 1].strip()
            break

    return foal


def parse_stallion_data(ocr_results: list[tuple]) -> StallionData:
    """
    EasyOCR の結果から種牡馬情報画面を解析する。
    抽出対象: 馬名, 系統名, 能力値(スピード/スタミナ/パワー/根性/賢さ/健康), 因子
    """
    all_texts = [r[1] for r in ocr_results]
    stallion = StallionData()

    # ─── 馬名 ───
    stallion.name = _extract_horse_name(all_texts)

    # ─── 系統名 ───
    stallion.lineageName = detect_lineage_name(all_texts)

    # ─── 能力値 ───
    ability: dict[str, Optional[int]] = {
        "speed": None, "stamina": None, "power": None,
        "guts": None, "wisdom": None, "health": None,
    }
    for i, text in enumerate(all_texts):
        for pat, key in ABILITY_LABEL_PATTERNS:
            if pat.search(text) and ability[key] is None:
                val = extract_number_near(all_texts, i)
                if val is not None:
                    ability[key] = val

    stallion.speed = ability["speed"]
    stallion.stamina = ability["stamina"]
    stallion.power = ability["power"]
    stallion.guts = ability["guts"]
    stallion.wisdom = ability["wisdom"]
    stallion.health = ability["health"]

    # ─── 因子 ───
    stallion.factors = detect_factors(all_texts)

    return stallion


def parse_mare_data(ocr_results: list[tuple]) -> MareData:
    """
    EasyOCR の結果から繁殖牝馬情報画面を解析する。
    抽出対象: 馬名, 系統名, スピード/スタミナ, 因子
    """
    all_texts = [r[1] for r in ocr_results]
    mare = MareData()

    # ─── 馬名 ───
    mare.name = _extract_horse_name(all_texts)

    # ─── 系統名 ───
    mare.lineageName = detect_lineage_name(all_texts)

    # ─── 能力値（スピード・スタミナのみ） ───
    for i, text in enumerate(all_texts):
        if re.search(r"スピード", text) and mare.speed is None:
            mare.speed = extract_number_near(all_texts, i)
        if re.search(r"スタミナ", text) and mare.stamina is None:
            mare.stamina = extract_number_near(all_texts, i)

    # ─── 因子 ───
    mare.factors = detect_factors(all_texts)

    return mare


def _extract_horse_name(all_texts: list[str]) -> Optional[str]:
    """
    馬名を抽出する共通関数。
    UIキーワードを除いたカタカナ・漢字混じりテキストを馬名と判断する。
    """
    exclude_words = {
        "評価額", "取引額", "基本能力", "瞬発力", "柔軟性", "精神力",
        "スピード", "勝負根性", "パワー", "健康", "賢さ", "スタミナ",
        "ウマーソナリティ", "未獲得", "河童木", "育成中", "詳細",
        "血統", "能力", "北口", "種牡馬", "繁殖牝馬", "幼駒",
        "因子", "系統", "牡", "牝", "去",
    }
    katakana_num_pattern = re.compile(r"^[\u30A0-\u30FFー]+[0-9０-９]{0,4}$")
    general_name_pattern = re.compile(r"^[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{2,12}$")

    for t in all_texts:
        clean_t = t.strip()
        if clean_t in exclude_words:
            continue
        if len(clean_t) < 2:
            continue
        if katakana_num_pattern.match(clean_t) or general_name_pattern.match(clean_t):
            return clean_t
    return None


# ─────────────────────────────────────────
# 共通ヘルパー: 画像読み込み + OCR 実行
# ─────────────────────────────────────────

async def run_ocr(file: UploadFile) -> tuple[list[tuple], list[OcrRawResult], float]:
    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="画像ファイルを送信してください")

    data = await file.read()
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"画像の読み込みに失敗しました: {e}")

    img_array = np.array(img)
    reader = get_reader()
    try:
        results = reader.readtext(img_array, detail=1, paragraph=False)
    except Exception as e:
        logger.error(f"OCR エラー: {e}")
        raise HTTPException(status_code=500, detail=f"OCR 処理中にエラーが発生しました: {e}")

    avg_conf = sum(r[2] for r in results) / len(results) if results else 0.0
    raw_list = [
        OcrRawResult(
            text=r[1],
            confidence=round(r[2], 4),
            bbox=[list(map(int, pt)) for pt in r[0]],
        )
        for r in results
    ]

    logger.info(f"OCR 完了: {len(results)} テキストブロック検出, 信頼度={avg_conf:.3f}")
    return results, raw_list, round(avg_conf, 4)


# ─────────────────────────────────────────
# API エンドポイント
# ─────────────────────────────────────────

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "winpost-ocr"}


@app.get("/ready")
def ready_check():
    """EasyOCR リーダーが初期化済みか確認"""
    return {"ready": _reader is not None}


@app.post("/ocr/foal", response_model=OcrResponse)
async def ocr_foal(
    file: UploadFile = File(..., description="ゲームのスクリーンショット画像"),
):
    """
    幼駒評価シートの画像をアップロードして OCR 解析する。
    - 評価印（河童木・美香）
    - 成長型、性別
    - 父馬名・母馬名
    """
    results, raw_list, avg_conf = await run_ocr(file)
    foal = parse_foal_data(results)
    return OcrResponse(raw=raw_list, foal=foal, confidence=avg_conf)


@app.post("/ocr/stallion", response_model=StallionOcrResponse)
async def ocr_stallion(
    file: UploadFile = File(..., description="種牡馬情報画面のスクリーンショット"),
):
    """
    種牡馬情報画面の画像をアップロードして OCR 解析する。
    - 馬名、系統名
    - 能力値（スピード/スタミナ/パワー/勝負根性/賢さ/健康）
    - 因子
    """
    results, raw_list, avg_conf = await run_ocr(file)
    stallion = parse_stallion_data(results)
    return StallionOcrResponse(raw=raw_list, stallion=stallion, confidence=avg_conf)


@app.post("/ocr/mare", response_model=MareOcrResponse)
async def ocr_mare(
    file: UploadFile = File(..., description="繁殖牝馬情報画面のスクリーンショット"),
):
    """
    繁殖牝馬情報画面の画像をアップロードして OCR 解析する。
    - 馬名、系統名
    - 能力値（スピード/スタミナ）
    - 因子
    """
    results, raw_list, avg_conf = await run_ocr(file)
    mare = parse_mare_data(results)
    return MareOcrResponse(raw=raw_list, mare=mare, confidence=avg_conf)


@app.post("/ocr/raw")
async def ocr_raw(
    file: UploadFile = File(...),
):
    """生の OCR テキスト一覧を返す（デバッグ用）"""
    data = await file.read()
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    img_array = np.array(img)
    reader = get_reader()
    results = reader.readtext(img_array, detail=1, paragraph=False)

    return {
        "count": len(results),
        "texts": [{"text": r[1], "confidence": round(r[2], 4)} for r in results],
    }
