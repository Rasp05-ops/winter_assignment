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
  }
}, {
  tableName: 'circle_members',
  indexes: [
    { unique: true, fields: ['user_id', 'circle_id'] },  // ✅ Fixed
    { fields: ['circle_id', 'status'] },                  // ✅ Fixed
    { fields: ['user_id', 'status'] }                     // ✅ Fixed
  ]
});

module.exports = CircleMember;