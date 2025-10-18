"""PDF processing module for extracting, splitting, and uploading textbook chapters."""

import os
import tempfile
from typing import Any, Dict, List

import boto3
import fitz
import PyPDF2
import requests
from bson import ObjectId
from dotenv import load_dotenv

from ..utils.database_funcs import get_mongo_client

load_dotenv()


class PDFProcessor:
    """Handles PDF processing, splitting, and uploading operations."""

    EXCLUDE_TERMS = {
        "appendix",
        "abstract",
        "preface",
        "index",
        "cover",
        "title page",
        "acknowledgments",
        "about the author",
        "about the authors",
        "foreword",
        "prologue",
        "summary",
        "glossary",
        "contents",
        "copyrights",
        "copyright",
    }

    def __init__(self) -> None:
        """Initialize PDF processor with S3 and MongoDB clients."""
        self.bucket_name = os.getenv("AWS_BUCKET_NAME")
        if not self.bucket_name:
            raise ValueError("AWS_BUCKET_NAME environment variable is required")

        self.s3_client = boto3.client("s3")

        mongo_client = get_mongo_client()
        self.db = mongo_client["bookTestMaker"]
        self.books_collection = self.db["books"]
        self.chapter_collection = self.db["chapters"]
        self.subchapter_collection = self.db["subchapters"]

    def create_chapter_structure(
        self,
        pdf_path: str,
        book_title: str,
        max_level: int = 2,
    ) -> List[Dict[str, Any]]:
        """Extract table of contents and build a chapter/subchapter structure."""
        print("Extracting TOC...")
        doc = fitz.open(pdf_path)
        toc = doc.get_toc()
        page_count = doc.page_count

        chapters: List[Dict[str, Any]] = []
        current_chapter: Dict[str, Any] | None = None
        parent_invalid = False

        for level, title, start_page in toc:
            if level > max_level or not title:
                continue

            title_lower = title.lower().strip()
            if level == 1:
                if current_chapter:
                    if current_chapter["end_page"] is None:
                        current_chapter["end_page"] = start_page - 1
                    if current_chapter["subchapters"]:
                        last_sub = current_chapter["subchapters"][-1]
                        if last_sub["end_page"] is None:
                            last_sub["end_page"] = start_page - 1

                parent_invalid = any(term in title_lower for term in self.EXCLUDE_TERMS)
                if parent_invalid:
                    current_chapter = None
                    continue

                current_chapter = {
                    "title": title,
                    "start_page": start_page,
                    "end_page": None,
                    "subchapters": [],
                }
                chapters.append(current_chapter)
            elif level == 2:
                if parent_invalid or current_chapter is None:
                    continue
                if any(term in title_lower for term in self.EXCLUDE_TERMS):
                    if current_chapter["subchapters"]:
                        last_sub = current_chapter["subchapters"][-1]
                        if last_sub["end_page"] is None:
                            last_sub["end_page"] = max(last_sub["start_page"], start_page)
                    continue

                if current_chapter["subchapters"]:
                    last_sub = current_chapter["subchapters"][-1]
                    if last_sub["end_page"] is None:
                        last_sub["end_page"] = max(last_sub["start_page"], start_page)

                current_chapter["subchapters"].append(
                    {
                        "title": title,
                        "start_page": start_page,
                        "end_page": None,
                    }
                )

        # Finalize end pages
        for chapter in chapters:
            if chapter["end_page"] is None:
                chapter["end_page"] = page_count
            if not chapter["subchapters"]:
                chapter["subchapters"].append(
                    {
                        "title": chapter["title"],
                        "start_page": chapter["start_page"],
                        "end_page": chapter["end_page"],
                    }
                )
            else:
                first_sub = chapter["subchapters"][0]
                if first_sub["start_page"] > chapter["start_page"]:
                    chapter["subchapters"].insert(
                        0,
                        {
                            "title": f"{chapter['title']} - introduction",
                            "start_page": chapter["start_page"],
                            "end_page": min(first_sub["start_page"] - 1, chapter["end_page"]),
                        },
                    )
                last_sub = chapter["subchapters"][-1]
                if last_sub["end_page"] is None:
                    last_sub["end_page"] = chapter["end_page"]

        doc.close()
        print(f"TOC extraction complete. Total chapters: {len(chapters)}")
        return chapters

    def upload_to_s3(self, file_path: str, object_name: str) -> str:
        """Upload a local file to S3 and return its public URL."""
        print(f"Uploading {file_path} to S3 as {object_name}...")
        self.s3_client.upload_file(file_path, self.bucket_name, object_name)
        return f"https://{self.bucket_name}.s3.amazonaws.com/{object_name}"

    @staticmethod
    def _sanitize_filename(filename: str) -> str:
        """Remove characters that are invalid for filenames."""
        invalid_chars = [":", "/", "\\", "?", ">", "<", "|", "*", '"']
        for char in invalid_chars:
            filename = filename.replace(char, "-")
        return filename.replace(" ", "_")

    def split_and_upload_subchapters(
        self,
        book_id: ObjectId,
        book_title: str,
        chapters: List[Dict[str, Any]],
        pdf_path: str,
    ) -> tuple[list[ObjectId], list[ObjectId]]:
        """Split the source PDF into subchapters and upload artefacts to S3/MongoDB."""
        chapter_ids: list[ObjectId] = []
        subchapter_ids: list[ObjectId] = []

        with open(pdf_path, "rb") as pdf_file:
            reader = PyPDF2.PdfReader(pdf_file)
            with tempfile.TemporaryDirectory() as working_dir:
                for chapter in chapters:
                    chapter_doc = {
                        "bookID": book_id,
                        "chapterTitle": chapter["title"],
                        "subchapterIds": [],
                        "pageStart": chapter["start_page"],
                        "pageEnd": chapter["end_page"],
                    }
                    chapter_result = self.chapter_collection.insert_one(chapter_doc)
                    chapter_id = chapter_result.inserted_id
                    chapter_ids.append(chapter_id)

                    chapter_sub_ids: list[ObjectId] = []
                    for sub in chapter["subchapters"]:
                        writer = PyPDF2.PdfWriter()
                        start_index = max(sub["start_page"] - 1, 0)
                        end_index = min(sub["end_page"], len(reader.pages))

                        for page_index in range(start_index, end_index):
                            writer.add_page(reader.pages[page_index])

                        safe_chapter = self._sanitize_filename(chapter["title"])
                        safe_sub = self._sanitize_filename(sub["title"])
                        filename = f"{safe_chapter}_{safe_sub}.pdf"
                        local_path = os.path.join(working_dir, filename)

                        with open(local_path, "wb") as output_pdf:
                            writer.write(output_pdf)

                        object_name = f"{book_id}/{filename}"
                        s3_link = self.upload_to_s3(local_path, object_name)

                        sub_doc = {
                            "bookID": book_id,
                            "chapterID": chapter_id,
                            "subchapterTitle": sub["title"],
                            "pageStart": sub["start_page"],
                            "pageEnd": sub["end_page"],
                            "s3Link": s3_link,
                        }
                        sub_result = self.subchapter_collection.insert_one(sub_doc)
                        sub_id = sub_result.inserted_id

                        subchapter_ids.append(sub_id)
                        chapter_sub_ids.append(sub_id)
                        print(
                            f"Uploaded chapter '{chapter['title']}' "
                            f"subchapter '{sub['title']}'"
                        )

                    self.chapter_collection.update_one(
                        {"_id": chapter_id},
                        {"$set": {"subchapterIds": chapter_sub_ids}},
                    )

        return chapter_ids, subchapter_ids

    @staticmethod
    def _download_pdf(pdf_s3_url: str) -> str:
        """Download the PDF from S3 to a temporary path."""
        response = requests.get(pdf_s3_url, stream=True, timeout=60)
        response.raise_for_status()

        fd, tmp_path = tempfile.mkstemp(suffix=".pdf")
        with os.fdopen(fd, "wb") as tmp_file:
            for chunk in response.iter_content(chunk_size=8192):
                tmp_file.write(chunk)
        return tmp_path

    def process_book(
        self,
        book_title: str,
        pdf_s3_url: str,
        visibility: str,
        uploader: ObjectId,
    ) -> Dict[str, str]:
        """Run the PDF ingestion pipeline for a user-uploaded book."""
        if not pdf_s3_url:
            raise ValueError("pdf_s3_url must be provided")
        if not book_title:
            raise ValueError("book_title must be provided")
        if not isinstance(uploader, ObjectId):
            raise TypeError("uploader must be a valid ObjectId")

        normalized_visibility = visibility.strip().lower()
        if normalized_visibility not in {"public", "private"}:
            raise ValueError("visibility must be 'Public' or 'Private'")
        visibility_value = normalized_visibility.capitalize()

        tmp_file_path = self._download_pdf(pdf_s3_url)
        try:
            chapters = self.create_chapter_structure(tmp_file_path, book_title)

            book_doc = {
                "bookTitle": book_title,
                "subchapterIds": [],
                "chapterIds": [],
                "visibility": visibility_value,
                "uploader": uploader,
            }
            book_result = self.books_collection.insert_one(book_doc)
            book_id = book_result.inserted_id

            chapter_ids, subchapter_ids = self.split_and_upload_subchapters(
                book_id=book_id,
                book_title=book_title,
                chapters=chapters,
                pdf_path=tmp_file_path,
            )

            self.books_collection.update_one(
                {"_id": book_id},
                {"$set": {"chapterIds": chapter_ids, "subchapterIds": subchapter_ids}},
            )

            return {"book_id": str(book_id), "book_title": book_title}
        finally:
            if tmp_file_path and os.path.exists(tmp_file_path):
                os.remove(tmp_file_path)


if __name__ == "__main__":
    raise SystemExit(
        "Run PDFProcessor via the pipelines or provide required parameters."
    )