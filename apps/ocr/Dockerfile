FROM python:3.11-slim

WORKDIR /app

# システム依存パッケージ（EasyOCR に必要）
RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    libgl1 \
    && rm -rf /var/lib/apt/lists/*

# CPU版の PyTorch を事前インストール (イメージサイズとダウンロード時間の削減)
RUN pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu --no-cache-dir

# Python 依存パッケージ
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# EasyOCR モデルを事前ダウンロード（キャッシュをイメージに含めると起動が速い）
RUN python -c "import easyocr; easyocr.Reader(['ja', 'en'], gpu=False)" || true

COPY main.py .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
