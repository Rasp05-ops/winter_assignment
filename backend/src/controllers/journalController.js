const Journal = require('../models/Journal');
const User = require('../models/User');
const CircleMember = require('../models/CircleMember');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const ml = require('../services/mlClient');
const vectorStore = require('../config/vectorStore');
const analysis = require('../services/journalAnalysis');

const { PRIVATE_ANALYSIS_FIELDS } = analysis;
// Sentiment is derived data about a person's mental state: strip it from anything non-owners can read.
const publicAttributes = { exclude: PRIVATE_ANALYSIS_FIELDS };
const stripPrivate = (journal) => {
  const obj = journal.toJSON ? journal.toJSON() : { ...journal };
  PRIVATE_ANALYSIS_FIELDS.forEach((f) => delete obj[f]);
  return obj;
};

// Get all journals for current user
exports.getMyJournals = async (req, res) => {
  try {
    const { limit = 20, offset = 0, favorite, search } = req.query;
    let where = { userId: req.userId };

    // Filter by favorite
    if (favorite === 'true') {
      where.isFavorite = true;
    }

    // Search in title and body
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { body: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const journals = await Journal.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const total = await Journal.count({ where });

    res.json({
      success: true,
      count: journals.length,
      total,
      journals
    });
  } catch (error) {
    console.error('Get journals error:', error);
    res.status(500).json({ error: 'Failed to fetch journals' });
  }
};

// Get single journal
exports.getJournal = async (req, res) => {
  try {
    const { journalId } = req.params;

    const journal = await Journal.findByPk(journalId, {
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'displayName', 'profilePicture']
      }]
    });

    if (!journal) {
      return res.status(404).json({ error: 'Journal not found' });
    }

    // Check access permission
    if (journal.userId !== req.userId) {
      if (journal.visibility === 'private') {
        return res.status(403).json({ error: 'This journal is private' });
      }

      if (journal.visibility === 'circles') {
        // Check if user is in any shared circles
        const userCircles = await CircleMember.findAll({
          where: {
            userId: req.userId,
            status: 'active',
            circleId: { [Op.in]: journal.sharedCircles }
          }
        });

        if (userCircles.length === 0) {
          return res.status(403).json({ error: 'Not shared with you' });
        }
      }
    }

    res.json({
      success: true,
      journal: journal.userId === req.userId ? journal : stripPrivate(journal)
    });
  } catch (error) {
    console.error('Get journal error:', error);
    res.status(500).json({ error: 'Failed to fetch journal' });
  }
};

// Create journal
exports.createJournal = async (req, res) => {
  try {
    const { title, body, visibility, sharedCircles, tags } = req.body;

    const journal = await Journal.create({
      userId: req.userId,
      title,
      body,
      visibility: visibility || 'private',
      sharedCircles: sharedCircles || [],
      tags: tags || []
    });

    // Journal is already saved. Try to score it in real time; if the ML service is slow or down
    // this resolves to 'pending' and the background worker retries later. Never blocks/fails the write.
    const analysisStatus = await analysis.tryAnalyzeInline(journal);

    res.status(201).json({
      success: true,
      message: 'Journal created successfully',
      analysisStatus,
      journal
    });
  } catch (error) {
    console.error('Create journal error:', error);
    res.status(500).json({ error: 'Failed to create journal' });
  }
};

