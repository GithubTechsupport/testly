from flask import Blueprint, jsonify, request
from bson import ObjectId
from bson.errors import InvalidId

from src.core.pdf_processor import PDFProcessor
from src.core.text_embedder import TextEmbedder
from threading import Thread

upload_bp = Blueprint("upload_pipeline", __name__)
_ALLOWED_VISIBILITY = {"public", "private"}


@upload_bp.post("/upload-embed")
def upload_and_embed():
    """
    JSON body:
    {
      "book_id": "...",      // required string ObjectId of an existing book document
      "use_ocr": false        // optional
    }
    """
    data = request.get_json(silent=True) or {}
    book_id_raw = data.get("book_id")
    use_ocr = bool(data.get("use_ocr", False))

    try:
        book_id = ObjectId(book_id_raw)
    except (InvalidId, TypeError):
        return jsonify(error="book_id must be a valid ObjectId string"), 400

    # Run in background thread and return immediately
    def _worker(bid: ObjectId, use_ocr_flag: bool):
        processor = PDFProcessor()
        embedder = TextEmbedder()
        try:
            # Process the existing book (chapters/subchapters, s3 uploads, ids)
            processor.process_existing_book(book_id=bid)
            # Create embeddings
            embedder.process_book(book_id=bid, use_ocr=use_ocr_flag)
            # Mark as finished
            processor.books_collection.update_one(
                {"_id": bid}, {"$set": {"state": "finished"}}
            )
        except Exception as exc:  # noqa: BLE001
            # Best-effort error logging – don't crash the server thread
            print(f"Pipeline failed for {bid}: {exc}")

    Thread(target=_worker, args=(book_id, use_ocr), daemon=True).start()

    return jsonify(status="accepted", book_id=str(book_id)), 202