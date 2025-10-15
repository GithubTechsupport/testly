import os
import sys
from pathlib import Path

from flask import Flask, request, jsonify
from bson import ObjectId
from dotenv import load_dotenv

# Ensure we can import from src/
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.core.pdf_processor import PDFProcessor
from src.core.text_embedder import TextEmbedder

load_dotenv()

app = Flask(__name__)

@app.get("/health")
def health():
    return jsonify(status="ok"), 200

@app.post("/api/process-book")
def process_book():
    """
    JSON body:
    {
      "book_name": "Your Book Name",
      "s3_link": "https://your-bucket.s3.amazonaws.com/your.pdf",
      "use_ocr": false  // optional
    }
    """
    data = request.get_json(silent=True) or {}
    book_name = data.get("book_name")
    s3_link = data.get("s3_link")
    use_ocr = bool(data.get("use_ocr", False))

    if not book_name or not s3_link:
        return jsonify(error="book_name and s3_link are required"), 400

    try:
        # 1) Ingest the PDF (creates book and subchapters, persists original s3_link)
        processor = PDFProcessor()
        result = processor.process_book(book_name=book_name, pdf_s3_url=s3_link)
        book_id_str = result["book_id"]

        # 2) Embed the created book by its ObjectId
        embedder = TextEmbedder()
        embedder.process_book(book_id=ObjectId(book_id_str), use_ocr=use_ocr)

        return jsonify(
            status="ok",
            book_id=book_id_str,
            book_title=result["book_title"],
            used_ocr=use_ocr
        ), 200

    except Exception as exc:
        # Log to stdout/stderr as needed
        return jsonify(error=str(exc)), 500


if __name__ == "__main__":
    # Windows-friendly run: python scripts\upload_embed_api.py
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5001)))