const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CirclePost = sequelize.define('CirclePost', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  circleId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'circles',
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      len: [1, 5000]
    }
  },
  type: {
    type: DataTypes.ENUM('text', 'image', 'poll', 'resource'),
    defaultValue: 'text'
  },
  attachments: {
    type: DataTypes.ARRAY(DataTypes.STRING(255)),
    defaultValue: []
  },
  likeCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  commentCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  isPinned: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'circle_posts',
  indexes: [
    { fields: ['circleId', 'createdAt'] },
    { fields: ['userId'] }
  ]
});

module.exports = CirclePost;
