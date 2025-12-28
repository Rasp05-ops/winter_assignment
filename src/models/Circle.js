// src/models/Circle.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Circle = sequelize.define('Circle', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      len: [3, 100]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: [0, 1000]
    }
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: [['anxiety', 'depression', 'stress', 'productivity', 'mindfulness', 'relationships', 'other']]
    }
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING(30)),
    defaultValue: [],
    allowNull: true
  },
  memberCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  },
  isPrivate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  coverImage: {
    type: DataTypes.STRING(255),
    defaultValue: 'default-circle.png'
  }
}, {
  tableName: 'circles',
  indexes: [
    { fields: ['category'] },
    { fields: ['createdBy'] },
    { fields: ['tags'], using: 'gin' }
  ]
});

module.exports = Circle;

