"""PDF processing module for extracting, splitting, and uploading textbook chapters."""

import os
from typing import List, Dict, Optional
import PyPDF2
import fitz
import boto3
from dotenv import load_dotenv

from ..data import BOOK_CATALOG
from ..utils import get_mongo_client

load_dotenv()

class PDFProcessor:
    """Handles PDF processing, splitting, and uploading operations."""
    
    EXCLUDE_TERMS = {
        "appendix", "abstract", "preface", "index",
        "cover", "title page", "acknowledgments",
        "about the author", "about the authors", "foreword",
        "prologue", "summary", "glossary", "contents", "copyrights", "copyright",
    }
    
    def __init__(self):
        """Initialize PDF processor with S3 and MongoDB clients."""
        self.s3_client = boto3.client('s3')
        self.bucket_name = os.getenv("AWS_BUCKET_NAME")
        
        mongo_client = get_mongo_client()
        self.db = mongo_client["bookTestMaker"]
        self.subchapter_collection = self.db["subchapters"]
        self.books_collection = self.db["books"]
    
    def create_subchapter_partitions(
        self, 
        pdf_path: str, 
        book_name: str, 
        max_level: int = 2
    ) -> List[Dict]:
        """
        Extract table of contents and create subchapter partitions.
        
        Args:
            pdf_path: Path to the PDF file
            book_name: Name of the book
            max_level: Maximum TOC level to include (default: 2)
            
        Returns:
            List of partition dictionaries containing chapter/subchapter info
        """
        print("Extracting TOC...")
        doc = fitz.open(pdf_path)
        toc = doc.get_toc()
        
        partitions = []
        prev_title = None
        parent_title = None
        parent_invalid = False
        
        for entry in toc:
            level, title, start_page = entry
            
            if level > max_level:
                continue
            
            # Update end page of previous partition
            if partitions and partitions[-1]["subchapter_title"] == prev_title:
                partitions[-1]["end_page"] = start_page
            
            # Handle parent chapter
            if level == 1:
                parent_title = title
                parent_invalid = False
            elif parent_invalid:
                prev_title = title
                continue
            
            # Filter out excluded terms
            title_lower = title.lower().strip()
            if any(term in title_lower for term in self.EXCLUDE_TERMS):
                if level == 1:
                    parent_invalid = True
                prev_title = title
                continue
            
            prev_title = title
            partitions.append({
                "level": level,
                "book_name": book_name,
                "chapter_title": parent_title,
                "subchapter_title": title,
                "start_page": start_page,
                "end_page": None
            })
        
        print(f"TOC extraction complete. Total subchapters: {len(partitions)}")
        return partitions
    
    def add_chapter_numbers(self, partitions: List[Dict]) -> None:
        """
        Add chapter and subchapter numbering to partitions.
        
        Args:
            partitions: List of partition dictionaries (modified in place)
        """
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
        """
        Upload file to S3 bucket.
        
        Args:
            file_path: Local path to file
            object_name: S3 object name
            
        Returns:
            S3 URL if successful, None otherwise
        """
        print(f"Uploading {file_path} to S3...")
        try:
            self.s3_client.upload_file(file_path, self.bucket_name, object_name)
            return f"https://{self.bucket_name}.s3.amazonaws.com/{object_name}"
        except Exception as e:
            print(f"Error uploading {file_path} to S3: {e}")
            return None
    
    def _sanitize_filename(self, filename: str) -> str:
        """Remove invalid characters from filename."""
        invalid_chars = [':', '/', '\\', '?', '>', '<']
        for char in invalid_chars:
            filename = filename.replace(char, '-')
        return filename.replace(' ', '_')
    
    def split_and_upload_pdfs(
        self, 
        book_title: str, 
        partitions: List[Dict], 
        pdf_path: str,
        output_dir: str = "/tmp"
    ) -> List[Dict]:
        """
        Split PDF into subchapters and upload to S3 and MongoDB.
        
        Args:
            book_title: Title of the book
            partitions: List of partition dictionaries
            pdf_path: Path to source PDF
            output_dir: Directory for temporary PDF files
            
        Returns:
            Updated partitions list with S3 links
        """
        print("Splitting PDF into subchapters...")
        pdf_reader = PyPDF2.PdfReader(pdf_path)
        subchapter_ids = []
        subchapter_infos = []
        chapter_infos = []
        chapter_first_index = 0
        
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        for i, partition in enumerate(partitions):
            pdf_writer = PyPDF2.PdfWriter()
            
            # Add pages to writer
            for page_num in range(partition["start_page"] - 1, partition["end_page"]):
                pdf_writer.add_page(pdf_reader.pages[page_num])
            
            # Create sanitized filename
            safe_chap_title = self._sanitize_filename(partition["chapter_title"])
            safe_sub_title = self._sanitize_filename(partition["subchapter_title"])
            output_filename = (
                f"{partition['book_name']}_Chapter_{safe_chap_title}_"
                f"Subchapter_{safe_sub_title}.pdf"
            ).replace(' ', '_')
            
            output_filepath = os.path.join(output_dir, output_filename)
            
            # Write PDF file
            with open(output_filepath, "wb") as output_pdf:
                pdf_writer.write(output_pdf)
            
            # Upload to S3
            s3_link = self.upload_to_s3(output_filepath, output_filename)
            if s3_link:
                try:
                    partition["s3_link"] = s3_link
                    del partition["level"]
                    
                    result = self.subchapter_collection.insert_one(partition)
                    subchapter_id = result.inserted_id
                    subchapter_ids.append(subchapter_id)
                    subchapter_infos.append([
                        partition["subchapter_title"], 
                        partition["start_page"]
                    ])
                    
                    print(f"Uploaded {output_filename} to S3 and MongoDB")
                except Exception as e:
                    print(f"Failed to upload {output_filename} to MongoDB: {e}")
            
            # Track chapter boundaries
            if i != len(partitions) - 1:
                if partitions[i + 1]["chapter_title"] != partition["chapter_title"]:
                    chapter_infos.append([
                        partition["chapter_title"], 
                        chapter_first_index, 
                        i
                    ])
                    chapter_first_index = i + 1
            else:
                chapter_infos.append([
                    partition["chapter_title"], 
                    chapter_first_index, 
                    i
                ])
        
        # Upload book metadata
        try:
            print("Uploading book info...")
            book_info = {
                "book_title": book_title,
                "subchapter_ids": subchapter_ids,
                "subchapter_infos": subchapter_infos,
                "chapter_infos": chapter_infos
            }
            inserted_book = self.books_collection.insert_one(book_info)
            book_id = inserted_book.inserted_id
            for subchapter_id in subchapter_ids:
                self.subchapter_collection.update_one(
                    {"_id": subchapter_id},
                    {"$set": {"book_id": book_id}}
                )
            print("Book info uploaded successfully")

        except Exception as e:
            print(f"Failed to upload {book_title} to MongoDB: {e}")
        
        return partitions
    
    def process_book(
        self,
        book_file_name: str,
        book_path: Optional[str] = None
    ) -> None:
        """
        Complete pipeline to process a book.
        
        Args:
            book_file_name: Identifier for book in catalog
            book_path: Optional custom path to PDF file
        """
        book_title = BOOK_CATALOG.get(book_file_name)
        if not book_title:
            raise ValueError(f"Book '{book_file_name}' not found in catalog")
        
        if book_path is None:
            book_path = os.path.abspath(
                os.path.join(os.path.dirname(__file__), "..", "..", "data", "textbooks", f"{book_file_name}.pdf")
            )

        partitions = self.create_subchapter_partitions(book_path, book_title)
        self.add_chapter_numbers(partitions)
        self.split_and_upload_pdfs(book_title, partitions, book_path)


if __name__ == "__main__":
    processor = PDFProcessor()
    processor.process_book("1")
