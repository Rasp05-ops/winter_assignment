const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CircleMember = sequelize.define('CircleMember', {
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
  circleId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'circles',
      key: 'id'
    }
  },
  role: {
    type: DataTypes.ENUM('admin', 'moderator', 'member'),
    defaultValue: 'member'
  },
  status: {
    type: DataTypes.ENUM('active', 'pending', 'rejected', 'left'),
    defaultValue: 'active'
  },

  joinedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'circle_members',
  indexes: [
    { unique: true, fields: ['userId', 'circleId'] },
    { fields: ['circleId'] },
    { fields: ['userId'] }
  ]
});

module.exports = CircleMember;
