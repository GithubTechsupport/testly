"""Text embedding module for creating and storing vector embeddings of textbook content."""

from typing import Dict, List, Tuple
from io import BytesIO

import requests
from PyPDF2 import PdfReader
from bson import ObjectId
from bson.errors import InvalidId
from dotenv import load_dotenv

from ..models.ai_models import MistralEmbed, MistralOCR
from ..utils.timing import function_timer
from ..utils.tokenizer import Tokenizer
from ..utils.database_funcs import get_mongo_client

load_dotenv()


class TextEmbedder:
    """Handles text chunking and embedding for retrieval-augmented generation."""

    DEFAULT_CHUNK_SIZE = 3064
    DEFAULT_OVERLAP = 50

    def __init__(
        self,
        max_chunk_size: int = DEFAULT_CHUNK_SIZE,
        overlap: int = DEFAULT_OVERLAP,
    ):
        self.max_chunk_size = max_chunk_size
        self.overlap = overlap

        mongo_client = get_mongo_client()
        self.db = mongo_client["bookTestMaker"]
        self.embedding_collection = self.db["chunkEmbeddings"]
        self.subchapter_collection = self.db["subchapters"]
        self.chapter_collection = self.db["chapters"]
        self.books_collection = self.db["books"]

        self.tokenizer = Tokenizer()
        self.embed_model = MistralEmbed()
        self.ocr_model = MistralOCR()

    @staticmethod
    def _ensure_object_id(value: ObjectId | str) -> ObjectId:
        if isinstance(value, ObjectId):
            return value
        try:
            return ObjectId(value)
        except (InvalidId, TypeError) as exc:
            raise ValueError("book_id must be a valid ObjectId") from exc

    def chunk_text(self, text: str) -> List[str]:
        """Split text into overlapping chunks."""
        chunks: List[str] = []
        step = self.max_chunk_size - self.overlap

        for i in range(0, len(text), step):
            chunk = text[i : i + self.max_chunk_size]
            chunks.append(chunk)
            if i + self.max_chunk_size >= len(text):
                break

        return chunks

    @function_timer
    def test_ocr(self, subchapter_title: str) -> str:
        """Test OCR functionality on a specific subchapter."""
        entry = self.subchapter_collection.find_one({"subchapterTitle": subchapter_title})
        if not entry or "s3Link" not in entry:
            raise ValueError("Subchapter not found or missing s3Link")
        url = entry["s3Link"]
        return self.ocr_model.generate_response(url)

    @function_timer
    def get_chunks(
        self,
        book_id: ObjectId | str,
        use_ocr: bool = False,
    ) -> Tuple[List[str], List[Dict[str, ObjectId | str]]]:
        """Retrieve and chunk all subchapters for a book."""
        book_id = self._ensure_object_id(book_id)
        book_doc = self.books_collection.find_one({"_id": book_id})
        if not book_doc:
            raise ValueError(f"Book not found: {book_id}")

        subchapter_ids = book_doc.get("subchapterIds", [])
        if not subchapter_ids:
            raise ValueError("Book has no subchapters to embed")

        order_map = {sub_id: index for index, sub_id in enumerate(subchapter_ids)}
        sub_docs = list(
            self.subchapter_collection.find({"_id": {"$in": subchapter_ids}})
        )
        sub_docs.sort(key=lambda doc: order_map.get(doc["_id"], len(subchapter_ids)))

        chunks: List[str] = []
        metadata: List[Dict[str, ObjectId | str]] = []

        print("Creating chunks...")
        for idx, sub_doc in enumerate(sub_docs, start=1):
            s3_link = sub_doc.get("s3Link")
            if not s3_link:
                raise ValueError(
                    f"Subchapter {sub_doc.get('subchapterTitle')} missing s3Link"
                )

            if use_ocr:
                text = self.ocr_model.generate_response(s3_link)
            else:
                response = requests.get(s3_link, timeout=60)
                response.raise_for_status()
                pdf_file = BytesIO(response.content)
                reader = PdfReader(pdf_file)
                text = "".join(page.extract_text() or "" for page in reader.pages)

            current_chunks = self.chunk_text(text)
            for chunk in current_chunks:
                chunks.append(chunk)
                metadata.append(
                    {
                        "subchapter_id": sub_doc["_id"],
                        "chapter_id": sub_doc.get("chapterID"),
                        "subchapter_title": sub_doc.get("subchapterTitle", ""),
                    }
                )
            print(f"{idx} / {len(sub_docs)}", end="\r")

        print("\nChunks created")
        return chunks, metadata

    @function_timer
    def embed_all_chunks(self, chunks: List[str]) -> List[List[float]]:
        """Generate embeddings for all chunks."""
        embeddings_list: List[List[float]] = []
        total = len(chunks)

        print("Embedding chunks...")
        for i, chunk in enumerate(chunks, start=1):
            embedding = self.embed_model.generate_response(chunk)
            embeddings_list.append(embedding)
            print(f"{i} / {total}", end="\r")

        print("\nChunks embedded")
        return embeddings_list

    @function_timer
    def insert_embeddings(
        self,
        book_id: ObjectId,
        chunks: List[str],
        embeddings: List[List[float]],
        metadata: List[Dict[str, ObjectId | str]],
    ) -> None:
        """Insert chunks and embeddings into MongoDB."""
        print("Inserting embeddings into MongoDB...")

        documents = []
        for index, (chunk, embedding, meta) in enumerate(
            zip(chunks, embeddings, metadata), start=1
        ):
            documents.append(
                {
                    "bookID": book_id,
                    "chapterID": meta.get("chapter_id"),
                    "subchapterID": meta.get("subchapter_id"),
                    "subchapterTitle": meta.get("subchapter_title"),
                    "chunkIndex": index,
                    "text": chunk,
                    "embedding": embedding,
                }
            )

        if documents:
            self.embedding_collection.insert_many(documents)
        print("Embeddings inserted")

    def process_book(
        self,
        book_id: ObjectId | str,
        use_ocr: bool = False,
    ) -> None:
        """Complete pipeline to embed a book."""
        book_id = self._ensure_object_id(book_id)
        chunks, metadata = self.get_chunks(book_id, use_ocr)
        embeddings = self.embed_all_chunks(chunks)
        self.insert_embeddings(book_id, chunks, embeddings, metadata)


if __name__ == "__main__":
    raise SystemExit("Run TextEmbedder via an orchestrating script or API.")