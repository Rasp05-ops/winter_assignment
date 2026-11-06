# MindBridge — Mental Wellness Platform

Full-stack journaling app with mood logging, social "circles" for shared support, and an ML microservice that
scores journal sentiment and powers semantic search.

```
React (3000) ──► Express API (3001) ──► PostgreSQL + pgvector
                      │
                      └── REST ──► FastAPI ML service (8000)
                                    ├─ DistilRoBERTa (emotions → sentiment)
                                    ├─ TF-IDF + Logistic Regression
                                    └─ MiniLM sentence embeddings (384-d)
```

## What's in the box

| Requirement | Where it lives |
|---|---|
| React / Node / Express / PostgreSQL app: journaling, mood logs, circles | `frontend/`, `backend/` (pre-existing) |
| FastAPI microservice, DistilRoBERTa + TF-IDF/LR **ensemble** for sentiment | `ml-service/app/ensemble.py`, `app/models/*`, `app/main.py` |
| Exposed via REST, integrated into Express for **real-time scoring on entry creation** | `backend/src/services/mlClient.js`, `journalAnalysis.js`, `journalController.createJournal` |
| **pgvector** semantic search over journal embeddings | `backend/src/config/vectorStore.js`, `GET /api/journals/search/semantic` |
| **Polyglot architecture with graceful degradation** | circuit breaker + inline timeout + retry worker + keyword fallback (see below) |

## Quick start

### Docker (everything)
```bash
cp .env.example .env        # set JWT_SECRET
docker compose up --build   # first ML build downloads ~1GB of model weights
```
App: http://localhost:3000 · API: http://localhost:3001/api/health · ML: http://localhost:8000/docs

#### Windows PowerShell
Install and start Docker Desktop first, then run from the repository root:
```powershell
Copy-Item .env.example .env
notepad .env
# Set JWT_SECRET to a long random value before saving.
docker compose up --build
```

In another PowerShell window, verify the stack:
```powershell
Invoke-WebRequest http://localhost:3001/api/health
Set-Location .\backend
npm ci
npm run smoke
```

The first ML container startup can take several minutes and requires substantial
disk space because it downloads model weights into the persistent `ml-models`
volume. To run only the
frontend/backend/database path while developing, set `ENABLE_TRANSFORMER=0`
and `ENABLE_EMBEDDER=0` in the ML service environment; journaling still works
with graceful ML degradation.

For a hosted deployment, set `CORS_ORIGINS` to the exact frontend origin and
`REACT_APP_API_URL` to the public API URL before building. Use a long random
`JWT_SECRET`, a non-default `DB_PASSWORD`, and set `ML_SERVICE_API_KEY` to the
same random value for the backend and ML service. The compose file keeps
`DB_SYNC_ALTER=false` by default so startup cannot perform destructive schema
changes; use migrations or a reviewed maintenance upgrade for future schema
changes.

## Deploy frontend to Vercel and services to Render

The frontend is deployed to Vercel. The backend, PostgreSQL database, and ML
service are deployed to Render as separate services.

The repository includes [render.yaml](C:/Users/ANIRUDH/Desktop/mindbridge/mindbridge/render.yaml)
to provision the Render database and services, and
[vercel.json](C:/Users/ANIRUDH/Desktop/mindbridge/mindbridge/vercel.json) with
the frontend build settings.

### 1. Push the repository

Push this repository to GitHub. Do not commit `.env` files or secrets.

If Git is installed, run:
```powershell
git init
git add .
git commit -m "Prepare MindBridge deployment"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repository>.git
git push -u origin main
```

### 2. Provision Render from the Blueprint

In Render, choose **New > Blueprint**, select the GitHub repository, and
approve the resources defined by `render.yaml`. This creates:

- `mindbridge-db`
- `mindbridge-ml`
- `mindbridge-api`

After provisioning, open `mindbridge-ml` and copy its public URL. Then open
`mindbridge-api` and set:
```text
ML_SERVICE_URL=https://<your-ml-service>.onrender.com
CORS_ORIGINS=https://<your-vercel-project>.vercel.app
```
The Blueprint generates the JWT and ML API secrets automatically. If the
database does not provide the `vector` extension, the API still runs with
keyword search fallback.

Wait for both Render services to become healthy. Copy the backend URL and
verify:
```text
https://mindbridge-api.onrender.com/api/health
```

The health response should report `"status":"OK"`. ML may report degraded
while its model is loading; that does not prevent the API from serving.

### 3. Deploy the frontend on Vercel

Import the repository into Vercel:

- Framework preset: Create React App
- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `build`
- Install command: `npm ci`

Set this Vercel environment variable for Production:
```text
REACT_APP_API_URL=https://mindbridge-api.onrender.com/api
```

Deploy the frontend. Copy the final Vercel domain and update the Render
backend's `CORS_ORIGINS` to that exact origin, without a trailing slash.
Redeploy the backend after changing it.

### 4. Production verification

From PowerShell:
```powershell
$api = "https://mindbridge-api.onrender.com"
Invoke-WebRequest "$api/api/health"
```

