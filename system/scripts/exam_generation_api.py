"""Flask blueprint for exam/question generation API endpoints."""

from flask import Blueprint, jsonify, request
from typing import List, Dict, Any

from src.core.new_question_generation import NewQuestionGenerator

exam_bp = Blueprint("exam", __name__)


@exam_bp.route("/generate-questions", methods=["POST"])
def generate_questions():
    """
    Generate questions for multiple subchapters.
    
    Expected JSON payload:
    {
        "subchapter_requests": [
            {
                "subchapter_id": "string",
                "book_id": "string",
                "chapter_id": "string",
                "subchapter_title": "string",
                "book_title": "string",
                "chapter_title": "string",
                "questions_to_generate": int,
                "difficulty_distribution": {"easy": int, "medium": int, "hard": int},
                "exclude_hashes": ["hash1", "hash2", ...]
            },
            ...
        ]
    }
    
    Returns:
    {
        "status": "success" | "partial" | "failed",
        "generatedQuestionIds": ["id1", "id2", ...],
        "errors": [
            {
                "subchapterId": "string",
                "errorType": "string",
                "message": "string"
            },
            ...
        ]
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                "status": "failed",
                "generatedQuestionIds": [],
                "errors": [{"subchapterId": "", "errorType": "invalid_request", "message": "No JSON data provided"}]
            }), 400
        
        subchapter_requests = data.get("subchapter_requests", [])
        
        if not subchapter_requests:
            return jsonify({
                "status": "failed",
                "generatedQuestionIds": [],
                "errors": [{"subchapterId": "", "errorType": "invalid_request", "message": "No subchapter requests provided"}]
            }), 400
        
        # Validate each request
        validated_requests: List[Dict[str, Any]] = []
        validation_errors: List[Dict[str, str]] = []
        
        for req in subchapter_requests:
            subchapter_id = req.get("subchapter_id")
            
            if not subchapter_id:
                validation_errors.append({
                    "subchapterId": "",
                    "errorType": "validation_error",
                    "message": "Missing subchapter_id"
                })
                continue
            
            questions_to_generate = req.get("questions_to_generate", 0)
            if questions_to_generate <= 0:
                # Skip subchapters with no questions needed
                continue
            
            difficulty_distribution = req.get("difficulty_distribution", {})
            if not difficulty_distribution:
                validation_errors.append({
                    "subchapterId": subchapter_id,
                    "errorType": "validation_error",
                    "message": "Missing difficulty_distribution"
                })
                continue
            
            validated_requests.append({
                "subchapter_id": subchapter_id,
                "book_id": req.get("book_id", ""),
                "chapter_id": req.get("chapter_id", ""),
                "subchapter_title": req.get("subchapter_title", ""),
                "book_title": req.get("book_title", ""),
                "chapter_title": req.get("chapter_title", ""),
                "questions_to_generate": questions_to_generate,
                "difficulty_distribution": {
                    "easy": difficulty_distribution.get("easy", 0),
                    "medium": difficulty_distribution.get("medium", 0),
                    "hard": difficulty_distribution.get("hard", 0),
                },
                "exclude_hashes": req.get("exclude_hashes", []),
            })
        
        if not validated_requests:
            return jsonify({
                "status": "failed",
                "generatedQuestionIds": [],
                "errors": validation_errors if validation_errors else [
                    {"subchapterId": "", "errorType": "invalid_request", "message": "No valid requests to process"}
                ]
            }), 400
        
        # Initialize the generator and process requests
        generator = NewQuestionGenerator()
        result = generator.generate_for_subchapters(validated_requests)
        
        # Combine validation errors with generation errors
        all_errors = validation_errors + result.get("errors", [])
        
        # Determine overall status
        generated_ids = result.get("generated_question_ids", [])
        if not generated_ids and all_errors:
            status = "failed"
        elif all_errors:
            status = "partial"
        else:
            status = "success"
        
        return jsonify({
            "status": status,
            "generatedQuestionIds": generated_ids,
            "errors": all_errors
        }), 200
        
    except Exception as e:
        print(f"Error in generate_questions endpoint: {e}")
        return jsonify({
            "status": "failed",
            "generatedQuestionIds": [],
            "errors": [{"subchapterId": "", "errorType": "server_error", "message": str(e)}]
        }), 500


@exam_bp.route("/generation-health", methods=["GET"])
def generation_health():
    """Health check for the question generation service."""
    try:
        # Quick validation that we can instantiate the generator
        generator = NewQuestionGenerator()
        return jsonify({
            "status": "healthy",
            "service": "question-generation"
        }), 200
    except Exception as e:
        return jsonify({
            "status": "unhealthy",
            "service": "question-generation",
            "error": str(e)
        }), 503