// Update journal
exports.updateJournal = async (req, res) => {
  try {
    const { journalId } = req.params;
    const { title, body, visibility, sharedCircles, tags, isFavorite } = req.body;

    const journal = await Journal.findByPk(journalId);

    if (!journal) {
      return res.status(404).json({ error: 'Journal not found' });
    }

    if (journal.userId !== req.userId) {
      return res.status(403).json({ error: 'Can only edit your own journals' });
    }

    // Update fields
    const textChanged =
      (title !== undefined && title !== journal.title) || (body !== undefined && body !== journal.body);
    if (title !== undefined) journal.title = title;
    if (body !== undefined) journal.body = body;
    if (textChanged) journal.analysisStatus = 'pending';
    if (visibility !== undefined) journal.visibility = visibility;
    if (sharedCircles !== undefined) {
      journal.sharedCircles = visibility === 'circles' ? sharedCircles : [];
    }
    if (tags !== undefined) journal.tags = tags;
    if (isFavorite !== undefined) journal.isFavorite = isFavorite;

    await journal.save();
    if (textChanged) await analysis.tryAnalyzeInline(journal);

    res.json({
      success: true,
      message: 'Journal updated successfully',
      analysisStatus: journal.analysisStatus,
      journal
    });
  } catch (error) {
    console.error('Update journal error:', error);
    res.status(500).json({ error: 'Failed to update journal' });
  }
};

// Delete journal
exports.deleteJournal = async (req, res) => {
  try {
    const { journalId } = req.params;

    const journal = await Journal.findByPk(journalId);

    if (!journal) {
      return res.status(404).json({ error: 'Journal not found' });
    }

    if (journal.userId !== req.userId) {
      return res.status(403).json({ error: 'Can only delete your own journals' });
    }

    await journal.destroy();

    res.json({
      success: true,
      message: 'Journal deleted successfully'
    });
  } catch (error) {
    console.error('Delete journal error:', error);
    res.status(500).json({ error: 'Failed to delete journal' });
  }
};

// Toggle favorite
exports.toggleFavorite = async (req, res) => {
  try {
    const { journalId } = req.params;

    const journal = await Journal.findByPk(journalId);

    if (!journal) {
      return res.status(404).json({ error: 'Journal not found' });
    }

    if (journal.userId !== req.userId) {
      return res.status(403).json({ error: 'Can only favorite your own journals' });
    }

    journal.isFavorite = !journal.isFavorite;
    await journal.save();

    res.json({
      success: true,
      message: journal.isFavorite ? 'Added to favorites' : 'Removed from favorites',
      isFavorite: journal.isFavorite
    });
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({ error: 'Failed to update favorite' });
  }
};

// Get journals by tag
exports.getJournalsByTag = async (req, res) => {
  try {
    const { tag } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const journals = await Journal.findAll({
      where: {
        userId: req.userId,
        tags: {
          [Op.contains]: [tag]
        }
      },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      tag,
      count: journals.length,
      journals
    });
  } catch (error) {
    console.error('Get journals by tag error:', error);
    res.status(500).json({ error: 'Failed to fetch journals' });
  }
};

// Get all unique tags
exports.getAllTags = async (req, res) => {
  try {
    const journals = await Journal.findAll({
      where: { userId: req.userId },
      attributes: ['tags']
    });

    const allTags = journals.flatMap(j => j.tags);
    const uniqueTags = [...new Set(allTags)];

    res.json({
      success: true,
      tags: uniqueTags
    });
  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
};

// Get journals shared to a circle
exports.getCircleJournals = async (req, res) => {
  try {
    const { circleId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    // Check if user is member
    const membership = await CircleMember.findOne({
      where: {
        userId: req.userId,
        circleId,
        status: 'active'
      }
    });

    if (!membership) {
      return res.status(403).json({ error: 'Not a member of this circle' });
    }

    // Get journals shared to this circle
    const journals = await Journal.findAll({
      where: {
        [Op.or]: [
          { visibility: 'public' },
          {
            visibility: 'circles',
            sharedCircles: {
              [Op.contains]: [circleId]
            }
          }
        ]
      },
      attributes: publicAttributes,
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'displayName', 'profilePicture']
      }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      count: journals.length,
      journals
    });
  } catch (error) {
    console.error('Get circle journals error:', error);
    res.status(500).json({ error: 'Failed to fetch circle journals' });
  }
};

