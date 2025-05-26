// scripts/createMongoDBIndexes.js
const mongoose = require('mongoose');
require('dotenv').config();

async function createIndexes() {
  try {
    console.log('Starting index creation...');
    
    // कोणते URI वापरले जात आहेत हे तपासा
    const mongoUri = process.env.MONGODB_URI || process.env.mongodb_uri;
    console.log('Using MongoDB URI:', mongoUri ? 'URI is defined' : 'URI is NOT defined');
    
    // MongoDB शी कनेक्ट करा
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB connected successfully');
    
    // User कलेक्शनवर इंडेक्स तयार करा
    const db = mongoose.connection.db;
    await db.collection('users').createIndex({ trophy_count: -1 });
    console.log('Index created on users collection (trophy_count: -1)');
    
    console.log('All indexes created successfully');
    await mongoose.disconnect();
    console.log('MongoDB disconnected');
  } catch (error) {
    console.error('Error creating indexes:', error);
    process.exit(1); // एरर आल्यास प्रोसेस बंद करा
  }
}

// फंक्शन चालवा
createIndexes();