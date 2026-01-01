const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Journal = sequelize.define('Journal', {
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
  }
}, {
  tableName: 'journals',
  indexes: [
    { fields: ['user_id', 'created_at'] },
    { fields: ['user_id', 'is_favorite'] },
    { fields: ['visibility'] }
  ]
});

module.exports = Journal;
