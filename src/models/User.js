const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    },
    set(value) {
      this.setDataValue('email', value.toLowerCase().trim());
    }
  },
  username: {
    type: DataTypes.STRING(30),
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 30],
      is: /^[a-zA-Z0-9_]+$/
    },
    set(value) {
      this.setDataValue('username', value.trim());
    }
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      len: [8, 255]
    }
  },
  displayName: {
    type: DataTypes.STRING(50),
    allowNull: true,
    validate: {
      len: [0, 50]
    }
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: [0, 500]
    }
  },
  interests: {
    type: DataTypes.ARRAY(DataTypes.STRING(30)),
    defaultValue: [],
    allowNull: true
  },
  profilePicture: {
    type: DataTypes.STRING(255),
    defaultValue: 'default-avatar.png'
  }
}, {
  tableName: 'users',
  indexes: [
    { unique: true, fields: ['email'] },
    { unique: true, fields: ['username'] }
  ],
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(12);
        user.password = await bcrypt.hash(user.password, salt);
      }
      if (!user.displayName) {
        user.displayName = user.username;
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(12);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

// Instance method to compare password
User.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to get public profile
User.prototype.getPublicProfile = function() {
  return {
    id: this.id,
    email: this.email,
    username: this.username,
    displayName: this.displayName,
    bio: this.bio,
    interests: this.interests,
    profilePicture: this.profilePicture,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};
const Circle = require('./Circle');
const CircleMember = require('./CircleMember');
const CirclePost = require('./CirclePost');
const MoodLog = require('./MoodLog');
const Journal = require('./Journal');

// Define associations
User.hasMany(Circle, { foreignKey: 'createdBy', as: 'createdCircles' });
User.hasMany(CircleMember, { foreignKey: 'userId', as: 'circleMemberships' });
User.hasMany(CirclePost, { foreignKey: 'userId', as: 'posts' });
User.hasMany(MoodLog, { foreignKey: 'userId', as: 'moodLogs' });
User.hasMany(Journal, { foreignKey: 'userId', as: 'journals' });

Circle.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
Circle.hasMany(CircleMember, { foreignKey: 'circleId', as: 'members' });
Circle.hasMany(CirclePost, { foreignKey: 'circleId', as: 'posts' });

CircleMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });
CircleMember.belongsTo(Circle, { foreignKey: 'circleId', as: 'circle' });

CirclePost.belongsTo(User, { foreignKey: 'userId', as: 'author' });
CirclePost.belongsTo(Circle, { foreignKey: 'circleId', as: 'circle' });

MoodLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Journal.belongsTo(User, { foreignKey: 'userId', as: 'user' });

const PostComment = require('./PostComment');
User.hasMany(PostComment, { foreignKey: 'userId', as: 'comments' });
PostComment.belongsTo(User, { foreignKey: 'userId', as: 'author' });

const CirclePost = require('./CirclePost');
CirclePost.hasMany(PostComment, { foreignKey: 'postId', as: 'comments' });
PostComment.belongsTo(CirclePost, { foreignKey: 'postId', as: 'post' });


module.exports = User;

