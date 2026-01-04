const Journal = require('../models/Journal');
const User = require('../models/User');
const CircleMember = require('../models/CircleMember');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database'); 

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
      journal
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

    res.status(201).json({
      success: true,
      message: 'Journal created successfully',
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
    if (title !== undefined) journal.title = title;
    if (body !== undefined) journal.body = body;
    if (visibility !== undefined) journal.visibility = visibility;
    if (sharedCircles !== undefined) {
      journal.sharedCircles = visibility === 'circles' ? sharedCircles : [];
    }
    if (tags !== undefined) journal.tags = tags;
    if (isFavorite !== undefined) journal.isFavorite = isFavorite;

    await journal.save();

    res.json({
      success: true,
      message: 'Journal updated successfully',
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
};exports.getJournalStats = async (req, res) => {
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

