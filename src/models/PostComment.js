const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PostComment = sequelize.define('PostComment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  postId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'circle_posts',
      key: 'id'
    },
    onDelete: 'CASCADE'
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
      len: [1, 2000]
    }
  },
  likeCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'post_comments',
  indexes: [
    { fields: ['postId', 'createdAt'] },
    { fields: ['userId'] }
  ]
});

module.exports = PostComment;
