"""Question generation module using RAG and LLM for creating exam questions."""

import os
import json
from typing import List, Dict, Optional
from io import BytesIO
import requests
from PyPDF2 import PdfReader
from pymongo import MongoClient
from dotenv import load_dotenv
from bson import ObjectId
import numpy as np

from ..models.ai_models import MistralModel, MistralEmbed, MistralSmall
from ..utils.timing import function_timer
from ..utils.tokenizer import Tokenizer
from ..utils.database_funcs import get_mongo_client, delete_collection

load_dotenv()


class QuestionGenerator:
    """Generates exam questions using RAG and LLM models."""
    
    DEFAULT_RAG_DEPTH = 5
    DEFAULT_QUESTIONS_PER_CHAPTER = 8
    DEFAULT_DIFFICULTY_DISTRIBUTION = {
        "easy": 33,
        "medium": 33,
        "hard": 34
    }
    
    def __init__(
        self,
        rag_depth: int = DEFAULT_RAG_DEPTH,
        questions_per_chapter: int = DEFAULT_QUESTIONS_PER_CHAPTER,
        difficulty_distribution: Optional[Dict[str, int]] = None
    ):
        """
        Initialize question generator.
        
        Args:
            rag_depth: Number of context chunks to retrieve
            questions_per_chapter: Number of questions to generate per subchapter
            difficulty_distribution: Dict mapping difficulty levels to percentages
        """
        self.rag_depth = rag_depth
        self.questions_per_chapter = questions_per_chapter
        self.difficulty_distribution = (
            difficulty_distribution or self.DEFAULT_DIFFICULTY_DISTRIBUTION
        )
        
        mongo_client = get_mongo_client()
        self.db = mongo_client["bookTestMaker"]
        self.subchapter_collection = self.db["subchapters"]
        self.question_collection = self.db["questions"]
        self.books_collection = self.db["books"]
        self.chunk_embedding_collection = self.db["chunkEmbeddings"]
        
        self.tokenizer = Tokenizer()
        self.embed_model = MistralEmbed()
        self.generation_model = MistralModel()
        self.evaluation_model = MistralSmall()
    
    @function_timer
    def get_subchapters(
        self, 
        book_name: Optional[str] = None, 
        book_id: Optional[str] = None,
        limit: Optional[int] = None,
        offset: int = 0
    ) -> List[Dict]:
        """
        Retrieve subchapter content from MongoDB.
        
        Args:
            book_name: Name of the book
            book_id: MongoDB ObjectId of the book
            limit: Maximum number of subchapters to retrieve
            offset: Starting index for retrieval
            
        Returns:
            List of subchapter dictionaries with text content
        """
        print("Getting subchapters...")
        
        # Get subchapter IDs
        if book_id:
            book_doc = self.books_collection.find_one({"_id": ObjectId(book_id)})
        elif book_name:
            book_doc = self.books_collection.find_one({"book_title": book_name})
        else:
            raise ValueError("Must provide either book_name or book_id")
        
        if not book_doc:
            raise ValueError("Book not found")
        
        subchapter_ids = book_doc["subchapter_ids"]
        
        # Apply offset and limit
        if limit:
            subchapter_ids = subchapter_ids[offset:offset + limit]
        else:
            subchapter_ids = subchapter_ids[offset:]
        
        docs = list(self.subchapter_collection.find({"_id": {"$in": subchapter_ids}}))
        subchapters = []
        
        for subchapter in docs:
            pdf_url = subchapter.get("s3_link")
            book_name = subchapter.get("book_name")
            chapter_title = subchapter.get("chapter_title")
            subchapter_title = subchapter.get("subchapter_title")
            
            print(f"Processing: {subchapter_title}")
            
            # Download and extract text from PDF
            response = requests.get(pdf_url)
            pdf_file = BytesIO(response.content)
            reader = PdfReader(pdf_file)
            
            text = ""
            for page in reader.pages:
                text += page.extract_text()
            
            subchapters.append({
                "book_name": book_name,
                "chapter_title": chapter_title,
                "subchapter_title": subchapter_title,
                "text": text
            })
        
        print("Subchapters retrieved")
        return subchapters
    
    def embed_input(
        self, 
        text: str, 
        overlap: int = 50, 
        max_chunk_size: int = 3064
    ) -> List[float]:
        """
        Create embedding for input text by averaging chunk embeddings.
        
        Args:
            text: Input text to embed
            overlap: Overlap between chunks
            max_chunk_size: Maximum chunk size
            
        Returns:
            Average embedding vector
        """
        embeddings = []
        
        for i in range(0, len(text), max_chunk_size - overlap):
            chunk = text[i:i + max_chunk_size]
            embedding = self.embed_model.generate_response(chunk)
            embeddings.append(embedding)
            
            if i + max_chunk_size >= len(text):
                break
        
        return np.mean(np.array(embeddings), axis=0).tolist()
    
    def retrieve_context(
        self, 
        book_name: str, 
        subchapter_title: str, 
        subchapter_text: str
    ) -> List[Dict]:
        """
        Retrieve relevant context using vector search.
        
        Args:
            book_name: Name of the book
            subchapter_title: Title of current subchapter (to exclude)
            subchapter_text: Text to use for similarity search
            
        Returns:
            List of relevant context documents
        """
        try:
            query_embedding = self.embed_input(subchapter_text)
            
            pipeline = [
                {
                    "$vectorSearch": {
                        "index": "vector_index",
                        "queryVector": query_embedding,
                        "path": "embedding",
                        "filter": {
                            "book_name": book_name,
                            "subchapter_title": {"$ne": subchapter_title}
                        },
                        "exact": True,
                        "limit": self.rag_depth
                    }
                },
                {
                    "$project": {
                        "_id": 0,
                        "text": 1,
                        "subchapter_title": 1
                    }
                }
            ]
            
            results = self.chunk_embedding_collection.aggregate(pipeline)
            return list(results)
            
        except Exception as e:
            print(f"Error retrieving context: {e}")
            return []
    
    def build_prompt(self, subchapter: Dict) -> str:
        """
        Build prompt for question generation.
        
        Args:
            subchapter: Dictionary containing subchapter information
            
        Returns:
            Formatted prompt string
        """
        prompt = (
            "You are an exam maker responsible for creating exam questions for a chosen "
            "subchapter in a textbook for students to practice with.\n\n"
            f"Textbook: {subchapter.get('book_name')}\n"
            f"Chapter title: {subchapter.get('chapter_title')}\n"
            f"Subchapter title: {subchapter.get('subchapter_title')}\n"
            f"Generate {self.questions_per_chapter} questions.\n\n"
            "The output should be a JSON object with a key 'questions', containing a list "
            "of questions: [question1, question2, etc.]\n"
            "Each question should be a JSON object with the following fields: "
            "text, alternatives, correct_alternative, difficulty\n\n"
            "IMPORTANT!!! You should add 2 questions at the end that have completely wrong "
            "alternatives and are unrelated and don't make sense\n\n"
            "###\nExamples:\n\n"
            "Text: subchapter about pathfinding algorithms\n"
            "JSON:\n{\n"
            "  'questions': [\n"
            "    {\n"
            "      'text': 'What is the time complexity of Dijkstra\\'s algorithm?',\n"
            "      'alternatives': ['O(n)', 'O(n^2)', 'O(n log n)', 'O(n^3)'],\n"
            "      'correct_alternative': 'C',\n"
            "      'difficulty': 'easy'\n"
            "    }\n"
            "  ]\n"
            "}\n###\n\n"
            f"<<<\nText: {subchapter.get('text')}\n>>>\n\n"
        )
        
        # Add difficulty distribution
        for difficulty, percentage in self.difficulty_distribution.items():
            prompt += f"- {difficulty.capitalize()}: {percentage}% of the questions\n"
        
        prompt += (
            "\nEnsure that the questions can be understood without needing to read "
            "the subchapter text by supplying the necessary context.\n\n"
        )
        
        # Add RAG context
        context = self.retrieve_context(
            subchapter.get('book_name'),
            subchapter.get('subchapter_title'),
            subchapter.get('text')
        )
        
        if context:
            prompt += "Context that might be useful, but is not always necessary:\n"
            for entry in context:
                print(f"Context from: {entry['subchapter_title']}")
                prompt += entry["text"] + "\n\n"
        
        return prompt
    
    def evaluate_response(self, response: str) -> List[Dict]:
        """
        Evaluate generated questions using quality control model.
        
        Args:
            response: JSON string containing generated questions
            
        Returns:
            List of questions with confidence scores
        """
        evaluation_prompt = (
            "Evaluate the questions based on these criteria:\n\n"
            "- The question and the answer should be correct\n"
            "- There should not be any spelling mistakes or grammatical mistakes\n"
            "- The question should not require immediate context from the book\n\n"
            "Return a JSON object with a key 'scores': a list of numbers indicating "
            "the confidence score of the question at that index.\n"
            "The scores should be between 0 and 1, where 1 is the highest confidence "
            "and 0 is the lowest. Scores under 0.5 are generally of bad quality.\n\n"
            "###\nExamples:\n\n"
            "Questions object: An object with 7 questions\n"
            "JSON:\n{\"scores\": [0.7, 0.9, 0.5, 0.45, 0.95, 0.11, 0.23]}\n"
            "###\n\n"
            f"<<<\nQuestions object: {response}\n>>>"
        )
        
        questions = json.loads(response)["questions"]
        evaluated_response = self.evaluation_model.generate_response(evaluation_prompt)
        scores = json.loads(evaluated_response)["scores"]
        
        for i, score in enumerate(scores):
            questions[i]["confidence"] = score
        
        return questions
    
    def insert_questions(self, questions: List[Dict], subchapter: Dict) -> None:
        """
        Insert generated questions into MongoDB.
        
        Args:
            questions: List of question dictionaries
            subchapter: Subchapter metadata
        """
        for question in questions:
            try:
                self.question_collection.insert_one({
                    "book_name": subchapter.get("book_name"),
                    "chapter_title": subchapter.get("chapter_title"),
                    "subchapter_title": subchapter.get("subchapter_title"),
                    "question": question["text"],
                    "alternatives": question["alternatives"],
                    "correct_alternative": question["correct_alternative"],
                    "difficulty": question["difficulty"],
                    "confidence": question.get("confidence", 0.0)
                })
                print("Question inserted")
            except Exception as e:
                print(f"Error inserting question: {e}")
    
    @function_timer
    def generate_questions(
        self, 
        book_name: Optional[str] = None,
        book_id: Optional[str] = None,
        limit: Optional[int] = None,
        offset: int = 0
    ) -> None:
        """
        Generate questions for all subchapters in a book.
        
        Args:
            book_name: Name of the book
            book_id: MongoDB ObjectId of the book
            limit: Maximum number of subchapters to process
            offset: Starting index
        """
        subchapters = self.get_subchapters(book_name, book_id, limit, offset)
        
        print("Generating questions...")
        for subchapter in subchapters:
            try:
                prompt = self.build_prompt(subchapter)
                response = self.generation_model.generate_response(prompt)
                questions = self.evaluate_response(response)
                self.insert_questions(questions, subchapter)
                
                print(f"Generated {len(questions)} questions for "
                      f"{subchapter['subchapter_title']}")
            except Exception as e:
                print(f"Error generating questions for "
                      f"{subchapter.get('subchapter_title')}: {e}")
        
        print("Question generation complete")


if __name__ == '__main__':    
    # Generate questions
    generator = QuestionGenerator()
    generator.generate_questions()