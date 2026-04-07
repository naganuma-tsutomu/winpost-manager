"""
WinPost OCR Service
ウイニングポスト10 2025 のゲーム画面をEasyOCRで解析し、
幼駒評価データを構造化して返す。
"""
from __future__ import annotations

import io
import logging
import re
from pathlib import Path
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


class OcrResponse(BaseModel):
    raw: list[OcrRawResult]
    foal: FoalData
    confidence: float                     # 全体信頼度 (0.0〜1.0)


# ─────────────────────────────────────────
# 印・成長型のパターン
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


# ─────────────────────────────────────────
# OCR テキストから幼駒データを抽出する
# ─────────────────────────────────────────

def parse_foal_data(ocr_results: list[tuple]) -> FoalData:
    """
    EasyOCR の結果リスト（[bbox, text, conf]）から
    ウイニングポスト10の幼駒評価シートを解析する。
    """
    # テキスト全体を結合
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
    # WP10 では「河童木」「美香」などのラベル付き行に印が続く
    kappa_found = False
    mika_found = False

    for i, raw in enumerate(all_texts):
        lower_raw = raw
        is_kappa_row = re.search(r"河童|かっぱ|カッパ|木", lower_raw)
        is_mika_row = re.search(r"美香|みか|ﾐｶ", lower_raw)

        if is_kappa_row and not kappa_found:
            # 同行または次行に印があるか確認
            combined = " ".join(all_texts[max(0, i-1): min(len(all_texts), i+3)])
            foal.kappaMark = detect_eval_mark(combined) or "NONE"
            kappa_found = True

        if is_mika_row and not mika_found:
            combined = " ".join(all_texts[max(0, i-1): min(len(all_texts), i+3)])
            foal.mikaMark = detect_eval_mark(combined) or "NONE"
            mika_found = True

    # 印が2個指定されていれば順に割り当て（ラベルなし画像の場合）
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
    # "父:" "母:" などのラベルを探す
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

    # リーディング等のノイズが名前に混ざったら省く
    if foal.sireName and foal.sireName in ["リーディング", "ーディング", "ディング"]:
        foal.sireName = None

    # ─── 馬名 ───
    # ゲーム内では幼駒に名前がついている場合がある（カタカナ or 漢字）＋ 誕生年の数字（母名＋年度など）
    # 除外ワード（UIのテキスト）
    exclude_words = {"評価額", "取引額", "基本能力", "瞬発力", "柔軟性", "精神力", "スピード", "勝負根性", "パワー", "健康", "賢さ", "ウマーソナリティ", "未獲得", "河童木", "育成中", "詳細", "血統", "能力", "北口"}
    
    # 馬名のパターン: カタカナ主体 + 数字(末尾) または2文字以上の漢字・カタカナ (UIキーワード以外)
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
            # 全角数字を半角に変換
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
    mode: str = Form(default="auto", description="解析モード: auto / foal"),
):
    """
    幼駒評価シートの画像をアップロードして OCR 解析する。
    - 評価印（河童木・美香）
    - 成長型、性別
    - 父馬名・母馬名
    """
    # ファイル形式チェック
    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="画像ファイルを送信してください")

    # 読み込み
    data = await file.read()
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"画像の読み込みに失敗しました: {e}")

    img_array = np.array(img)

    # OCR 実行
    reader = get_reader()
    try:
        results = reader.readtext(img_array, detail=1, paragraph=False)
    except Exception as e:
        logger.error(f"OCR エラー: {e}")
        raise HTTPException(status_code=500, detail=f"OCR 処理中にエラーが発生しました: {e}")

    # 信頼度計算
    if results:
        avg_conf = sum(r[2] for r in results) / len(results)
    else:
        avg_conf = 0.0

    # 構造化
    raw_list = [
        OcrRawResult(
            text=r[1],
            confidence=round(r[2], 4),
            bbox=[list(map(int, pt)) for pt in r[0]],
        )
        for r in results
    ]

    foal = parse_foal_data(results)

    logger.info(f"OCR 完了: {len(results)} テキストブロック検出, 信頼度={avg_conf:.3f}")

    return OcrResponse(raw=raw_list, foal=foal, confidence=round(avg_conf, 4))


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
