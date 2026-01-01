const MoodLog = require('../models/MoodLog');
const Circle = require('../models/Circle');
const CircleMember = require('../models/CircleMember');
const User = require('../models/User');
const { Op } = require('sequelize');

// Get today's mood log
exports.getTodayMood = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const moodLog = await MoodLog.findOne({
      where: {
        userId: req.userId,
        date: today
      }
    });

    if (!moodLog) {
      return res.json({
        success: true,
        exists: false,
        message: 'No mood logged for today',
        prompt: 'How are you feeling today?'
      });
    }

    res.json({
      success: true,
      exists: true,
      moodLog
    });
  } catch (error) {
    console.error('Get today mood error:', error);
    res.status(500).json({ error: 'Failed to fetch today\'s mood' });
  }
};

// Create or update today's mood log
exports.logMood = async (req, res) => {
  try {
    const { mood, emotions, activities, notes, visibility, sharedCircles } = req.body;
    const today = new Date().toISOString().split('T')[0];

    // Check if mood already exists for today
    let moodLog = await MoodLog.findOne({
      where: {
        userId: req.userId,
        date: today
      }
    });

    if (moodLog) {
      // Update existing mood
      moodLog.mood = mood;
      moodLog.emotions = emotions || [];
      moodLog.activities = activities || [];
      moodLog.notes = notes || null;
      moodLog.visibility = visibility || 'private';
      moodLog.sharedCircles = sharedCircles || [];
      await moodLog.save();

      return res.json({
        success: true,
        message: 'Mood updated successfully',
        moodLog
      });
    }

    // Create new mood log
    moodLog = await MoodLog.create({
      userId: req.userId,
      mood,
      emotions: emotions || [],
      activities: activities || [],
      notes: notes || null,
      visibility: visibility || 'private',
      sharedCircles: sharedCircles || [],
      date: today
    });

    res.status(201).json({
      success: true,
      message: 'Mood logged successfully',
      moodLog
    });
  } catch (error) {
    console.error('Log mood error:', error);
    res.status(500).json({ error: 'Failed to log mood' });
  }
};

// Get mood log by date
exports.getMoodByDate = async (req, res) => {
  try {
    const { date } = req.params;

    const moodLog = await MoodLog.findOne({
      where: {
        userId: req.userId,
        date
      }
    });

    if (!moodLog) {
      return res.status(404).json({ error: 'No mood log found for this date' });
    }

    res.json({
      success: true,
      moodLog
    });
  } catch (error) {
    console.error('Get mood by date error:', error);
    res.status(500).json({ error: 'Failed to fetch mood log' });
  }
};

// Get mood logs for a date range
exports.getMoodRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const limit = parseInt(req.query.limit) || 30;

    let where = { userId: req.userId };

    if (startDate && endDate) {
      where.date = {
        [Op.between]: [startDate, endDate]
      };
    } else if (startDate) {
      where.date = {
        [Op.gte]: startDate
      };
    } else if (endDate) {
      where.date = {
        [Op.lte]: endDate
      };
    }

    const moodLogs = await MoodLog.findAll({
      where,
      order: [['date', 'DESC']],
      limit
    });

    res.json({
      success: true,
      count: moodLogs.length,
      moodLogs
    });
  } catch (error) {
    console.error('Get mood range error:', error);
    res.status(500).json({ error: 'Failed to fetch mood logs' });
  }
};

// Get mood calendar view (last 30 days)
exports.getMoodCalendar = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const moodLogs = await MoodLog.findAll({
      where: {
        userId: req.userId,
        date: {
          [Op.gte]: startDate.toISOString().split('T')[0]
        }
      },
      order: [['date', 'DESC']]
    });

    // Calculate mood statistics
    const stats = {
      total: moodLogs.length,
      good: moodLogs.filter(m => m.mood === 'good').length,
      neutral: moodLogs.filter(m => m.mood === 'neutral').length,
      bad: moodLogs.filter(m => m.mood === 'bad').length,
      notAdded: days - moodLogs.length
    };

    res.json({
      success: true,
      stats,
      calendar: moodLogs
    });
  } catch (error) {
    console.error('Get mood calendar error:', error);
    res.status(500).json({ error: 'Failed to fetch mood calendar' });
  }
};

