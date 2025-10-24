# Testly

Testly is an end-to-end learning content platform that transforms textbook PDFs into structured knowledge, embeds the content for downstream retrieval, and (soon) exposes experiences through a modern web app. The monorepo contains three cooperating subsystems:

- **system** – Python pipelines for PDF ingestion, segmentation, embeddings, and the existing Flask API.
- **server** – TypeScript/Express backend that will orchestrate authentication, book management, and hand-offs to the pipelines.
- **client** – React/TypeScript frontend that provides the learner-facing experience.

This document explains how the pieces fit together, how to get each environment running locally, and the current development status.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Repository Layout](#repository-layout)
3. [Global Prerequisites](#global-prerequisites)
4. [System (Python Pipelines)](#system-python-pipelines)
   - [Installation](#installation)
   - [Running the Flask API](#running-the-flask-api)
   - [Endpoints](#endpoints)
5. [Server (Node/Express API)](#server-nodeexpress-api)
   - [Installation](#installation-1)
   - [Environment Variables](#environment-variables)
   - [Available Scripts](#available-scripts)
6. [Client (React Frontend)](#client-react-frontend)
   - [Installation](#installation-2)
   - [Environment Variables](#environment-variables-1)
   - [Available Scripts](#available-scripts-1)
7. [End-to-End Workflow](#end-to-end-workflow)
8. [Troubleshooting](#troubleshooting)
9. [Roadmap](#roadmap)

---

## Architecture Overview

1. **Upload & Processing (system)**: The Python pipeline ingests PDFs (from S3 or local samples), splits them into chapters/subchapters, persists metadata, and computes embeddings for retrieval or question generation.
2. **API Gateway (server)**: The TypeScript service will authenticate users, manage library data in MongoDB, orchestrate uploads to S3, and call into the Python pipeline via HTTP.
3. **Experience (client)**: The React frontend uses TanStack Query, Zustand, and TailwindCSS for a modern UI supporting registration, login, browsing public books, and managing a personal library. It communicates with the server API.

---

## Repository Layout

```
testly/
├─ client/    # React + Vite frontend (TypeScript)
├─ server/    # Express + MongoDB backend (TypeScript)
└─ system/    # Python data pipeline + Flask API
```

Each subdirectory maintains its own dependencies and `.env` template. Work on them independently or run them together for the full stack.

---

## Global Prerequisites

- Git
- Node.js 20+ (or the version required by `server/package.json` / `client/package.json`)
- npm 10+
- Python 3.11+
- MongoDB Atlas/local instance & AWS credentials (for S3) if you intend to run the backend integrations

> Tip: Clone the repository and then follow the setup steps for each component you plan to run.

---

## System (Python Pipelines)

### Installation

```powershell
cd system
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env  # fill in credentials afterwards
```

Key environment variables (see `system/.env.example` for the full list):

- `MONGO_URI` – MongoDB connection used by the pipeline.
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` – optional if you upload to S3 within the pipeline.
- `PORT` – overrides Flask’s default of 5001.

### Running the Flask API

```powershell
cd system
.\.venv\Scripts\Activate.ps1
python scripts\upload_embed_api.py
```

The service exposes health and ingestion endpoints. Stop with <kbd>Ctrl</kbd> + <kbd>C</kbd>.

### Endpoints

- `GET /health` – returns `{ "status": "ok" }` when the pipeline is reachable.
- `POST /api/v1/pipelines/upload-embed`
  ```json
  {
    "book_name": "Linear Algebra Essentials",
    "s3_link": "https://your-bucket.s3.amazonaws.com/book.pdf",
    "visibility": "Private",
    "use_ocr": false
  }
  ```
  Responds with the MongoDB `book_id`, status, and metadata collected during ingestion.

Sample PDFs for local testing live in `system/data/textbooks/`.

---

## Server (Node/Express API)

The server is under active development. The core domain models, services, and middleware are present; controllers and routes are being wired next. You can already install dependencies, compile the project, and prepare the environment.

### Installation

```powershell
cd server
npm install
Copy-Item .env.example .env
```

### Environment Variables

Edit `server/.env` and provide values for:

- `MONGO_URI` – MongoDB database URI.
- `JWT_SECRET` / `JWT_EXPIRES_IN` – secrets for access tokens.
- `AWS_REGION`, `AWS_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` – S3 storage for uploaded PDFs and covers.
- `FLASK_BASE_URL` – URL for the running system service (default `http://localhost:5001`).
- `PORT` – Express server port (defaults to 4000 inside the config helper).

### Available Scripts

- `npm run build` – Type-checks and compiles TypeScript to `dist/` (currently passes).
- `npm run dev` – Starts `ts-node-dev` (requires `src/index.ts`, coming soon).
- `npm run lint` – Runs ESLint.
- `npm test` – Reserved for future Vitest suites.

Once controllers/routes are added, `npm run dev` will serve the API that the client consumes.

---

## Client (React Frontend)

The client already boots with authentication flows, navigation, and book management UI; API calls rely on the upcoming server endpoints.

### Installation

```powershell
cd client
npm install
Copy-Item .env.example .env  # create one if necessary
```

### Environment Variables

Create `client/.env` (Vite format) and set:

- `VITE_API_URL` – Base URL of the Express server (e.g., `http://localhost:4000/api/v1`).

### Available Scripts

- `npm run dev` – Launches Vite dev server on http://localhost:5173.
- `npm run build` – Runs TypeScript project references and outputs production assets to `dist/`.
- `npm run preview` – Serves a local preview of the built bundle.
- `npm run lint` – Executes ESLint with the shared config.

The app uses TanStack Query for data fetching, Zustand for auth state, and TailwindCSS for styling. When the backend API is ready, update `VITE_API_URL`, start both services, and the UI will call into the server.

---

## End-to-End Workflow

1. **Spin up MongoDB + S3 (or mocks)** – ensure credentials exist for both the system pipeline and the server.
2. **Run the system Flask API** – provides the upload/embedding pipeline at `http://localhost:5001`.
3. **Launch the server** – the Express app will authenticate users, accept file uploads, push to S3, and invoke the system API.
4. **Start the client** – the React app authenticates against the server, lets users browse books, and triggers uploads that propagate through the pipeline.

While the backend wiring is being finalized, you can already interact with the system API directly and develop UI flows against mocked responses by using the TanStack Query devtools.

---

## Troubleshooting

- **Missing runtime dependencies** – double-check you have run `npm install` / `pip install -r requirements.txt` in each subproject.
- **Environment variables** – ensure `.env` files exist for every layer and match the documented keys.
- **Node module resolution errors** – the server uses native ES modules (`"module": "NodeNext"`) so imports must include `.js` after compilation; avoid rewriting compiled paths manually.
- **Large frontend bundle warnings** – Rolldown/Vite may warn about chunks >500 kB. Code-splitting is on the roadmap.
- **Flask cannot import pipeline modules** – run commands from the `system/` directory so the `sys.path` adjustments in scripts take effect.

---

## Roadmap

- ✅ System pipeline & Flask API
- 🚧 Complete Express controllers/routes + persistence wiring
- 🚧 Hook frontend mutations/queries to live API
- 🔜 Automated tests across all layers
- 🔜 CI/CD automation and deployment playbooks
