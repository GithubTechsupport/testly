from flask import Blueprint, request, jsonify
from bson import ObjectId

from src.core.question_generator import QuestionGenerator

exam_bp = Blueprint("exam_pipeline", __name__)

@exam_bp.post("/generate-exam")
def generate_exam():
    """
    JSON body:
    {
      "book_id": "652c...",            // required
      "limit": 5,                      // optional
      "offset": 0,                     // optional
      "questions_per_chapter": 8       // optional
    }
    """
    data = request.get_json(silent=True) or {}
    book_id = data.get("book_id")
    if not book_id:
        return jsonify(error="book_id is required"), 400

    limit = data.get("limit")
    offset = int(data.get("offset", 0))
    q_per_ch = int(data.get("questions_per_chapter", 8))

    try:
        gen = QuestionGenerator(questions_per_chapter=q_per_ch)
        gen.generate_questions(book_id=ObjectId(book_id), limit=limit, offset=offset)
        return jsonify(status="ok"), 200
    except Exception as exc:
        return jsonify(error=str(exc)), 500