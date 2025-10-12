# Testly Repository

This repository is organized into three main parts:

## 1. Client (`client/`)
- **Description:** Web frontend built with React.
- **Status:** Not fully implemented. No further details provided.

## 2. Server (`server/`)
- **Description:** Web backend built with Express.
- **Status:** Not fully implemented. No further details provided.

## 3. System (`system/`)
- **Description:** Python-based AI processing system for textbook handling and question generation.
- **Structure:**  
  - `book_processing/`: Contains core scripts for PDF uploading, embedding, and question generation.

### Book Processing Overview

The `book_processing` folder includes the following main functionalities:

- **PDF Uploading:** Splits textbooks into subchapters and uploads them to S3 and MongoDB.
- **PDF Embedding:** Chunks subchapter text and generates vector embeddings for semantic search.
- **Question Generation:** Uses the latest Mistral Large model to generate exam questions from textbook content.

### Current Model

- The system uses the **Mistral Large (latest)** model for question generation and embedding.

---

## Setup Instructions

### 1. Activate Virtual Environment

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Requirements

```bash
pip install -r requirements.txt
```

---

## Main Scripts & Inputs

### 1. `split_pdf_and_upload.py`
- **Purpose:** Splits a PDF into subchapters, uploads each to S3, and stores metadata in MongoDB.
- **Inputs:**
  - `book_file_name`: The key for the book in `book_titles.dictionary`.
  - `book_title`: The actual book title.
  - `book_path`: Path to the PDF file.
- **Usage:**  
  Edit the `__main__` section to set the desired `book_file_name` and run the script.

### 2. `book_embedder.py`
- **Purpose:** Downloads subchapter PDFs, extracts text, chunks it, generates embeddings, and stores them in MongoDB.
- **Inputs:**
  - `book_name`: Title of the book as stored in MongoDB.
  - Optional: OCR mode for extracting text.
- **Usage:**  
  Edit the `__main__` section to set the desired `book_name` and run the script.

### 3. `question_generator.py`
- **Purpose:** Retrieves subchapter text, builds prompts, generates questions using the Mistral model, evaluates them, and stores them in MongoDB.
- **Inputs:**
  - `book_name`: Title of the book as stored in MongoDB.
  - `questions_per_chapter`: Number of questions to generate per subchapter.
  - `difficulty_distribution`: Distribution of question difficulties.
- **Usage:**  
  Edit the `__main__` section to set the desired `book_name` and parameters, then run the script.

---

## Notes

- Ensure your `.env` file is configured with the necessary AWS and MongoDB credentials.
- All scripts are located in `system/book_processing/`.
- The client and server folders are placeholders and not yet implemented.
