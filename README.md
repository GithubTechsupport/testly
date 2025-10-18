# Testly

Testly is a modular project for ingesting textbook PDFs, splitting content into structured units, generating embeddings, and generating queries to a Mistral language model, and exposing a simple API to trigger the pipelines. The repository is evolving toward a three-part structure: client, server, and system. At present, the system component is the primary implementation.

## Table of Contents
- Overview
- Repository Structure
- Quick Start (System)
- Running the Flask API
- API Reference
- Core Pipelines (System/src/core)
- Configuration and Environment
- Data and Samples
- Development Status: Client and Server
- Testing
- Troubleshooting
- License

---

## Overview

- Ingest PDF files from a provided S3 URL.
- Create a “book” record with subchapters/sections.
- Generate embeddings to enable downstream tasks such as search, Q&A, and learning experiences.
- Expose a minimal Flask API to process a book end-to-end.

The system folder contains the pipeline for upload and embed and is ready to run. The client and server components are planned but not yet implemented.

---

## Repository Structure

At the top level:

```
testly/
├─ client/          # Planned front-end; not yet implemented
├─ server/          # Planned backend gateway/orchestration; not yet implemented
└─ system/          # Implemented core data pipeline and API
```

Inside system/:

```
system/
├─ .env
├─ .env.example
├─ requirements.txt
├─ README.md
├─ config/
├─ scripts/
│  ├─ run_pipeline.py # An old iteration of the pipeline
│  └─ upload_embed_api.py   # Flask API entrypoint
└─ src/
   ├─ core/
   │  ├─ pdf_processor.py
   │  ├─ text_embedder.py
   │  └─ question_generator.py
   ├─ models/
   │  └─ ai_models.py
   └─ utils/
      ├─ database_funcs.py
      ├─ s3_funcs.py
      ├─ tokenizer.py
      ├─ timing.py
      └─ health_check.py
```

---

## Quick Start (System)

Prerequisites:
- Windows
- Python 3.11+ recommended
- An environment file (see Configuration and Environment)

1) Navigate to the system folder:
- PowerShell
```
cd system
```

2) Create and activate a virtual environment:
- PowerShell
```
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

3) Install dependencies:
- PowerShell
```
python -m pip install --upgrade pip
pip install -r requirements.txt
```

4) Configure environment:
- Copy .env.example to .env and fill in required values (see Configuration and Environment).

5) Run the API (see Running the Flask API), or experiment with the scripts in system/scripts.

---

## Running the Flask API

The Flask server entrypoint is:
- system/scripts/upload_embed_api.py

Start the server:
- PowerShell (from system/)
```
python scripts\upload_embed_api.py
```

- The app listens on 0.0.0.0 by default, port 5001 (overridable via PORT in .env).
- Health check: http://localhost:5001/health

Notes:
- The script dynamically adjusts the Python path to import from system/src.
- Ensure you run it from within the system directory so .env is picked up and imports work.

---

## API Reference

Base URL: http://localhost:5001

- GET /health
  - Returns a simple status check.
  - 200 OK: {"status":"ok"}

- POST /api/process-book
  - Triggers the end-to-end pipeline: ingest the PDF and generate embeddings.
  - Request (JSON):
    ```
    {
      "book_name": "Your Book Name",
      "s3_link": "https://your-bucket.s3.amazonaws.com/your.pdf",
      "use_ocr": false
    }
    ```
    - book_name: required, string
    - s3_link: required, string (S3 URL to the PDF)
    - use_ocr: optional, boolean (defaults to false)
  - Response (200 OK):
    ```
    {
      "status": "ok",
      "book_id": "<book-id>",
      "book_title": "<book-title>",
      "used_ocr": false
    }
    ```
  - Errors (400/500): {"error": "<message>"}

Example using curl (PowerShell):
```
curl -X POST http://localhost:5001/api/process-book `
  -H "Content-Type: application/json" `
  -d "{ ""book_name"": ""Algebra 101"", ""s3_link"": ""https://your-bucket.s3.amazonaws.com/algebra.pdf"", ""use_ocr"": false }"
```

---

## Core Pipeline (System/src/core)

The upload and embed pipeline is orchestrated by two main components:

- PDFProcessor (src/core/pdf_processor.py)
  - process_book(book_name: str, pdf_s3_url: str) -> dict
  - Responsibilities:
    - Fetch/validate the PDF source.
    - Parse and segment the PDF into structured units (book, chapters, subchapters).
    - Persist metadata (including original s3_link).
    - Returns identifiers (e.g., book_id) and basic metadata.

- TextEmbedder (src/core/text_embedder.py)
  - process_book(book_id: ObjectId, use_ocr: bool = False) -> None
  - Responsibilities:
    - Retrieve the book and its segments by book_id.
    - Optionally use OCR for pages/segments where text extraction requires it.
    - Generate vector embeddings for downstream retrieval tasks.
    - Store embeddings with references to the corresponding segments.

The question generation pipeline is currently orchestrated by the following components:

- question_generator.py (planned/optional next step)
    - Designed for generating practice questions from embedded/parsed content.
    - Integrates with models in src/models/ai_models.py (as configured).

Utilities and supporting modules:
- src/utils/s3_funcs.py: Interacts with S3 for file handling.
- src/utils/database_funcs.py: Data persistence helpers.
- src/utils/tokenizer.py, src/utils/timing.py, src/utils/health_check.py: Support functions.

---

## Configuration and Environment

Environment variables are loaded via python-dotenv. Use the provided template:

1) From system/, copy and edit:
- PowerShell
```
Copy-Item .env.example .env
```

2) Open .env and provide the required values. Refer to the inline comments in .env.example for details. Typical settings include:
- Storage configuration (e.g., S3 bucket/region/credentials or access configuration).
- Database/Vector store connection strings if applicable.
- App settings like PORT for the Flask server.

Important:
- The Flask app reads PORT from the environment, defaulting to 5001.
- Keep secrets out of version control. .env is already gitignored.

---

## Data and Samples

- Local sample PDFs live under system/data/textbooks/ (e.g., 0.pdf, 1.pdf, ...).
- These are useful for local experiments and testing the pipeline without external S3 dependencies.
- For API-based processing, provide an accessible s3_link in the POST request.

---

## Development Status: Client and Server

- client/
  - Status: Not yet implemented.

- server/
  - Status: Not yet implemented.

- system/
  - Status: Actively implemented. Contains the processing pipeline and a minimal API for ingestion + embedding. FUll pipeline for question generation is worked on, though the capability is there

---

## Troubleshooting

- Import errors when running the API:
  - Ensure you run commands from the system directory so the dynamic sys.path adjustment and .env loading apply.
- Cannot reach the server:
  - Confirm the port (default 5001). Check or set PORT in .env.
  - Verify Windows Firewall settings for local access.
- S3 or storage access issues:
  - Double-check credentials and bucket permissions in .env.
  - Ensure the provided s3_link is accessible.

---