Open the Vercel URL, create an account, log in, create a journal entry, and
confirm that the entry is saved. Then check the browser Network tab for a
successful request to `/api/auth/signup` or `/api/auth/login`. If the ML
service is unavailable, the journal should still save with
`analysisStatus: "pending"`.

For later backend checks against production:
```powershell
Set-Location .\backend
$env:API_URL = "https://mindbridge-api.onrender.com"
npm run smoke
```

Do not run the smoke test against production if you do not want test accounts
and journal data created there.

### Manual
```bash
# 1. Postgres with pgvector (Docker is easiest)
docker run -d --name mb-db -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=mindbridge pgvector/pgvector:pg16

# 2. ML service
cd ml-service && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000       # first start downloads the models; trains the TF-IDF baseline if missing

# 3. Backend
cd backend && cp .env.example .env && npm install && npm run dev

# 4. Frontend
cd frontend && npm install && npm start
```

## How the ML path works

**Creating an entry** — the row is saved first (always succeeds), then the API calls `POST /v1/analyze`
with a short timeout (`ML_INLINE_TIMEOUT_MS`, default 3 s). On success the entry is stored with
`sentimentLabel / sentimentScore / sentimentConfidence / sentimentDetails` plus its embedding in
`journal_embeddings (vector(384))`, and the response already contains the sentiment. Editing an entry
re-scores it.

**Ensemble** — `final_probs = 0.7·DistilRoBERTa + 0.3·TF-IDF/LR` over `{negative, neutral, positive}`
(`ENSEMBLE_WEIGHT_TRANSFORMER`). DistilRoBERTa is `j-hartmann/emotion-english-distilroberta-base`; its 7 emotions
are collapsed to sentiment (joy→positive; anger/disgust/fear/sadness→negative; surprise/neutral→neutral) and the
emotion distribution is also returned. `score = P(pos) − P(neg) ∈ [−1, 1]`. Long entries are chunked and
averaged so text beyond the 512-token limit is not silently dropped.

**Semantic search** — the query is embedded with the same model, then ranked by cosine distance
(`embedding <=> query`) over the caller's own entries only. Exact scan on the `user_id` index is used rather
than an HNSW index: filters are applied after an ANN scan in pgvector and would return too few rows for
per-user queries. Add HNSW if you introduce cross-user similarity.

**Graceful degradation** — ML downtime never blocks journaling:
1. circuit breaker opens after 3 consecutive failures for 30 s (calls fail instantly, no timeouts piling up);
2. entries stay `analysisStatus = 'pending'` and a background worker scores them when the service returns;
3. semantic search falls back to keyword (`ILIKE`) search and says so (`mode: "keyword"`);
4. `/api/health` stays `OK` and reports ML / pgvector status; if the pgvector extension is missing the server
   still boots without semantic search.

**Privacy** — sentiment is derived data about someone's mental state, so it is only returned to the entry's
owner (stripped from public/circle feeds, public search, and non-owner views). Search and "similar entries" are
scoped to the caller. Journal text is not logged.

## API additions

| Method | Path | Notes |
|---|---|---|
| POST | `/api/journals` | now returns `analysisStatus` (`done`/`pending`) and sentiment fields |
| GET | `/api/journals/search/semantic?q=&limit=&minSimilarity=` | `mode: semantic \| keyword`; default similarity threshold is `0.27` |
| GET | `/api/journals/:id/similar` | owner only |
| GET | `/api/journals/sentiment/trend?days=30` | daily averages + `pendingAnalysis` count |
| POST | `/api/journals/:id/reanalyze` | 503 if ML is down |
| POST | `/api/journals/reindex` | re-embed your entries after switching embedding model |
| ML: POST | `/v1/sentiment`, `/v1/embed`, `/v1/analyze`; GET `/health` | optional `X-API-Key` |

## Tests
```bash
cd ml-service && pip install -r requirements-dev.txt && pytest          # 10 tests, no model downloads needed
# with backend + db + ML running:
cd backend && npm run smoke                                             # end-to-end: scoring, search, privacy, edit, delete
# stop the ML service, then:
EXPECT_ML=down npm run smoke                                            # asserts graceful degradation
```

## Honest notes / limitations
- **The TF-IDF baseline is trained on synthetic template data** (`ml-service/scripts/make_seed_data.py`) so the
  repo runs out of the box. Its 100 % hold-out accuracy is an artifact of templating — on a hand-written sample
  of 8 unseen sentences it got 7. Retrain on real labelled text for real quality:
  `python train.py --data labels.csv` (columns `text,label`). When the transformer is unavailable the service
  reports `degraded: true`.
- Without `sentence-transformers` the service uses hashing embeddings (lexical, not semantic) and tags them
  `hashing-fallback-384`; vectors from different models are never compared. Run `POST /api/journals/reindex`
  after the real model comes online.
- Sentiment labels are automatic estimates, not a clinical assessment or crisis detector.
- The service uses non-destructive `sequelize.sync()` on startup to create
  missing tables. `DB_SYNC_ALTER=true` is available only for controlled
  development/maintenance upgrades; use migrations before making schema
  changes in a production database.
