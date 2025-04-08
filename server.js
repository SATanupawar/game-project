const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const userRoutes = require('./routes/userRoute');
const buildingRoutes = require('./routes/buildingRoute');
require('dotenv').config();

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/buildings', buildingRoutes);

// Get a user with buildings and creatures
app.get('/api/users/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).populate({
            path: 'buildings',
            populate: { path: 'creature_id' }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Basic route
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to the Game Backend API' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 