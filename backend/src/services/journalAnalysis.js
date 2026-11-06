/**
 * Runs ML analysis on journal entries and persists the result.
 *
 * Flow on create/update:
 *   1. The journal row is saved first (analysis_status = 'pending'). That always succeeds.
 *   2. We try to analyze inline with a short timeout so the user usually sees sentiment instantly.
 *   3. If the ML service is slow/down, the entry simply stays 'pending' and a background worker
 *      retries it later. Nothing in the user's write path ever fails because of ML.
 */
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const Journal = require('../models/Journal');
const ml = require('./mlClient');
const vectorStore = require('../config/vectorStore');

const INLINE_TIMEOUT_MS = parseInt(process.env.ML_INLINE_TIMEOUT_MS || '3000', 10);
const WORKER_INTERVAL_MS = parseInt(process.env.ANALYSIS_RETRY_MS || '60000', 10);
const WORKER_BATCH = parseInt(process.env.ANALYSIS_BATCH_SIZE || '10', 10);

// Derived data about a person's mental state: only ever shown to the entry's owner.
const PRIVATE_ANALYSIS_FIELDS = [
  'sentimentLabel', 'sentimentScore', 'sentimentConfidence', 'sentimentDetails', 'analysisStatus', 'analyzedAt',
];

const textFor = (journal) => `${journal.title}\n${journal.body}`;

/** Analyze + persist. Throws MLUnavailableError if ML is unreachable. */
async function analyzeJournal(journal, { timeoutMs } = {}) {
  const result = await ml.analyze(textFor(journal), timeoutMs);
  const s = result.sentiment;
  const vector = result.embedding && result.embedding.embeddings && result.embedding.embeddings[0];

  await sequelize.transaction(async (transaction) => {
    await journal.update(
      {
        sentimentLabel: s.label,
        sentimentScore: s.score,
        sentimentConfidence: s.confidence,
        sentimentDetails: {
          probabilities: s.probabilities,
          emotions: s.emotions || null,
          modelsUsed: s.models_used,
          degraded: !!s.degraded,
        },
        analysisStatus: 'done',
        analyzedAt: new Date(),
      },
      { transaction }
    );
    if (vector && vectorStore.isEnabled()) {
      await vectorStore.upsert(
        { journalId: journal.id, userId: journal.userId, embedding: vector, model: result.embedding.model },
        transaction
      );
    }
  });
  return journal;
}

/** Best-effort inline analysis: never throws. Returns 'done' | 'pending'. */
async function tryAnalyzeInline(journal) {
  if (ml.isOpen()) return 'pending';
  try {
    await analyzeJournal(journal, { timeoutMs: INLINE_TIMEOUT_MS });
    return 'done';
  } catch (err) {
    if (err instanceof ml.MLUnavailableError) {
      console.warn(`ML unavailable, journal ${journal.id} queued for retry`);
    } else {
      console.error(`Journal analysis failed for ${journal.id}:`, err.message);
    }
    return 'pending';
  }
}

let workerTimer = null;
let workerBusy = false;

async function processPending() {
  if (workerBusy || ml.isOpen()) return 0;
  workerBusy = true;
  let done = 0;
  try {
    const pending = await Journal.findAll({
      where: { analysisStatus: 'pending' },
      order: [['createdAt', 'ASC']],
      limit: WORKER_BATCH,
    });
    for (const journal of pending) {
      try {
        await analyzeJournal(journal);
        done += 1;
      } catch (err) {
        if (err instanceof ml.MLUnavailableError) break; // stop hammering a dead service
        console.error(`Retry failed for journal ${journal.id}:`, err.message);
      }
    }
    if (done) console.log(`Analysis worker: processed ${done} pending journal(s)`);
  } catch (err) {
    console.error('Analysis worker error:', err.message);
  } finally {
    workerBusy = false;
  }
  return done;
}

function startWorker() {
  if (workerTimer || WORKER_INTERVAL_MS <= 0) return;
  workerTimer = setInterval(processPending, WORKER_INTERVAL_MS);
  workerTimer.unref();
  setTimeout(processPending, 5000).unref(); // pick up backlog shortly after boot
  console.log(`Analysis retry worker started (every ${WORKER_INTERVAL_MS}ms)`);
}

function stopWorker() {
  if (workerTimer) clearInterval(workerTimer);
  workerTimer = null;
}

/** Re-embed entries whose embedding is missing or from a different model than `currentModel`. */
async function findStaleForReindex(userId, currentModel, limit = 200) {
  const [rows] = await sequelize.query(
    `SELECT j.id FROM journals j
       LEFT JOIN journal_embeddings e ON e.journal_id = j.id
      WHERE j.user_id = :userId AND (e.journal_id IS NULL OR e.model <> :model)
      ORDER BY j.created_at DESC LIMIT :limit`,
    { replacements: { userId, model: currentModel, limit } }
  );
  return rows.map((r) => r.id);
}

module.exports = {
  analyzeJournal, tryAnalyzeInline, processPending, startWorker, stopWorker,
  findStaleForReindex, PRIVATE_ANALYSIS_FIELDS,
};
