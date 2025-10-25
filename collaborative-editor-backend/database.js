const mongoose = require('mongoose');

const connectDatabase = async () => {
  try {

    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/collaborative-editor';
    
    console.log('🔄 Connecting to MongoDB...');
    
    const conn = await mongoose.connect(mongoURI);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📁 Database Name: ${conn.connection.name}`);
    
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('🔌 MongoDB disconnected');
    });
    
    process.on('SIGINT', async () => {
      try {
        await mongoose.connection.close();
        console.log('🔒 MongoDB connection closed through app termination');
        process.exit(0);
      } catch (err) {
        console.error('❌ Error during graceful shutdown:', err);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('🔄 Retrying connection in 5 seconds...');
    
    setTimeout(connectDatabase, 5000);
  }
};

module.exports = connectDatabase;