// Get mood statistics
exports.getMoodStats = async (req, res) => {
  try {
    const { period = '30' } = req.query; // 7, 30, 90, 365 days
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const moodLogs = await MoodLog.findAll({
      where: {
        userId: req.userId,
        date: {
          [Op.gte]: startDate.toISOString().split('T')[0]
        }
      },
      order: [['date', 'ASC']]
    });

    // Calculate statistics
    const totalLogs = moodLogs.length;
    const moodCounts = {
      good: moodLogs.filter(m => m.mood === 'good').length,
      neutral: moodLogs.filter(m => m.mood === 'neutral').length,
      bad: moodLogs.filter(m => m.mood === 'bad').length
    };

    const percentages = {
      good: totalLogs > 0 ? ((moodCounts.good / totalLogs) * 100).toFixed(1) : 0,
      neutral: totalLogs > 0 ? ((moodCounts.neutral / totalLogs) * 100).toFixed(1) : 0,
      bad: totalLogs > 0 ? ((moodCounts.bad / totalLogs) * 100).toFixed(1) : 0
    };

    // Most common emotions
    const allEmotions = moodLogs.flatMap(m => m.emotions);
    const emotionCounts = {};
    allEmotions.forEach(emotion => {
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    });
    const topEmotions = Object.entries(emotionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([emotion, count]) => ({ emotion, count }));

    // Most common activities
    const allActivities = moodLogs.flatMap(m => m.activities);
    const activityCounts = {};
    allActivities.forEach(activity => {
      activityCounts[activity] = (activityCounts[activity] || 0) + 1;
    });
    const topActivities = Object.entries(activityCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([activity, count]) => ({ activity, count }));

    // Streak calculation
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    const today = new Date().toISOString().split('T')[0];
    
    for (let i = 0; i < days; i++) {
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      const hasLog = moodLogs.some(m => m.date === dateStr);
      
      if (hasLog) {
        tempStreak++;
        if (dateStr === today || i === 0) {
          currentStreak = tempStreak;
        }
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    res.json({
      success: true,
      period: `${days} days`,
      stats: {
        totalLogs,
        loggedDays: totalLogs,
        missedDays: days - totalLogs,
        consistency: totalLogs > 0 ? ((totalLogs / days) * 100).toFixed(1) : 0,
        moodCounts,
        percentages,
        topEmotions,
        topActivities,
        streaks: {
          current: currentStreak,
          longest: longestStreak
        }
      },
      timeline: moodLogs.map(m => ({
        date: m.date,
        mood: m.mood
      }))
    });
  } catch (error) {
    console.error('Get mood stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
};

// Update mood visibility
exports.updateVisibility = async (req, res) => {
  try {
    const { date } = req.params;
    const { visibility, sharedCircles } = req.body;

    const moodLog = await MoodLog.findOne({
      where: {
        userId: req.userId,
        date
      }
    });

    if (!moodLog) {
      return res.status(404).json({ error: 'Mood log not found' });
    }

    moodLog.visibility = visibility;
    if (visibility === 'circles') {
      moodLog.sharedCircles = sharedCircles || [];
    } else {
      moodLog.sharedCircles = [];
    }
    await moodLog.save();

    res.json({
      success: true,
      message: 'Visibility updated',
      moodLog
    });
  } catch (error) {
    console.error('Update visibility error:', error);
    res.status(500).json({ error: 'Failed to update visibility' });
  }
};

// Get shared mood logs from circles
exports.getCircleMoodLogs = async (req, res) => {
  try {
    const { circleId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    // Check if user is member of circle
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

    // Get mood logs shared to this circle
    const moodLogs = await MoodLog.findAll({
      where: {
        [Op.or]: [
          { visibility: 'public' },
          {
            visibility: 'circles',
            sharedCircles: {
              [Op.contains]: [circleId]
            }
          }
        ],
        date: {
          [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }
      },
      include: [{
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'displayName', 'profilePicture']
      }],
      order: [['date', 'DESC']],
      limit,
      offset
    });

    res.json({
      success: true,
      count: moodLogs.length,
      moodLogs
    });
  } catch (error) {
    console.error('Get circle moods error:', error);
    res.status(500).json({ error: 'Failed to fetch circle mood logs' });
  }
};

// Delete mood log
exports.deleteMoodLog = async (req, res) => {
  try {
    const { date } = req.params;

    const moodLog = await MoodLog.findOne({
      where: {
        userId: req.userId,
        date
      }
    });

    if (!moodLog) {
      return res.status(404).json({ error: 'Mood log not found' });
    }

    await moodLog.destroy();

    res.json({
      success: true,
      message: 'Mood log deleted'
    });
  } catch (error) {
    console.error('Delete mood log error:', error);
    res.status(500).json({ error: 'Failed to delete mood log' });
  }
};

// Auto-fill "not_added" for inactive days (runs daily via cron or manual trigger)
exports.autoFillMissedDays = async (req, res) => {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Find all users who didn't log mood yesterday
    const existingLogs = await MoodLog.findAll({
      where: { date: yesterdayStr },
      attributes: ['userId']
    });

    const loggedUserIds = existingLogs.map(log => log.userId);

    // Get all users who need auto-fill
    const allUsers = await User.findAll({
      attributes: ['id']
    });

    const usersToFill = allUsers.filter(user => !loggedUserIds.includes(user.id));

    // Auto-fill for users who missed
    const autoFillPromises = usersToFill.map(user => {
      return MoodLog.create({
        userId: user.id,
        mood: 'not_added',
        date: yesterdayStr,
        visibility: 'private'
      });
    });

    await Promise.all(autoFillPromises);

    res.json({
      success: true,
      message: `Auto-filled ${usersToFill.length} missed mood logs`,
      count: usersToFill.length
    });
  } catch (error) {
    console.error('Auto-fill error:', error);
    res.status(500).json({ error: 'Failed to auto-fill missed days' });
  }
};
