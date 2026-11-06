const User = require('../models/User');
const Circle = require('../models/Circle');
const CircleMember = require('../models/CircleMember');
const CirclePost = require('../models/CirclePost');
const MoodLog = require('../models/MoodLog');
const Journal = require('../models/Journal');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

// Get complete dashboard data
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.userId;
    const today = new Date().toISOString().split('T')[0];

    // Get user with interests
    const user = await User.findByPk(userId, {
      attributes: ['id', 'username', 'interests']
    });

    // 1. Check if today's mood log exists
    const todayMoodLog = await MoodLog.findOne({
      where: {
        userId,
        date: today
      }
    });

    const moodLogPrompt = !todayMoodLog ? {
      show: true,
      message: "How are you feeling today?",
      action: "Fill Mood Log"
    } : null;

    // 2. Get recommended circles based on user interests
    const recommendedCircles = await Circle.findAll({
      where: {
        [Op.or]: [
          { tags: { [Op.overlap]: user.interests || [] } },
          { category: { [Op.in]: user.interests || [] } }
        ],
        id: {
          [Op.notIn]: sequelize.literal(`(
            SELECT circle_id FROM circle_members 
            WHERE user_id = '${userId}'
          )`)
        }
      },
      include: [{
        model: User,
        as: 'creator',
        attributes: ['username', 'profilePicture']
      }],
      limit: 10,
      order: [['memberCount', 'DESC']]
    });

    // 3. Get user's joined circles
    const joinedCircles = await CircleMember.findAll({
      where: { userId, status: 'active' },
      include: [{
        model: Circle,
        as: 'circle',
        include: [{
          model: User,
          as: 'creator',
          attributes: ['username', 'profilePicture']
        }]
      }],
      order: [['joinedAt', 'DESC']]
    });

    const joinedCircleIds = joinedCircles.map(jc => jc.circleId);

    // 4. Get updates from joined circles (recent posts)
    const circleUpdates = await CirclePost.findAll({
      where: {
        circleId: { [Op.in]: joinedCircleIds },
        createdAt: {
          [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'username', 'displayName', 'profilePicture']
        },
        {
          model: Circle,
          as: 'circle',
          attributes: ['id', 'name', 'coverImage']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 20
    });

    // 5. Get recent journals for quick access
    const recentJournals = await Journal.findAll({
      where: { userId },
      attributes: ['id', 'title', 'createdAt', 'isFavorite'],
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    // 6. Get mood log stats for the week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const weekMoodLogs = await MoodLog.findAll({
      where: {
        userId,
        date: {
          [Op.gte]: weekAgo.toISOString().split('T')[0]
        }
      },
      order: [['date', 'ASC']]
    });

    res.json({
      success: true,
      dashboard: {
        moodLogPrompt,
        recommendedCircles: recommendedCircles.map(circle => ({
          id: circle.id,
          name: circle.name,
          description: circle.description,
          category: circle.category,
          tags: circle.tags,
          memberCount: circle.memberCount,
          coverImage: circle.coverImage,
          creator: {
            username: circle.creator.username,
            profilePicture: circle.creator.profilePicture
          }
        })),
        joinedCircles: joinedCircles.map(jc => ({
          id: jc.circle.id,
          name: jc.circle.name,
          description: jc.circle.description,
          category: jc.circle.category,
          memberCount: jc.circle.memberCount,
          coverImage: jc.circle.coverImage,
          role: jc.role,
          joinedAt: jc.joinedAt
        })),
        circleUpdates: circleUpdates.map(post => ({
          id: post.id,
          content: post.content.substring(0, 200) + (post.content.length > 200 ? '...' : ''),
          type: post.type,
          likeCount: post.likeCount,
          commentCount: post.commentCount,
          createdAt: post.createdAt,
          author: {
            id: post.author.id,
            username: post.author.username,
            displayName: post.author.displayName,
            profilePicture: post.author.profilePicture
          },
          circle: {
            id: post.circle.id,
            name: post.circle.name,
            coverImage: post.circle.coverImage
          }
        })),
        recentJournals: recentJournals.map(journal => ({
          id: journal.id,
          title: journal.title,
          createdAt: journal.createdAt,
          isFavorite: journal.isFavorite
        })),
        moodStats: {
          weeklyLogs: weekMoodLogs.map(log => ({
            date: log.date,
            mood: log.mood,
            moodScore: log.moodScore
          })),
          averageMood: weekMoodLogs.length > 0 
            ? (weekMoodLogs.reduce((sum, log) => sum + log.moodScore, 0) / weekMoodLogs.length).toFixed(1)
            : null,
          loggedDays: weekMoodLogs.length
        }
      }
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to fetch dashboard data' 
    });
  }
};

