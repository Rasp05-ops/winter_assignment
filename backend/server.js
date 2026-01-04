require('dotenv').config();
const app = require('./src/app');
const { sequelize } = require('./src/config/database');

const PORT = process.env.PORT || 3001;

// Test database connection and start server
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log(' Database connection established successfully');
    
    // Sync database (create tables if they don't exist)
    await sequelize.sync({ alter: true });
    console.log(' Database synchronized');
    
    app.listen(PORT, () => {
      console.log(` Server running on port ${PORT}`);
      console.log(` Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error(' Unable to start server:', error);
    process.exit(1);
  }
};

startServer();

const shutdown = async () => {
  console.log('Shutting down...');
  await sequelize.close(); 
  process.exit(0);
};
process.on('SIGTERM', shutdown); 
process.on('SIGINT', shutdown);
