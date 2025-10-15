"""Text embedding module for creating and storing vector embeddings of textbook content."""

import os
from typing import List, Tuple, Optional
from io import BytesIO
import requests
from PyPDF2 import PdfReader
from pymongo import MongoClient
from dotenv import load_dotenv
from bson import ObjectId

from ..models.ai_models import MistralEmbed, MistralOCR
from ..utils.timing import function_timer
from ..utils.tokenizer import Tokenizer
from ..utils.database_funcs import get_mongo_client, get_entry_single
from ..data import BOOK_CATALOG


load_dotenv()


class TextEmbedder:
    """Handles text chunking and embedding for retrieval-augmented generation."""
    
    DEFAULT_CHUNK_SIZE = 3064
    DEFAULT_OVERLAP = 50
    
    def __init__(
        self, 
        max_chunk_size: int = DEFAULT_CHUNK_SIZE,
        overlap: int = DEFAULT_OVERLAP
    ):
        """
        Initialize text embedder with MongoDB connection and models.
        
        Args:
            max_chunk_size: Maximum size of text chunks
            overlap: Overlap between consecutive chunks
        """
        self.max_chunk_size = max_chunk_size
        self.overlap = overlap
        
        mongo_client = get_mongo_client()
        self.db = mongo_client["bookTestMaker"]
        self.embedding_collection = self.db["chunkEmbeddings"]
        self.subchapter_collection = self.db["subchapters"]
        self.books_collection = self.db["books"]
        
        self.tokenizer = Tokenizer()
        self.embed_model = MistralEmbed()
        self.ocr_model = MistralOCR()
    
    def chunk_text(self, text: str) -> List[str]:
        """
        Split text into overlapping chunks.
        
        Args:
            text: Input text to chunk
            
        Returns:
            List of text chunks
        """
        chunks = []
        
        for i in range(0, len(text), self.max_chunk_size - self.overlap):
            chunk = text[i:i + self.max_chunk_size]
            chunks.append(chunk)
            
            if i + self.max_chunk_size >= len(text):
                break
        
        return chunks
    
    @function_timer
    def test_ocr(self, subchapter_title: str) -> str:
        """
        Test OCR functionality on a specific subchapter.
        
        Args:
            subchapter_title: Title of subchapter to test
            
        Returns:
            OCR extracted text
        """
        entry = get_entry_single(
            self.subchapter_collection, 
            "subchapter_title", 
            subchapter_title
        )
        url = entry.get("s3_link")
        response = self.ocr_model.generate_response(url)
        return response
    
    @function_timer
    def get_chunks(
        self, 
        book_id: Optional[str] = None,
        use_ocr: bool = False
    ) -> Tuple[List[str], List[str]]:
        """
        Retrieve and chunk all subchapters for a book.
        
        Args:
            book_name: Name of the book
            book_id: Optional MongoDB ObjectId of the book
            use_ocr: Whether to use OCR for text extraction
            
        Returns:
            Tuple of (chunks list, subchapter titles list)
        """
        print("Getting subchapters...")
        chunks = []
        subchapters = []
        
        # Get subchapter IDs
        if book_id:
            book_doc = self.books_collection.find_one({"_id": book_id})
        
        if not book_doc:
            raise ValueError(f"Book not found: {book_id}")

        subchapter_ids = book_doc["subchapter_ids"]
        docs = list(self.subchapter_collection.find({"_id": {"$in": subchapter_ids}}))
        total = len(docs)
        
        print("Subchapters retrieved")
        print("Creating chunks...")
        
        for i, subchapter in enumerate(docs, start=1):
            subchapter_title = subchapter.get("subchapter_title")
            pdf_url = subchapter.get("s3_link")
            text = ""
            
            if use_ocr:
                text = self.ocr_model.generate_response(pdf_url)
            else:
                response = requests.get(pdf_url)
                pdf_file = BytesIO(response.content)
                reader = PdfReader(pdf_file)
                
                for page in reader.pages:
                    text += page.extract_text()
            
            current_chunks = self.chunk_text(text)
            chunks.extend(current_chunks)
            subchapters.extend([subchapter_title] * len(current_chunks))
            
            print(f"{i} / {total}", end="\r")
        
        print("\nChunks created")
        return chunks, subchapters
    
    @function_timer
    def embed_all_chunks(self, chunks: List[str]) -> List[List[float]]:
        """
        Generate embeddings for all chunks.
        
        Args:
            chunks: List of text chunks
            
        Returns:
            List of embedding vectors
        """
        print("Embedding chunks...")
        total = len(chunks)
        embeddings_list = []
        
        for i, chunk in enumerate(chunks, start=1):
            try:
                embedding = self.embed_model.generate_response(chunk)
                embeddings_list.append(embedding)
            except Exception as e:
                print(f"\nError embedding chunk {i}: {e}")
                continue
            
            print(f"{i} / {total}", end="\r")
        
        print("\nChunks embedded")
        return embeddings_list
    
    @function_timer
    def insert_embeddings(
        self, 
        chunks: List[str], 
        embeddings: List[List[float]], 
        subchapters: List[str], 
        book_id: ObjectId
    ) -> None:
        """
        Insert chunks and embeddings into MongoDB.
        
        Args:
            chunks: List of text chunks
            embeddings: List of embedding vectors
            subchapters: List of subchapter titles
            book_id: MongoDB ObjectId of the book
        """
        print("Inserting into MongoDB...")
        
        docs_to_insert = [
            {
                "book_id": book_id,
                "subchapter_title": subchapter,
                "text": chunk,
                "embedding": embedding
            }
            for chunk, embedding, subchapter in zip(chunks, embeddings, subchapters)
        ]
        
        self.embedding_collection.insert_many(docs_to_insert)
        print("Inserted into MongoDB")
    
    def process_book(
        self,
        book_id: ObjectId,
        use_ocr: bool = False,
    ) -> None:
        """
        Complete pipeline to embed a book.
        
        Args:
            book_name: Name of the book
            book_id: Optional MongoDB ObjectId
            use_ocr: Whether to use OCR
            clear_existing: Whether to clear existing embeddings
        """
        
        chunks, subchapters = self.get_chunks(book_id, use_ocr)
        embeddings = self.embed_all_chunks(chunks)
        self.insert_embeddings(chunks, embeddings, subchapters, book_id)


if __name__ == "__main__":
    embedder = TextEmbedder()
    
    embedder.process_book(BOOK_CATALOG.get("1"))