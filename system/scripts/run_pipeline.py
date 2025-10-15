"""Main pipeline script for processing books end-to-end."""

import argparse
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.core.pdf_processor import PDFProcessor
from src.core.text_embedder import TextEmbedder
from src.core.question_generator import QuestionGenerator
from src.data.book_catalog import BOOK_CATALOG, list_books


def run_full_pipeline(
    book_identifier: str,
    skip_pdf: bool = False,
    skip_embedding: bool = False,
    skip_questions: bool = False,
    questions_per_chapter: int = 8,
    use_ocr: bool = False
) -> None:
    """
    Run the complete pipeline for processing a book.
    
    Args:
        book_identifier: Book ID or title from catalog
        skip_pdf: Skip PDF processing step
        skip_embedding: Skip text embedding step
        skip_questions: Skip question generation step
        questions_per_chapter: Number of questions to generate per subchapter
        use_ocr: Use OCR for text extraction
    """
    print(f"\n{'='*60}")
    print(f"Starting pipeline for: {book_identifier}")
    print(f"{'='*60}\n")
    
    # Validate book exists
    if book_identifier not in BOOK_CATALOG:
        print(f"Error: Book '{book_identifier}' not found in catalog")
        print("\nAvailable books:")
        for key, value in list_books().items():
            if not key.isdigit():  # Only show titles
                print(f"  - {key} (ID: {value})")
        return
    
    book_title = BOOK_CATALOG.get(book_identifier)
    if book_title.isdigit():  # If we got an ID, get the title
        book_title = BOOK_CATALOG.get(book_title)
    
    # Step 1: Process PDF
    if not skip_pdf:
        print("\n[1/3] Processing PDF and uploading to S3...")
        try:
            processor = PDFProcessor()
            processor.process_book(book_identifier)
            print("✓ PDF processing complete\n")
        except Exception as e:
            print(f"✗ Error in PDF processing: {e}\n")
            return
    else:
        print("\n[1/3] Skipping PDF processing\n")
    
    # Step 2: Generate embeddings
    if not skip_embedding:
        print("[2/3] Generating text embeddings...")
        try:
            embedder = TextEmbedder()
            embedder.process_book(
                book_name=book_title,
                use_ocr=use_ocr,
                clear_existing=True
            )
            print("✓ Text embedding complete\n")
        except Exception as e:
            print(f"✗ Error in text embedding: {e}\n")
            return
    else:
        print("[2/3] Skipping text embedding\n")
    
    # Step 3: Generate questions
    if not skip_questions:
        print("[3/3] Generating questions...")
        try:
            generator = QuestionGenerator(
                questions_per_chapter=questions_per_chapter
            )
            generator.generate_questions(book_name=book_title)
            print("✓ Question generation complete\n")
        except Exception as e:
            print(f"✗ Error in question generation: {e}\n")
            return
    else:
        print("[3/3] Skipping question generation\n")
    
    print(f"{'='*60}")
    print("Pipeline completed successfully!")
    print(f"{'='*60}\n")


def main():
    """Parse arguments and run pipeline."""
    parser = argparse.ArgumentParser(
        description="Run the book processing pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process book with ID "4"
  python run_pipeline.py 4

  # Process by title
  python run_pipeline.py "The Elements of Statistical Learning"

  # Skip PDF processing (if already done)
  python run_pipeline.py 4 --skip-pdf

  # Generate more questions per chapter
  python run_pipeline.py 4 --questions 12

  # Use OCR for text extraction
  python run_pipeline.py 4 --ocr

  # List available books
  python run_pipeline.py --list-books
        """
    )
    
    parser.add_argument(
        "book",
        nargs="?",
        help="Book ID or title from catalog"
    )
    parser.add_argument(
        "--skip-pdf",
        action="store_true",
        help="Skip PDF processing step"
    )
    parser.add_argument(
        "--skip-embedding",
        action="store_true",
        help="Skip text embedding step"
    )
    parser.add_argument(
        "--skip-questions",
        action="store_true",
        help="Skip question generation step"
    )
    parser.add_argument(
        "--questions",
        type=int,
        default=8,
        help="Number of questions to generate per chapter (default: 8)"
    )
    parser.add_argument(
        "--ocr",
        action="store_true",
        help="Use OCR for text extraction from PDF"
    )
    parser.add_argument(
        "--list-books",
        action="store_true",
        help="List available books in the catalog"
    )
    
    args = parser.parse_args()
    
    # List available books
    if args.list_books:
        print("\nAvailable books:")
        for key, value in list_books().items():
            if not key.isdigit():  # Only show titles
                print(f"  - {key} (ID: {value})")
        print()
        return
    
    # Run pipeline for the given book
    book_identifier = args.book
    skip_pdf = args.skip_pdf
    skip_embedding = args.skip_embedding
    skip_questions = args.skip_questions
    questions_per_chapter = args.questions
    use_ocr = args.ocr
    
    run_full_pipeline(
        book_identifier,
        skip_pdf=skip_pdf,
        skip_embedding=skip_embedding,
        skip_questions=skip_questions,
        questions_per_chapter=questions_per_chapter,
        use_ocr=use_ocr
    )


if __name__ == "__main__":
    main()
