const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Journal = sequelize.define('Journal', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // mood: {
  //   type: DataTypes.ENUM('Good Day', 'Neutral Day', 'Bad Day', 'Not Added'),
  //   allowNull: true,
  //   defaultValue: 'Not Added' 
  // },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      len: [1, 200]
    }
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      len: [1, 10000]
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
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING(30)),
    defaultValue: []
  },
  isFavorite: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },

  // ---- ML analysis (filled by the FastAPI microservice; see services/journalAnalysis.js) ----
  // 'pending' = not analysed yet (ML down/slow); a background worker retries these.
  analysisStatus: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'pending',
    validate: { isIn: [['pending', 'done']] }
  },
  sentimentLabel: {
    type: DataTypes.STRING(10),
    allowNull: true,
    validate: { isIn: [['negative', 'neutral', 'positive']] }
  },
  // positive_prob - negative_prob, in [-1, 1]
  sentimentScore: {
    type: DataTypes.FLOAT,
    allowNull: true,
    validate: { min: -1, max: 1 }
  },
  sentimentConfidence: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  // class probabilities, emotion distribution, which models voted
  sentimentDetails: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  analyzedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'journals',
  indexes: [
    { fields: ['user_id', 'created_at'] },
    { fields: ['user_id', 'is_favorite'] },
    { fields: ['visibility'] },
    { fields: ['analysis_status'] },
    { fields: ['user_id', 'sentiment_label'] }
  ]
});

module.exports = Journal;
