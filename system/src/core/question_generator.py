"""Question generation module using RAG and LLM for creating exam questions."""

import json
from typing import Dict, List, Optional

import numpy as np
import requests
from bson import ObjectId
from bson.errors import InvalidId
from dotenv import load_dotenv
from io import BytesIO
from PyPDF2 import PdfReader

from ..models.ai_models import MistralEmbed, MistralModel, MistralSmall
from ..utils.timing import function_timer
from ..utils.database_funcs import get_mongo_client

load_dotenv()


class QuestionGenerator:
    """Generates exam questions using RAG and LLM models."""

    DEFAULT_RAG_DEPTH = 5
    DEFAULT_QUESTIONS_PER_CHAPTER = 8
    DEFAULT_DIFFICULTY_DISTRIBUTION = {
        "easy": 33,
        "medium": 33,
        "hard": 34,
    }

    def __init__(
        self,
        rag_depth: int = DEFAULT_RAG_DEPTH,
        questions_per_chapter: int = DEFAULT_QUESTIONS_PER_CHAPTER,
        difficulty_distribution: Optional[Dict[str, int]] = None,
    ):
        self.rag_depth = rag_depth
        self.questions_per_chapter = questions_per_chapter
        self.difficulty_distribution = (
            difficulty_distribution or self.DEFAULT_DIFFICULTY_DISTRIBUTION
        )

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
    def _ensure_object_id(value: ObjectId | str) -> ObjectId:
        if isinstance(value, ObjectId):
            return value
        try:
            return ObjectId(value)
        except (InvalidId, TypeError) as exc:
            raise ValueError("book_id must be a valid ObjectId") from exc

    @function_timer
    def get_subchapters(
        self,
        book_id: ObjectId | str,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> List[Dict]:
        """Retrieve subchapter content from MongoDB."""
        book_id = self._ensure_object_id(book_id)
        book_doc = self.books_collection.find_one({"_id": book_id})
        if not book_doc:
            raise ValueError("Book not found")

        subchapter_ids = book_doc.get("subchapterIds", [])
        if limit:
            subchapter_ids = subchapter_ids[offset : offset + limit]
        else:
            subchapter_ids = subchapter_ids[offset:]

        if not subchapter_ids:
            raise ValueError("Book has no subchapters to process")

        order_map = {sub_id: index for index, sub_id in enumerate(subchapter_ids)}

        sub_docs = list(
            self.subchapter_collection.find({"_id": {"$in": subchapter_ids}})
        )
        sub_docs.sort(key=lambda doc: order_map.get(doc["_id"], len(subchapter_ids)))

        chapter_ids = book_doc.get("chapterIds", [])
        chapter_docs = list(
            self.chapter_collection.find({"_id": {"$in": chapter_ids}})
        )
        chapter_map = {doc["_id"]: doc for doc in chapter_docs}

        subchapters: List[Dict] = []
        print("Getting subchapters...")

        for sub_doc in sub_docs:
            pdf_url = sub_doc.get("s3Link")
            if not pdf_url:
                raise ValueError("Subchapter missing s3Link")

            response = requests.get(pdf_url, timeout=60)
            response.raise_for_status()
            reader = PdfReader(BytesIO(response.content))
            text = "".join(page.extract_text() or "" for page in reader.pages)

            chapter_id = sub_doc.get("chapterID")
            chapter_title = ""
            if chapter_id and chapter_id in chapter_map:
                chapter_title = chapter_map[chapter_id].get("chapterTitle", "")

            subchapters.append(
                {
                    "book_id": book_id,
                    "book_title": book_doc.get("bookTitle", ""),
                    "chapter_id": chapter_id,
                    "chapter_title": chapter_title,
                    "subchapter_id": sub_doc["_id"],
                    "subchapter_title": sub_doc.get("subchapterTitle", ""),
                    "text": text,
                }
            )

        print("Subchapters retrieved")
        return subchapters

    def embed_input(
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

    def retrieve_context(
        self,
        book_id: ObjectId,
        subchapter_id: ObjectId,
        subchapter_text: str,
    ) -> List[Dict]:
        """Retrieve relevant context using vector search."""
        try:
            query_embedding = self.embed_input(subchapter_text)
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
        except Exception as exc:  # noqa: BLE001
            print(f"Error retrieving context: {exc}")
            return []

    def build_prompt(self, subchapter: Dict) -> str:
        """Build prompt for question generation."""
        prompt = (
            "You are an exam maker responsible for creating exam questions for a chosen "
            "subchapter in a textbook for students to practice with.\n\n"
            f"Textbook: {subchapter.get('book_title')}\n"
            f"Chapter title: {subchapter.get('chapter_title')}\n"
            f"Subchapter title: {subchapter.get('subchapter_title')}\n"
            f"Generate {self.questions_per_chapter} questions.\n\n"
            "The output should be a JSON object with a key 'questions', containing a list "
            "of questions: [question1, question2, etc.]\n"
            "Each question should be a JSON object with the following fields: "
            "text, alternatives, correct_alternative, difficulty\n\n"
            "IMPORTANT!!! You should add 2 questions at the end that have completely wrong "
            "alternatives and are unrelated and don't make sense\n\n"
        )

        for difficulty, percentage in self.difficulty_distribution.items():
            prompt += f"- {difficulty.capitalize()}: {percentage}% of the questions\n"

        prompt += (
            "\nEnsure that the questions can be understood without needing to read "
            "the subchapter text by supplying the necessary context.\n\n"
            f"<<<\nText: {subchapter.get('text')}\n>>>\n\n"
        )

        context_entries = self.retrieve_context(
            book_id=subchapter["book_id"],
            subchapter_id=subchapter["subchapter_id"],
            subchapter_text=subchapter["text"],
        )
        if context_entries:
            prompt += "Context that might be useful, but is not always necessary:\n"
            for entry in context_entries:
                title = entry.get("subchapterTitle", "Unknown subchapter")
                print(f"Context from: {title}")
                prompt += entry.get("text", "") + "\n\n"

        return prompt

    def evaluate_response(self, response: str) -> List[Dict]:
        """Evaluate generated questions using quality control model."""
        evaluation_prompt = (
            "Evaluate the questions based on these criteria:\n\n"
            "- The question and the answer should be correct\n"
            "- There should not be any spelling mistakes or grammatical mistakes\n"
            "- The question should not require immediate context from the book\n\n"
            "Return a JSON object with a key 'scores': a list of numbers indicating "
            "the confidence score of the question at that index.\n"
            "The scores should be between 0 and 1, where 1 is the highest confidence "
            "and 0 is the lowest. Scores under 0.5 are generally of bad quality.\n\n"
            f"<<<\nQuestions object: {response}\n>>>"
        )

        questions = json.loads(response)["questions"]
        evaluated_response = self.evaluation_model.generate_response(evaluation_prompt)
        scores = json.loads(evaluated_response)["scores"]

        for index, score in enumerate(scores):
            questions[index]["confidence"] = score
        return questions

    def insert_questions(self, questions: List[Dict], subchapter: Dict) -> None:
        """Insert generated questions into MongoDB."""
        for question in questions:
            try:
                self.question_collection.insert_one(
                    {
                        "bookID": subchapter.get("book_id"),
                        "bookTitle": subchapter.get("book_title"),
                        "chapterID": subchapter.get("chapter_id"),
                        "chapterTitle": subchapter.get("chapter_title"),
                        "subchapterID": subchapter.get("subchapter_id"),
                        "subchapterTitle": subchapter.get("subchapter_title"),
                        "question": question["text"],
                        "alternatives": question["alternatives"],
                        "correct_alternative": question["correct_alternative"],
                        "difficulty": question["difficulty"],
                        "confidence": question.get("confidence", 0.0),
                    }
                )
                print("Question inserted")
            except Exception as exc:  # noqa: BLE001
                print(f"Error inserting question: {exc}")

    @function_timer
    def generate_questions(
        self,
        book_id: ObjectId | str,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> None:
        """Generate questions for all subchapters in a book."""
        book_id = self._ensure_object_id(book_id)
        subchapters = self.get_subchapters(book_id, limit, offset)

        print("Generating questions...")
        for subchapter in subchapters:
            try:
                prompt = self.build_prompt(subchapter)
                response = self.generation_model.generate_response(prompt)
                questions = self.evaluate_response(response)
                self.insert_questions(questions, subchapter)
                print(
                    f"Generated {len(questions)} questions for "
                    f"{subchapter['subchapter_title']}"
                )
            except Exception as exc:  # noqa: BLE001
                print(
                    "Error generating questions for "
                    f"{subchapter.get('subchapter_title')}: {exc}"
                )

        print("Question generation complete")


if __name__ == "__main__":
    raise SystemExit("Run QuestionGenerator via an API or orchestration script.")