require('dotenv').config();
const app = require('./src/app');
const { sequelize } = require('./src/config/database');
const vectorStore = require('./src/config/vectorStore');
const journalAnalysis = require('./src/services/journalAnalysis');

const PORT = process.env.PORT || 3001;
const shouldAlterSchema = process.env.DB_SYNC_ALTER === 'true';

// Test database connection and start server
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log(' Database connection established successfully');
    
    // Safe sync creates missing tables without destructive production schema changes.
    await sequelize.sync({ alter: shouldAlterSchema });
    console.log(` Database synchronized (alter=${shouldAlterSchema})`);

    // pgvector is optional: if the extension is missing we log it and keep running without semantic search
    await vectorStore.init();
    
    app.listen(PORT, () => {
      console.log(` Server running on port ${PORT}`);
      console.log(` Environment: ${process.env.NODE_ENV}`);
      journalAnalysis.startWorker(); // retries entries the ML service couldn't score earlier
    });
  } catch (error) {
    console.error(' Unable to start server:', error);
    process.exit(1);
  }
};

startServer();

const shutdown = async () => {
  console.log('Shutting down...');
  journalAnalysis.stopWorker();
  await sequelize.close(); 
  process.exit(0);
};
process.on('SIGTERM', shutdown); 
process.on('SIGINT', shutdown);
