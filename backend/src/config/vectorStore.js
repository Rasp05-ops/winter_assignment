/**
 * pgvector storage for journal embeddings.
 *
 * Embeddings live in their own table (journal_embeddings) that is managed with raw SQL rather
 * than as a Sequelize model: `sequelize.sync({ alter: true })` drops columns it doesn't know
 * about and has no native vector type, so keeping this out of sync() is the safe option.
 *
 * Search is always scoped to one user's own entries (a few hundred rows at most), where an
 * exact scan over the user_id index is both exact and fast. An ANN index (HNSW) would be
 * counter-productive here because pgvector applies WHERE filters *after* the ANN scan and can
 * return fewer rows than asked for. Add one if you ever do cross-user similarity search.
 */
const { sequelize } = require('./database');

const DIM = parseInt(process.env.EMBEDDING_DIM || '384', 10);
let enabled = false;
let initError = null;

const toSql = (vec) => `[${vec.join(',')}]`;

async function init() {
  try {
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS vector');
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS journal_embeddings (
        journal_id UUID PRIMARY KEY REFERENCES journals(id) ON DELETE CASCADE,
        user_id    UUID NOT NULL,
        embedding  vector(${DIM}) NOT NULL,
        model      TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    await sequelize.query(
      'CREATE INDEX IF NOT EXISTS journal_embeddings_user_idx ON journal_embeddings (user_id, model)'
    );
    enabled = true;
    initError = null;
    console.log(`pgvector ready (dim=${DIM})`);
  } catch (err) {
    enabled = false;
    initError = err.message;
    console.warn(
      `pgvector unavailable - semantic search disabled, keyword search will be used. Reason: ${err.message}`
    );
  }
  return enabled;
}

const isEnabled = () => enabled;
const status = () => ({ enabled, dim: DIM, error: initError });

async function upsert({ journalId, userId, embedding, model }, transaction) {
  if (!enabled) return false;
  if (!Array.isArray(embedding) || embedding.length !== DIM) {
    throw new Error(`embedding has ${embedding && embedding.length} dims, expected ${DIM}`);
  }
  await sequelize.query(
    `INSERT INTO journal_embeddings (journal_id, user_id, embedding, model, updated_at)
     VALUES (:journalId, :userId, CAST(:vec AS vector), :model, now())
     ON CONFLICT (journal_id) DO UPDATE
       SET embedding = EXCLUDED.embedding, model = EXCLUDED.model, updated_at = now()`,
    { replacements: { journalId, userId, vec: toSql(embedding), model }, transaction }
  );
  return true;
}

/** Cosine-similarity search over one user's own entries, same embedding model only. */
async function searchByVector({ userId, embedding, model, limit = 10, minSimilarity = 0 }) {
  if (!enabled) return [];
  const [rows] = await sequelize.query(
    `SELECT journal_id AS id, 1 - (embedding <=> CAST(:vec AS vector)) AS similarity
       FROM journal_embeddings
      WHERE user_id = :userId AND model = :model
        AND 1 - (embedding <=> CAST(:vec AS vector)) >= :minSimilarity
      ORDER BY embedding <=> CAST(:vec AS vector) ASC
      LIMIT :limit`,
    { replacements: { userId, model, vec: toSql(embedding), minSimilarity, limit } }
  );
  return rows.map((r) => ({ id: r.id, similarity: Number(r.similarity) }));
}

/** Entries most similar to an existing entry (excluding itself). */
async function similarTo({ userId, journalId, limit = 5, minSimilarity = 0 }) {
  if (!enabled) return [];
  const [rows] = await sequelize.query(
    `SELECT e2.journal_id AS id, 1 - (e2.embedding <=> e1.embedding) AS similarity
       FROM journal_embeddings e1
       JOIN journal_embeddings e2
         ON e2.user_id = e1.user_id AND e2.model = e1.model AND e2.journal_id <> e1.journal_id
      WHERE e1.journal_id = :journalId AND e1.user_id = :userId
        AND 1 - (e2.embedding <=> e1.embedding) >= :minSimilarity
      ORDER BY e2.embedding <=> e1.embedding ASC
      LIMIT :limit`,
    { replacements: { userId, journalId, limit, minSimilarity } }
  );
  return rows.map((r) => ({ id: r.id, similarity: Number(r.similarity) }));
}

module.exports = { init, isEnabled, status, upsert, searchByVector, similarTo, DIM };
