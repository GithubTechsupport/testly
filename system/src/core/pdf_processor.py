"""PDF processing module for extracting, splitting, and uploading textbook chapters."""

import os
import tempfile
from typing import Dict, List, Optional

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
        self.s3_client = boto3.client("s3")
        self.bucket_name = os.getenv("AWS_BUCKET_NAME")

        mongo_client = get_mongo_client()
        self.db = mongo_client["bookTestMaker"]
        self.subchapter_collection = self.db["subchapters"]
        self.books_collection = self.db["bookInfo"]

    def create_subchapter_partitions(
        self,
        pdf_path: str,
        book_name: str,
        max_level: int = 2,
    ) -> List[Dict]:
        """
        Extract table of contents and create subchapter partitions.

        Args:
            pdf_path: Path to the PDF file.
            book_name: Name provided by the user.
            max_level: Maximum TOC depth to keep.

        Returns:
            List of partition dictionaries containing chapter/subchapter info.
        """
        print("Extracting TOC...")
        doc = fitz.open(pdf_path)
        toc = doc.get_toc()

        partitions: List[Dict] = []
        prev_title: Optional[str] = None
        parent_title: Optional[str] = None
        parent_invalid = False

        for level, title, start_page in toc:
            if level > max_level:
                continue

            if partitions and partitions[-1]["subchapter_title"] == prev_title:
                partitions[-1]["end_page"] = start_page

            if level == 1:
                parent_title = title
                parent_invalid = False
            elif parent_invalid:
                prev_title = title
                continue

            title_lower = title.lower().strip()
            if any(term in title_lower for term in self.EXCLUDE_TERMS):
                if level == 1:
                    parent_invalid = True
                prev_title = title
                continue

            prev_title = title
            partitions.append(
                {
                    "level": level,
                    "book_name": book_name,
                    "chapter_title": parent_title,
                    "subchapter_title": title,
                    "start_page": start_page,
                    "end_page": None,
                }
            )

        if partitions and partitions[-1]["end_page"] is None:
            partitions[-1]["end_page"] = doc.page_count + 1

        doc.close()
        print(f"TOC extraction complete. Total subchapters: {len(partitions)}")
        return partitions

    def add_chapter_numbers(self, partitions: List[Dict]) -> None:
        """Annotate partitions with chapter and subchapter ordering."""
        print("Adding chapter and subchapter numbers...")
        chapter_counter = 0
        subchapter_counter = 0

        for entry in partitions:
            if entry["level"] == 1:
                subchapter_counter = 0
                chapter_counter += 1
            subchapter_counter += 1
            entry["chapter_number"] = chapter_counter
            entry["subchapter_number"] = subchapter_counter

        print("Added chapter and subchapter numbers")

    def upload_to_s3(self, file_path: str, object_name: str) -> Optional[str]:
        """Upload a local file to S3."""
        print(f"Uploading {file_path} to S3...")
        try:
            self.s3_client.upload_file(file_path, self.bucket_name, object_name)
            return f"https://{self.bucket_name}.s3.amazonaws.com/{object_name}"
        except Exception as exc:  # noqa: BLE001
            print(f"Error uploading {file_path} to S3: {exc}")
            return None

    @staticmethod
    def _sanitize_filename(filename: str) -> str:
        """Remove characters that are invalid for filenames."""
        invalid_chars = [":", "/", "\\", "?", ">", "<"]
        for char in invalid_chars:
            filename = filename.replace(char, "-")
        return filename.replace(" ", "_")

    def split_and_upload_pdfs(
        self,
        book_title: str,
        partitions: List[Dict],
        pdf_path: str,
        original_pdf_s3_url: str,
        output_dir: str = "/tmp",
    ) -> ObjectId:
        """
        Split the source PDF into subchapters and upload artefacts to S3/MongoDB.

        Returns:
            ObjectId of the created book document.
        """
        print("Splitting PDF into subchapters...")
        pdf_reader = PyPDF2.PdfReader(pdf_path)

        subchapter_ids: List[ObjectId] = []
        subchapter_infos: List[List] = []
        chapter_title_order: List[str] = []
        chapter_ranges: Dict[str, List[int]] = {}

        os.makedirs(output_dir, exist_ok=True)

        for partition in partitions:
            if partition["end_page"] is None:
                continue

            pdf_writer = PyPDF2.PdfWriter()
            for page_num in range(partition["start_page"] - 1, partition["end_page"]):
                pdf_writer.add_page(pdf_reader.pages[page_num])

            safe_chap_title = self._sanitize_filename(
                partition.get("chapter_title") or partition["subchapter_title"]
            )
            safe_sub_title = self._sanitize_filename(partition["subchapter_title"])
            output_filename = (
                f"{partition['book_name']}_Chapter_{safe_chap_title}_"
                f"Subchapter_{safe_sub_title}.pdf"
            )
            output_filepath = os.path.join(output_dir, output_filename)

            with open(output_filepath, "wb") as output_pdf:
                pdf_writer.write(output_pdf)

            s3_link = self.upload_to_s3(output_filepath, output_filename)
            os.remove(output_filepath)

            if not s3_link:
                continue

            try:
                partition["s3_link"] = s3_link
                partition["book_name"] = book_title
                partition.pop("level", None)

                result = self.subchapter_collection.insert_one(partition)
                subchapter_id = result.inserted_id
                subchapter_ids.append(subchapter_id)
                subchapter_infos.append(
                    [partition["subchapter_title"], partition["start_page"]]
                )

                chapter_title = partition.get("chapter_title") or partition[
                    "subchapter_title"
                ]
                current_index = len(subchapter_infos) - 1

                if chapter_title not in chapter_ranges:
                    chapter_title_order.append(chapter_title)
                    chapter_ranges[chapter_title] = [current_index, current_index]
                else:
                    chapter_ranges[chapter_title][1] = current_index

                print(f"Uploaded {output_filename} to S3 and MongoDB")
            except Exception as exc:  # noqa: BLE001
                print(f"Failed to upload {output_filename} to MongoDB: {exc}")

        chapter_infos = [
            [title, *chapter_ranges[title]] for title in chapter_title_order
        ]

        try:
            print("Uploading book info...")
            book_info = {
                "book_title": book_title,
                "s3_link": original_pdf_s3_url,
                "subchapter_ids": subchapter_ids,
                "subchapter_infos": subchapter_infos,
                "chapter_infos": chapter_infos,
            }
            inserted_book = self.books_collection.insert_one(book_info)
            book_id = inserted_book.inserted_id

            if subchapter_ids:
                self.subchapter_collection.update_many(
                    {"_id": {"$in": subchapter_ids}},
                    {"$set": {"book_id": book_id}},
                )

            print("Book info uploaded successfully")
            return book_id
        except Exception as exc:  # noqa: BLE001
            print(f"Failed to upload {book_title} to MongoDB: {exc}")
            raise

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
        book_name: str,
        pdf_s3_url: str,
    ) -> Dict[str, str]:
        """
        Run the PDF ingestion pipeline for a user-uploaded book.

        Args:
            book_name: Name supplied by the end user.
            pdf_s3_url: Location of the uploaded PDF in S3.

        Returns:
            Dictionary containing the inserted book_id and book_title.
        """
        if not pdf_s3_url:
            raise ValueError("pdf_s3_url must be provided")
        if not book_name:
            raise ValueError("book_name must be provided")

        tmp_file_path = self._download_pdf(pdf_s3_url)
        try:
            partitions = self.create_subchapter_partitions(tmp_file_path, book_name)
            self.add_chapter_numbers(partitions)
            book_id = self.split_and_upload_pdfs(
                book_name,
                partitions,
                tmp_file_path,
                original_pdf_s3_url=pdf_s3_url,
            )
            return {"book_id": str(book_id), "book_title": book_name}
        finally:
            if tmp_file_path and os.path.exists(tmp_file_path):
                os.remove(tmp_file_path)


if __name__ == "__main__":
    raise SystemExit(
        "Run PDFProcessor via the pipelines or provide a book name and S3 link."
    )
