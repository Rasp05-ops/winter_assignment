const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MoodLog = sequelize.define('MoodLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  mood: {
    type: DataTypes.ENUM('great', 'good', 'okay', 'bad', 'terrible'),
    allowNull: false
  },
  moodScore: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 5
    }
  },
  emotions: {
    type: DataTypes.ARRAY(DataTypes.STRING(30)),
    defaultValue: []
  },
  activities: {
    type: DataTypes.ARRAY(DataTypes.STRING(50)),
    defaultValue: []
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: [0, 1000]
    }
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  time: {
    type: DataTypes.TIME,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'mood_logs',
  indexes: [
    { unique: true, fields: ['userId', 'date'] },
    { fields: ['userId', 'createdAt'] },
    { fields: ['date'] }
  ]
});

module.exports = MoodLog;