// Get public journals (feed)
// Add this to your exports
// Add this to your exports list
exports.getPublicJournals = async (req, res) => {
  try {
    const journals = await Journal.findAll({
      where: { visibility: 'public' }, // MUST be 'public' (lowercase)
      attributes: publicAttributes,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['username', 'profilePicture'] // Get author details
        }
      ],
      order: [['createdAt', 'DESC']] // Newest first
    });

    res.json(journals);
  } catch (error) {
    console.error('Get public journals error:', error);
    res.status(500).json({ message: 'Error fetching public journals' });
  }
};

exports.getJournalStats = async (req, res) => {
  try {
    const total = await Journal.count({
      where: { userId: req.userId }
    });

    const favorites = await Journal.count({
      where: { userId: req.userId, isFavorite: true }
    });

    const byVisibility = await Journal.findAll({
      where: { userId: req.userId },
      attributes: [
        'visibility',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['visibility'],
      raw: true
    });

    const recentJournals = await Journal.findAll({
      where: {
        userId: req.userId,
        createdAt: {
          [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    });

    res.json({
      success: true,
      stats: {
        total,
        favorites,
        last30Days: recentJournals.length,
        byVisibility: byVisibility.reduce((acc, item) => {
          acc[item.visibility] = parseInt(item.count);
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};



/* =====================================================================
   ML-powered endpoints
   ===================================================================== */

const clampInt = (v, def, min, max) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? def : Math.min(Math.max(n, min), max);
};

// Load journals by id and return them in the given order, annotated with similarity.
async function hydrate(userId, hits) {
  if (!hits.length) return [];
  const rows = await Journal.findAll({ where: { id: { [Op.in]: hits.map((h) => h.id) }, userId } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return hits
    .filter((h) => byId.has(h.id))
    .map((h) => ({ ...byId.get(h.id).toJSON(), similarity: Number(h.similarity.toFixed(4)) }));
}

// GET /api/journals/search/semantic?q=...&limit=10
// Meaning-based search over the *current user's own* entries via pgvector cosine similarity.
// Falls back to keyword (ILIKE) search if pgvector or the ML service is unavailable.
exports.semanticSearch = async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2 || q.length > 500) {
    return res.status(400).json({ error: 'Query must be 2-500 characters' });
  }
  const limit = clampInt(req.query.limit, 10, 1, 50);
  const minSimilarity = Math.max(0, Math.min(1, parseFloat(req.query.minSimilarity) || 0.1));

  try {
    if (vectorStore.isEnabled()) {
      try {
        const emb = await ml.embed([q], 5000);
        const hits = await vectorStore.searchByVector({
          userId: req.userId,
          embedding: emb.embeddings[0],
          model: emb.model,
          limit,
          minSimilarity,
        });
        return res.json({
          success: true,
          mode: 'semantic',
          embeddingModel: emb.model,
          lexicalFallbackModel: !!emb.degraded,
          query: q,
          count: hits.length,
          journals: await hydrate(req.userId, hits),
        });
      } catch (err) {
        if (!(err instanceof ml.MLUnavailableError)) throw err;
        console.warn('Semantic search falling back to keyword search:', err.message);
      }
    }

    const journals = await Journal.findAll({
      where: {
        userId: req.userId,
        [Op.or]: [{ title: { [Op.iLike]: `%${q}%` } }, { body: { [Op.iLike]: `%${q}%` } }],
      },
      order: [['createdAt', 'DESC']],
      limit,
    });
    res.json({ success: true, mode: 'keyword', query: q, count: journals.length, journals });
  } catch (error) {
    console.error('Semantic search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
};

// GET /api/journals/:journalId/similar?limit=5
exports.getSimilarJournals = async (req, res) => {
  try {
    const journal = await Journal.findByPk(req.params.journalId, { attributes: ['id', 'userId'] });
    if (!journal) return res.status(404).json({ error: 'Journal not found' });
    if (journal.userId !== req.userId) return res.status(403).json({ error: 'Not your journal' });

    if (!vectorStore.isEnabled()) {
      return res.json({ success: true, available: false, count: 0, journals: [] });
    }
    const hits = await vectorStore.similarTo({
      userId: req.userId,
      journalId: journal.id,
      limit: clampInt(req.query.limit, 5, 1, 20),
      minSimilarity: 0.1,
    });
    res.json({ success: true, available: true, count: hits.length, journals: await hydrate(req.userId, hits) });
  } catch (error) {
    console.error('Similar journals error:', error);
    res.status(500).json({ error: 'Failed to find similar journals' });
  }
};

// GET /api/journals/sentiment/trend?days=30  -> daily average sentiment for the current user
exports.getSentimentTrend = async (req, res) => {
  try {
    const days = clampInt(req.query.days, 30, 1, 365);
    const [rows] = await sequelize.query(
      `SELECT to_char(created_at::date, 'YYYY-MM-DD') AS date,
              AVG(sentiment_score)::float AS avg_score,
              COUNT(*)::int AS entries,
              COUNT(*) FILTER (WHERE sentiment_label = 'positive')::int AS positive,
              COUNT(*) FILTER (WHERE sentiment_label = 'neutral')::int  AS neutral,
              COUNT(*) FILTER (WHERE sentiment_label = 'negative')::int AS negative
         FROM journals
        WHERE user_id = :userId AND sentiment_score IS NOT NULL
          AND created_at >= now() - make_interval(days => :days)
        GROUP BY 1 ORDER BY 1`,
      { replacements: { userId: req.userId, days } }
    );
    const pending = await Journal.count({ where: { userId: req.userId, analysisStatus: 'pending' } });
    res.json({
      success: true,
      days,
      pendingAnalysis: pending,
      trend: rows.map((r) => ({ ...r, avg_score: r.avg_score === null ? null : Number(r.avg_score.toFixed(3)) })),
    });
  } catch (error) {
    console.error('Sentiment trend error:', error);
    res.status(500).json({ error: 'Failed to compute sentiment trend' });
  }
};

// POST /api/journals/:journalId/reanalyze
exports.reanalyzeJournal = async (req, res) => {
  try {
    const journal = await Journal.findByPk(req.params.journalId);
    if (!journal) return res.status(404).json({ error: 'Journal not found' });
    if (journal.userId !== req.userId) return res.status(403).json({ error: 'Not your journal' });

    try {
      await analysis.analyzeJournal(journal, { timeoutMs: 15000 });
    } catch (err) {
      if (err instanceof ml.MLUnavailableError) {
        return res.status(503).json({ error: 'Analysis service is temporarily unavailable', analysisStatus: journal.analysisStatus });
      }
      throw err;
    }
    res.json({ success: true, analysisStatus: journal.analysisStatus, journal });
  } catch (error) {
    console.error('Reanalyze error:', error);
    res.status(500).json({ error: 'Failed to analyze journal' });
  }
};

// POST /api/journals/reindex  -> (re)embed the caller's entries that have no vector or an outdated model
exports.reindexMyJournals = async (req, res) => {
  try {
    if (!vectorStore.isEnabled()) {
      return res.status(503).json({ error: 'Vector search is not enabled on this server' });
    }
    const current = await ml.embed(['model probe'], 5000).catch((e) => {
      if (e instanceof ml.MLUnavailableError) return null;
      throw e;
    });
    if (!current) return res.status(503).json({ error: 'Analysis service is temporarily unavailable' });

    const ids = await analysis.findStaleForReindex(req.userId, current.model, 100);
    let done = 0;
    for (const id of ids) {
      const journal = await Journal.findByPk(id);
      try {
        await analysis.analyzeJournal(journal, { timeoutMs: 15000 });
        done += 1;
      } catch (err) {
        if (err instanceof ml.MLUnavailableError) break;
        throw err;
      }
    }
    res.json({ success: true, embeddingModel: current.model, stale: ids.length, reindexed: done });
  } catch (error) {
    console.error('Reindex error:', error);
    res.status(500).json({ error: 'Reindex failed' });
  }
};