// Get recommended circles only
exports.getRecommendedCircles = async (req, res) => {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 10;

    const user = await User.findByPk(userId, {
      attributes: ['interests']
    });

    const recommendedCircles = await Circle.findAll({
      where: {
        [Op.or]: [
          { tags: { [Op.overlap]: user.interests || [] } },
          { category: { [Op.in]: user.interests || [] } }
        ],
        id: {
          [Op.notIn]: sequelize.literal(`(
            SELECT circle_id FROM circle_members 
            WHERE user_id = '${userId}'
          )`)
        }
      },
      include: [{
        model: User,
        as: 'creator',
        attributes: ['username', 'profilePicture']
      }],
      limit,
      order: [['memberCount', 'DESC']]
    });

    res.json({
      success: true,
      circles: recommendedCircles
    });
  } catch (error) {
    console.error('Get recommended circles error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to fetch recommended circles' 
    });
  }
};

// Get circle updates
exports.getCircleUpdates = async (req, res) => {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    // Get user's joined circles
    const joinedCircles = await CircleMember.findAll({
      where: { userId, status: 'active' },
      attributes: ['circleId']
    });

    const circleIds = joinedCircles.map(jc => jc.circleId);

    if (circleIds.length === 0) {
      return res.json({
        success: true,
        updates: [],
        hasMore: false
      });
    }

    const updates = await CirclePost.findAll({
      where: { circleId: { [Op.in]: circleIds } },
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'username', 'displayName', 'profilePicture']
        },
        {
          model: Circle,
          as: 'circle',
          attributes: ['id', 'name', 'coverImage']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: limit + 1,
      offset
    });

    const hasMore = updates.length > limit;
    const posts = hasMore ? updates.slice(0, -1) : updates;

    res.json({
      success: true,
      updates: posts,
      hasMore
    });
  } catch (error) {
    console.error('Get circle updates error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to fetch circle updates' 
    });
  }
};

// Check if mood log exists for today
exports.checkTodayMoodLog = async (req, res) => {
  try {
    const userId = req.userId;
    const today = new Date().toISOString().split('T')[0];

    const moodLog = await MoodLog.findOne({
      where: {
        userId,
        date: today
      }
    });

    res.json({
      success: true,
      exists: !!moodLog,
      moodLog: moodLog ? {
        id: moodLog.id,
        mood: moodLog.mood,
        moodScore: moodLog.moodScore,
        emotions: moodLog.emotions,
        time: moodLog.time
      } : null
    });
  } catch (error) {
    console.error('Check mood log error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to check mood log' 
    });
  }
};

// Get quick access journals
exports.getQuickAccessJournals = async (req, res) => {
  try {
    const userId = req.userId;
    const limit = parseInt(req.query.limit) || 10;

    const journals = await Journal.findAll({
      where: { userId },
      attributes: ['id', 'title', 'mood', 'tags', 'createdAt', 'isFavorite'],
      order: [
        ['isFavorite', 'DESC'],
        ['createdAt', 'DESC']
      ],
      limit
    });

    res.json({
      success: true,
      journals
    });
  } catch (error) {
    console.error('Get journals error:', error);
    res.status(500).json({ 
      error: 'Server error',
      message: 'Failed to fetch journals' 
    });
  }
};
