"""New question generation module for the hybrid approach.

This module generates questions on-demand for specific subchapters with
configurable difficulty distributions and deduplication support.
"""

import hashlib
import json
import re
from datetime import datetime
from io import BytesIO
from typing import Any, Dict, List, Optional

import numpy as np
import requests
from bson import ObjectId
from bson.errors import InvalidId
from dotenv import load_dotenv
from PyPDF2 import PdfReader

from ..models.ai_models import MistralEmbed, MistralModel, MistralSmall
from ..utils.database_funcs import get_mongo_client
from ..utils.timing import function_timer

load_dotenv()


class NewQuestionGenerator:
    """Generates questions on-demand with deduplication and difficulty control."""

    DEFAULT_RAG_DEPTH = 5

    def __init__(self, rag_depth: int = DEFAULT_RAG_DEPTH):
        self.rag_depth = rag_depth

        mongo_client = get_mongo_client()
        self.db = mongo_client["bookTestMaker"]
        self.subchapter_collection = self.db["subchapters"]
        self.chapter_collection = self.db["chapters"]
        self.question_collection = self.db["questions"]
        self.books_collection = self.db["books"]
        self.chunk_embedding_collection = self.db["chunkEmbeddings"]

        self.embed_model = MistralEmbed()
        self.generation_model = MistralModel()
        self.evaluation_model = MistralSmall()

    @staticmethod
    def _ensure_object_id(value: str | ObjectId) -> ObjectId:
        """Convert string to ObjectId if needed."""
        if isinstance(value, ObjectId):
            return value
        try:
            return ObjectId(value)
        except (InvalidId, TypeError) as exc:
            raise ValueError(f"Invalid ObjectId: {value}") from exc

    @staticmethod
    def _normalize_question_text(text: str) -> str:
        """Normalize question text for hashing."""
        text = text.lower()
        text = re.sub(r"[^\w\s]", "", text)  # Remove punctuation
        text = " ".join(text.split())  # Normalize whitespace
        return text

    @staticmethod
    def _hash_question(text: str) -> str:
        """Generate a content hash for a question."""
        normalized = NewQuestionGenerator._normalize_question_text(text)
        return hashlib.sha256(normalized.encode()).hexdigest()[:16]

    def _fetch_subchapter_text(self, subchapter_id: ObjectId) -> Optional[str]:
        """Fetch and extract text from a subchapter's PDF."""
        sub_doc = self.subchapter_collection.find_one({"_id": subchapter_id})
        if not sub_doc:
            return None

        pdf_url = sub_doc.get("s3Link")
        if not pdf_url:
            return None

        try:
            response = requests.get(pdf_url, timeout=60)
            response.raise_for_status()
            reader = PdfReader(BytesIO(response.content))
            text = "".join(page.extract_text() or "" for page in reader.pages)
            return text if text.strip() else None
        except Exception as e:
            print(f"Error fetching PDF for subchapter {subchapter_id}: {e}")
            return None

    def _embed_input(
        self,
        text: str,
        overlap: int = 50,
        max_chunk_size: int = 3064,
    ) -> List[float]:
        """Create embedding for input text by averaging chunk embeddings."""
        embeddings = []
        for i in range(0, len(text), max_chunk_size - overlap):
            chunk = text[i : i + max_chunk_size]
            embeddings.append(self.embed_model.generate_response(chunk))
            if i + max_chunk_size >= len(text):
                break
        return np.mean(np.array(embeddings), axis=0).tolist()

    def _retrieve_context(
        self,
        book_id: ObjectId,
        subchapter_id: ObjectId,
        subchapter_text: str,
    ) -> List[Dict]:
        """Retrieve relevant context using vector search."""
        try:
            query_embedding = self._embed_input(subchapter_text)
            pipeline = [
                {
                    "$vectorSearch": {
                        "index": "vector_index",
                        "queryVector": query_embedding,
                        "path": "embedding",
                        "filter": {
                            "bookID": book_id,
                            "subchapterID": {"$ne": subchapter_id},
                        },
                        "exact": True,
                        "limit": self.rag_depth,
                    }
                },
                {"$project": {"_id": 0, "text": 1, "subchapterTitle": 1}},
            ]
            results = self.chunk_embedding_collection.aggregate(pipeline)
            return list(results)
        except Exception as exc:
            print(f"Error retrieving context: {exc}")
            return []

    def _build_prompt(
        self,
        subchapter_data: Dict[str, Any],
        subchapter_text: str,
        difficulty_distribution: Dict[str, int],
        exclude_hashes: List[str],
    ) -> str:
        """Build prompt for question generation with difficulty and exclusion support."""
        book_id = self._ensure_object_id(subchapter_data["book_id"])
        subchapter_id = self._ensure_object_id(subchapter_data["subchapter_id"])
        
        total_questions = sum(difficulty_distribution.values())
        
        prompt = (
            "You are an exam maker responsible for creating exam questions for a chosen "
            "subchapter in a textbook for students to practice with.\n\n"
            f"Textbook: {subchapter_data.get('book_title', '')}\n"
            f"Chapter title: {subchapter_data.get('chapter_title', '')}\n"
            f"Subchapter title: {subchapter_data.get('subchapter_title', '')}\n"
            f"Generate exactly {total_questions} questions with the following difficulty distribution:\n"
        )

        for difficulty, count in difficulty_distribution.items():
            if count > 0:
                prompt += f"- {difficulty.capitalize()}: {count} question(s)\n"

        prompt += (
            "\nThe output MUST be a valid JSON object with a key 'questions', containing a list "
            "of question objects.\n"
            "Each question object MUST have these exact fields:\n"
            '- "text": the question text (string)\n'
            '- "alternatives": array of 4 answer choices (array of strings)\n'
            '- "correct_alternative": the correct answer (string, must match one of the alternatives exactly)\n'
            '- "difficulty": one of "easy", "medium", or "hard" (string)\n\n'
        )

        # Add exclusion hints if we have hashes to avoid
        if exclude_hashes:
            # Fetch the actual question texts for these hashes to give the LLM context
            existing_questions = list(self.question_collection.find(
                {"contentHash": {"$in": exclude_hashes}},
                {"question": 1, "_id": 0}
            ).limit(10))  # Limit to avoid prompt bloat
            
            if existing_questions:
                prompt += (
                    "IMPORTANT: Generate NEW and UNIQUE questions. "
                    "Do NOT generate questions similar to these existing ones:\n"
                )
                for i, q in enumerate(existing_questions, 1):
                    prompt += f'{i}. "{q.get("question", "")}"\n'
                prompt += "\n"

        prompt += (
            "Ensure that the questions can be understood without needing to read "
            "the subchapter text by supplying the necessary context in the question itself.\n\n"
            f"<<<\nSubchapter Text:\n{subchapter_text}\n>>>\n\n"
        )

        # Add RAG context
        context_entries = self._retrieve_context(
            book_id=book_id,
            subchapter_id=subchapter_id,
            subchapter_text=subchapter_text,
        )
        if context_entries:
            prompt += "Additional context from related subchapters (use if relevant):\n"
            for entry in context_entries:
                title = entry.get("subchapterTitle", "Unknown")
                prompt += f"--- From '{title}' ---\n{entry.get('text', '')}\n\n"

        return prompt

    def _evaluate_response(self, response: str) -> List[Dict]:
        """Evaluate generated questions using quality control model."""
        evaluation_prompt = (
            "Evaluate the following questions based on these criteria:\n\n"
            "- The question and the answer should be factually correct\n"
            "- There should not be any spelling mistakes or grammatical errors\n"
            "- The question should be self-contained and understandable without external context\n"
            "- The alternatives should be plausible\n\n"
            "Return a JSON object with a key 'scores': a list of numbers indicating "
            "the confidence score of each question (same order as input).\n"
            "Scores should be between 0 and 1, where 1 is highest confidence.\n\n"
            f"<<<\nQuestions:\n{response}\n>>>"
        )

        try:
            questions = json.loads(response)["questions"]
            evaluated_response = self.evaluation_model.generate_response(evaluation_prompt)
            scores = json.loads(evaluated_response)["scores"]

            for index, score in enumerate(scores):
                if index < len(questions):
                    questions[index]["confidence"] = score
            return questions
        except (json.JSONDecodeError, KeyError) as e:
            print(f"Error parsing questions or scores: {e}")
            # Return questions without confidence scores if evaluation fails
            try:
                return json.loads(response)["questions"]
            except:
                return []

    def _insert_questions(
        self,
        questions: List[Dict],
        subchapter_data: Dict[str, Any],
        source: str = "realtime",
    ) -> List[str]:
        """Insert generated questions into MongoDB and return their IDs."""
        inserted_ids: List[str] = []
        
        book_id = self._ensure_object_id(subchapter_data["book_id"])
        chapter_id = self._ensure_object_id(subchapter_data["chapter_id"])
        subchapter_id = self._ensure_object_id(subchapter_data["subchapter_id"])

        for question in questions:
            try:
                question_text = question.get("text", "")
                content_hash = self._hash_question(question_text)
                
                # Check for duplicate by hash
                existing = self.question_collection.find_one({"contentHash": content_hash})
                if existing:
                    print(f"Skipping duplicate question with hash {content_hash}")
                    continue

                result = self.question_collection.insert_one({
                    "bookID": book_id,
                    "bookTitle": subchapter_data.get("book_title", ""),
                    "chapterID": chapter_id,
                    "chapterTitle": subchapter_data.get("chapter_title", ""),
                    "subchapterID": subchapter_id,
                    "subchapterTitle": subchapter_data.get("subchapter_title", ""),
                    "question": question_text,
                    "alternatives": question.get("alternatives", []),
                    "correctAlternative": question.get("correct_alternative", ""),
                    "difficulty": question.get("difficulty", "medium"),
                    "confidence": question.get("confidence", 0.0),
                    "contentHash": content_hash,
                    "source": source,
                    "createdAt": datetime.utcnow(),
                })
                inserted_ids.append(str(result.inserted_id))
                print(f"Inserted question: {result.inserted_id}")
            except Exception as exc:
                print(f"Error inserting question: {exc}")

        return inserted_ids

    @function_timer
    def generate_for_subchapter(
        self,
        subchapter_request: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Generate questions for a single subchapter.
        
        Args:
            subchapter_request: Dict containing:
                - subchapter_id: str
                - book_id: str
                - chapter_id: str
                - subchapter_title: str
                - book_title: str
                - chapter_title: str
                - questions_to_generate: int
                - difficulty_distribution: Dict[str, int]
                - exclude_hashes: List[str]
        
        Returns:
            Dict with:
                - generated_question_ids: List[str]
                - error: Optional[Dict] with errorType and message
        """
        subchapter_id = subchapter_request["subchapter_id"]
        
        try:
            sub_oid = self._ensure_object_id(subchapter_id)
            
            # Fetch subchapter text
            subchapter_text = self._fetch_subchapter_text(sub_oid)
            if not subchapter_text:
                return {
                    "generated_question_ids": [],
                    "error": {
                        "subchapterId": subchapter_id,
                        "errorType": "pdf_fetch_failed",
                        "message": "Could not fetch or parse subchapter PDF",
                    },
                }

            # Build subchapter data for prompt and insertion
            subchapter_data = {
                "subchapter_id": subchapter_id,
                "book_id": subchapter_request["book_id"],
                "chapter_id": subchapter_request["chapter_id"],
                "subchapter_title": subchapter_request.get("subchapter_title", ""),
                "book_title": subchapter_request.get("book_title", ""),
                "chapter_title": subchapter_request.get("chapter_title", ""),
            }

            difficulty_distribution = subchapter_request.get("difficulty_distribution", {})
            exclude_hashes = subchapter_request.get("exclude_hashes", [])

            # Build and execute prompt
            prompt = self._build_prompt(
                subchapter_data,
                subchapter_text,
                difficulty_distribution,
                exclude_hashes,
            )

            print(f"Generating questions for subchapter: {subchapter_data['subchapter_title']}")
            response = self.generation_model.generate_response(prompt)

            # Evaluate and insert questions
            questions = self._evaluate_response(response)
            
            if not questions:
                return {
                    "generated_question_ids": [],
                    "error": {
                        "subchapterId": subchapter_id,
                        "errorType": "generation_failed",
                        "message": "LLM did not return valid questions",
                    },
                }

            inserted_ids = self._insert_questions(questions, subchapter_data, source="realtime")
            
            print(f"Generated {len(inserted_ids)} questions for {subchapter_data['subchapter_title']}")
            
            return {
                "generated_question_ids": inserted_ids,
                "error": None,
            }

        except Exception as exc:
            print(f"Error generating questions for subchapter {subchapter_id}: {exc}")
            return {
                "generated_question_ids": [],
                "error": {
                    "subchapterId": subchapter_id,
                    "errorType": "generation_error",
                    "message": str(exc),
                },
            }

    def generate_for_subchapters(
        self,
        subchapter_requests: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Generate questions for multiple subchapters.
        
        Args:
            subchapter_requests: List of subchapter request dicts
        
        Returns:
            Dict with:
                - generated_question_ids: List[str] - all generated question IDs
                - errors: List[Dict] - errors for failed subchapters
        """
        all_generated_ids: List[str] = []
        all_errors: List[Dict[str, str]] = []

        for request in subchapter_requests:
            result = self.generate_for_subchapter(request)
            all_generated_ids.extend(result.get("generated_question_ids", []))
            
            if result.get("error"):
                all_errors.append(result["error"])

        return {
            "generated_question_ids": all_generated_ids,
            "errors": all_errors,
        }


if __name__ == "__main__":
    raise SystemExit("Run NewQuestionGenerator via the API endpoints.")
