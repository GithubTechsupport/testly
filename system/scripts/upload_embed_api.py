from flask import Blueprint, jsonify, request
from bson import ObjectId
from bson.errors import InvalidId

from src.core.pdf_processor import PDFProcessor
from src.core.text_embedder import TextEmbedder

upload_bp = Blueprint("upload_pipeline", __name__)
_ALLOWED_VISIBILITY = {"public", "private"}


@upload_bp.post("/upload-embed")
def upload_and_embed():
    """
    JSON body:
    {
      "book_name": "Your Book Name",
      "s3_link": "https://your-bucket.s3.amazonaws.com/your.pdf",
      "visibility": "Public",              // required ("Public" or "Private")
      "uploader": "6530e...",              // required string ObjectId
      "use_ocr": false                     // optional
    }
    """
    data = request.get_json(silent=True) or {}
    book_name = data.get("book_name")
    s3_link = data.get("s3_link")
    visibility = data.get("visibility", "")
    uploader = data.get("uploader")
    use_ocr = bool(data.get("use_ocr", False))

    if not book_name or not s3_link:
        return jsonify(error="book_name and s3_link are required"), 400
    if not uploader:
        return jsonify(error="uploader is required"), 400

    normalized_visibility = str(visibility).strip().lower()
    if normalized_visibility not in _ALLOWED_VISIBILITY:
        return jsonify(error="visibility must be 'Public' or 'Private'"), 400

    try:
        uploader_id = ObjectId(uploader)
    except (InvalidId, TypeError):
        return jsonify(error="uploader must be a valid ObjectId string"), 400

    processor = PDFProcessor()
    embedder = TextEmbedder()

    try:
        result = processor.process_book(
            book_title=book_name,
            pdf_s3_url=s3_link,
            visibility=normalized_visibility.capitalize(),
            uploader=uploader_id,
        )
        embedder.process_book(book_id=result["book_id"], use_ocr=use_ocr)

        return jsonify(
            status="ok",
            book_id=result["book_id"],
            book_title=result["book_title"],
            visibility=normalized_visibility.capitalize(),
            used_ocr=use_ocr,
        ), 200
    except Exception as exc:
        return jsonify(error=str(exc)), 500