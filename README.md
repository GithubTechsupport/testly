# Testly

Testly ingests textbook PDFs, normalises the content into chapters and subchapters, generates embeddings, and serves learning experiences through a web application. The project now ships three cooperating services:
- `system/` – Python pipelines and a Flask API for ingestion, embedding, and exam generation.
- `server/` – Express + TypeScript API that handles authentication, book lifecycle management, and S3 coordination.
- `client/` – React + Vite frontend powered by TanStack Query and Zustand.

## Table of Contents
- Architecture
- Repository Structure
- Prerequisites
- Environment Configuration
- Quick Start
- Key Flows
- Admin Utilities
- Testing
- Troubleshooting
- License

## Architecture

- **system/**: Owns the PDF pipeline, embeddings, and background processing. Exposes Flask blueprints that the server calls (`/api/v1/pipelines`).
- **server/**: REST API that authenticates users, proxies work to the Python services, and persists metadata in MongoDB. S3 objects are stored under the convention `books/<bookId>/...`.
- **client/**: SPA that surfaces book management, status monitoring, and deletion flows while keeping access tokens in sync.

## Repository Structure

```
testly/
├─ client/            # React app (Vite, Tailwind, TanStack Query)
├─ server/            # Express API (TypeScript, MongoDB, AWS SDK)
├─ system/            # Python pipelines, Flask API, admin scripts
├─ LICENSE
└─ README.md
```

Selected subdirectories:

```
client/src/
├─ app/               # Providers (router, query client)
├─ features/          # Auth, books UI, data hooks
└─ components/        # Reusable UI primitives

server/src/
├─ controllers/       # Request handlers
├─ services/          # Business logic (books, auth, S3, Flask)
├─ middlewares/       # JWT guards, error handling, uploads
└─ routes/            # Versioned API wiring

system/
├─ scripts/api_server.py      # Combined Flask entrypoint (health + pipelines)
├─ adminscripts/              # Maintenance scripts (Mongo + S3)
└─ src/                       # Core pipeline implementation
```

## Prerequisites

- Node.js 20+ and npm 10+ (server + client)
- Python 3.11+ (system)
- MongoDB instance and AWS S3 bucket with programmatic access

## Environment Configuration

- **server** (`server/.env` – copy from `.env.example`):
  - `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`
  - `FLASK_BASE_URL` (defaults to `http://localhost:5001`)
  - `AWS_REGION`, `AWS_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
  - `PORT` (optional, defaults to `4000`)

- **client** (`client/.env` – create manually):
  - `VITE_API_URL=http://localhost:4000/api/v1`

- **system** (`system/.env` – copy from `.env.example`):
  - Database connection settings
  - AWS credentials matching the bucket the pipelines upload into
  - `PORT` (Flask, defaults to `5001`)

> Keep all `.env` files out of version control. Values across services must be consistent (same bucket, same Mongo instance).

## Quick Start

**1. Start the Python pipelines (system):**

```powershell
cd system
Copy-Item .env.example .env    # if you have not created one yet
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python scripts\api_server.py
```
- Health endpoints: `http://localhost:5001/health` and `/ready`
- Upload + embed pipeline: `POST /api/v1/pipelines/upload-embed`

**2. Start the Express API (server):**

```powershell
cd server
Copy-Item .env.example .env    # populate with real credentials
npm install
npm run dev
```
- Serves `http://localhost:4000/api/v1`
- Proxies long-running work to the Flask service and manages S3/Mongo records

**3. Start the Vite client (client):**

```powershell
cd client
# create .env with VITE_API_URL if you need a non-default API URL
npm install
npm run dev
```
- Vite prints the local URL (default `http://localhost:5173`)
- React Query keeps UI state aligned with server mutations (e.g., book deletion)

Run the three commands in separate PowerShell windows so each process keeps running.

## Key Flows

- **Book ingestion:** Client uploads metadata → server validates/authenticates → server uploads assets under `books/<bookId>/...` and calls the Flask pipeline → system processes PDF and embeddings.
- **Book deletion:** Client issues DELETE → server removes Mongo metadata, deletes all S3 keys sharing the `books/<bookId>/` prefix, and cancels outstanding jobs.
- **Auth refresh:** Access tokens are added to requests via Axios interceptors. A 401 response clears local auth state and redirects to the login route.
- **Exam generation:** Server triggers `POST /api/v1/pipelines/generate-exam` to request question sets from the Python service once a book is processed.

## Admin Utilities

- `system/adminscripts/remove_book.py` – bulk removal of a book and its S3 objects.
- `system/adminscripts/clear_subchapters.py` – maintenance helpers for Mongo collections.
- Scripts assume the same `.env` config as the Flask service; activate the virtual environment first.

## Testing

- **server**: `npm run test` (Vitest) and `npm run lint`
- **client**: add tests with your preferred runner; run `npm run lint` to enforce ESLint rules
- **system**: adopt `pytest` or targeted script runs as needed (not yet standardised)

## Troubleshooting

- Flask imports failing: confirm commands run inside `system/` with the virtual environment activated.
- 401s on the client: ensure the Express server can validate JWTs and refresh cookies. Inspect the browser console for redirect logs.
- Missing S3 objects after upload: verify the bucket and credentials used by both `server/.env` and `system/.env` align.
- Mongo connection errors: check `MONGO_URI` formatting and network/firewall rules.

## License

See `LICENSE` for full licensing details.
