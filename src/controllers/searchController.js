const Circle = require('../models/Circle');
const User = require('../models/User');
const Journal = require('../models/Journal');
const CircleMember = require('../models/CircleMember');
const { Op } = require('sequelize');

exports.searchAll = async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ 
        error: 'Search query must be at least 2 characters' 
      });
    }

    const searchTerm = query.trim();

    const circles = await Circle.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.iLike]: `%${searchTerm}%` } },
          { description: { [Op.iLike]: `%${searchTerm}%` } },
          { tags: { [Op.overlap]: [searchTerm.toLowerCase()] } }
        ]
      },
      include: [{
        model: User,
        as: 'creator',
        attributes: ['username', 'profilePicture']
      }],
      limit: parseInt(limit)
    });

    const users = await User.findAll({
      where: {
        [Op.or]: [
          { username: { [Op.iLike]: `%${searchTerm}%` } },
          { displayName: { [Op.iLike]: `%${searchTerm}%` } }
        ]
      },
      attributes: ['id', 'username', 'displayName', 'profilePicture', 'bio'],
      limit: parseInt(limit)
    });

    const journals = await Journal.findAll({
      where: {
        visibility: 'public',
        [Op.or]: [
          { title: { [Op.iLike]: `%${searchTerm}%` } },
          { body: { [Op.iLike]: `%${searchTerm}%` } }
        ]
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['username', 'displayName', 'profilePicture']
      }],
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      query: searchTerm,
      results: {
        circles: circles.length > 0 ? circles : [],
        users: users.length > 0 ? users : [],
        journals: journals.length > 0 ? journals : []
      },
      totalResults: circles.length + users.length + journals.length
    });
  } catch (error) {
    console.error('Search all error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
};

exports.searchCircles = async (req, res) => {
  try {
    const { 
      query, 
      category, 
      tags, 
      visibility, 
      limit = 20, 
      offset = 0 
    } = req.query;

    let where = {};

    if (query && query.trim().length >= 2) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${query.trim()}%` } },
        { description: { [Op.iLike]: `%${query.trim()}%` } }
      ];
    }

    if (category) {
      where.category = category;
    }
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      where.tags = { [Op.overlap]: tagArray.map(t => t.toLowerCase()) };
    }

    if (visibility === 'public') {
      where.isPrivate = false;
    } else if (visibility === 'private') {
      where.isPrivate = true;
    }

    const circles = await Circle.findAll({
      where,
      include: [{
        model: User,
        as: 'creator',
        attributes: ['username', 'displayName', 'profilePicture']
      }],
      order: [['memberCount', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const total = await Circle.count({ where });

    res.json({
      success: true,
      filters: { query, category, tags, visibility },
      count: circles.length,
      total,
      circles
    });
  } catch (error) {
    console.error('Search circles error:', error);
    res.status(500).json({ error: 'Failed to search circles' });
  }
};

exports.getFilters = async (req, res) => {
  try {
    const circles = await Circle.findAll({
      attributes: ['tags', 'category']
    });

    const allTags = new Set();
    const categories = new Set();

    circles.forEach(circle => {
      circle.tags.forEach(tag => allTags.add(tag));
      categories.add(circle.category);
    });
    const popularCircles = await Circle.findAll({
      order: [['memberCount', 'DESC']],
      limit: 10,
      attributes: ['id', 'name', 'memberCount', 'category']
    });

    res.json({
      success: true,
      filters: {
        categories: Array.from(categories),
        tags: Array.from(allTags),
        popularCircles
      }
    });
  } catch (error) {
    console.error('Get filters error:', error);
    res.status(500).json({ error: 'Failed to fetch filters' });
  }
};
exports.discoverCircles = async (req, res) => {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 10;

    // Get user's interests
    const user = await User.findByPk(userId, {
      attributes: ['interests']
    });
    const joinedCircles = await CircleMember.findAll({
      where: { userId, status: 'active' },
      attributes: ['circleId']
    });

    const joinedCircleIds = joinedCircles.map(jc => jc.circleId);

    let where = {
      id: { [Op.notIn]: joinedCircleIds }
    };
    if (user.interests && user.interests.length > 0) {
      where[Op.or] = [
        { tags: { [Op.overlap]: user.interests } },
        { category: { [Op.in]: user.interests } }
      ];
    }

    const recommendedCircles = await Circle.findAll({
      where,
      include: [{
        model: User,
        as: 'creator',
        attributes: ['username', 'profilePicture']
      }],
      order: [['memberCount', 'DESC']],
      limit
    });
    if (recommendedCircles.length < limit) {
      const additionalCircles = await Circle.findAll({
        where: {
          id: { 
            [Op.notIn]: [
              ...joinedCircleIds, 
              ...recommendedCircles.map(c => c.id)
            ] 
          }
        },
        order: [['memberCount', 'DESC']],
        limit: limit - recommendedCircles.length
      });

      recommendedCircles.push(...additionalCircles);
    }

    res.json({
      success: true,
      count: recommendedCircles.length,
      circles: recommendedCircles,
      basedOn: user.interests && user.interests.length > 0 ? 'interests' : 'popular'
    });
  } catch (error) {
    console.error('Discover circles error:', error);
    res.status(500).json({ error: 'Failed to discover circles' });
  }
};
exports.getTrendingCircles = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const trendingCircles = await Circle.findAll({
      where: {
        createdAt: {
          [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      include: [{
        model: User,
        as: 'creator',
        attributes: ['username', 'profilePicture']
      }],
      order: [['memberCount', 'DESC']],
      limit
    });

    res.json({
      success: true,
      count: trendingCircles.length,
      circles: trendingCircles
    });
  } catch (error) {
    console.error('Get trending error:', error);
    res.status(500).json({ error: 'Failed to fetch trending circles' });
  }
};
exports.searchUsers = async (req, res) => {
  try {
    const { query, limit = 20, offset = 0 } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ 
        error: 'Search query must be at least 2 characters' 
      });
    }

    const searchTerm = query.trim();

    const users = await User.findAll({
      where: {
        [Op.or]: [
          { username: { [Op.iLike]: `%${searchTerm}%` } },
          { displayName: { [Op.iLike]: `%${searchTerm}%` } },
          { bio: { [Op.iLike]: `%${searchTerm}%` } }
        ]
      },
      attributes: ['id', 'username', 'displayName', 'profilePicture', 'bio', 'interests'],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      query: searchTerm,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
};
