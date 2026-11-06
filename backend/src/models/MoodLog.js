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
    type: DataTypes.ENUM('good', 'neutral', 'bad', 'not_added'),
    allowNull: false,
    defaultValue: 'not_added'
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
  visibility: {
    type: DataTypes.ENUM('private', 'circles', 'public'),
    defaultValue: 'private'
  },
  sharedCircles: {
    type: DataTypes.ARRAY(DataTypes.UUID),
    defaultValue: []
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'mood_logs',
  indexes: [
    { unique: true, fields: ['user_id', 'date'] },
    { fields: ['user_id', 'created_at'] },
    { fields: ['date'] },
    { fields: ['mood'] }
  ]
});

module.exports = MoodLog;
