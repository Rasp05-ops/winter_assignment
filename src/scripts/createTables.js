const { sequelize } = require('../config/database');
const User = require('../models/User');
const Circle = require('../models/Circle');
const CircleMember = require('../models/CircleMember');
const CirclePost = require('../models/CirclePost');
const MoodLog = require('../models/MoodLog');
const Journal = require('../models/Journal');

const createTables = async () => {
  try {
    console.log('Creating database tables...');
    
    // Sync all models
    await sequelize.sync({ alter: true });
    
    console.log('✓ All tables created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('✗ Error creating tables:', error);
    process.exit(1);
  }
};

createTables();

