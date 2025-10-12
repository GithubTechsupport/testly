# Project Overview

This repository is organized into three main folders:

- **client (Frontend)**  
  Contains user-facing components and scripts to process book files before sending data to the backend or AI system.  
  - **book_processing/**  
    - `extract_text.py`  
      • Input: PDF, EPUB or TXT files  
      • Function: Extracts raw text from book files  
    - `summarize.py`  
      • Input: Raw text files  
      • Function: Generates concise summaries of extracted text  
    - `convert_to_audio.py`  
      • Input: Summarized text files  
      • Function: Converts text summaries to audio (MP3/WAV)  

- **server (Backend)**  
  Implements RESTful API endpoints to receive processed data from the client, manage storage, and forward requests to the AI system.  
  - `app.py` – Main Flask/FastAPI application  
  - `routes/` – Endpoint definitions  
  - `models/` – Database schema and ORM models  

- **system (AI Model Orchestrator)**  
  Orchestrates AI-model-specific workflows, handles prompt engineering, and manages model inference.  
  - `pipeline/` – Scripts that prepare inputs, run the model, and post-process outputs  
  - `config/` – Model configuration files  

---

## Setup & Installation

1. Create and activate a virtual environment (optional, but recommended)  
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate   # macOS/Linux
   .venv\Scripts\activate      # Windows
   ```

2. Install all required dependencies  
   ```bash
   pip install -r requirements.txt
   ```

3. Run individual components as needed:  
   - Client scripts: `python client/book_processing/extract_text.py --input path/to/book.pdf --output output.txt`  
   - Backend server: `python server/app.py`  
   - AI system pipeline: `python system/pipeline/run_model.py --config system/config/model.yaml`