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
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      len: [1, 10000]
    }
  },
  mood: {
    type: DataTypes.ENUM('great', 'good', 'okay', 'bad', 'terrible'),
    allowNull: true
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING(30)),
    defaultValue: []
  },
  isPrivate: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  isFavorite: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'journals',
  indexes: [
    { fields: ['userId', 'createdAt'] },
    { fields: ['userId', 'isFavorite'] }
  ]
});

module.exports = Journal;
