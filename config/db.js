const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // console.log('Environment in db.js:');
        // console.log('MONGODB_URI:', process.env.MONGODB_URI);
        
        if (!process.env.MONGODB_URI) {
            console.error('MONGODB_URI is undefined. Please check your .env file and make sure it exists in the correct location.');
            throw new Error('MONGODB_URI is not defined in environment variables');
        }

        // console.log('Attempting to connect to MongoDB with URI:', process.env.MONGODB_URI);
        
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 45000,
            maxPoolSize: 100,
            connectTimeoutMS: 30000,
            heartbeatFrequencyMS: 10000,
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('MongoDB Connection Error:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    }
};

module.exports = connectDB; 