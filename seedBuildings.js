const mongoose = require('mongoose');
const Building = require('./models/building');

// Connect to MongoDB
mongoose.connect('mongodb+srv://satyam:game_project@cluster0.jr08s.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('Error connecting to MongoDB:', err));

// Buildings data as specified
const buildings = [
    {
        buildingId: "Outpost",
        name: "Outpost",
        gold_coins: 1800, // goldPerHour
        size: { x: 2, y: 2 },
        constructionTime: 5  // 5 minutes
    },
    {
        buildingId: "Hero's Tomb",
        name: "Hero's Tomb", 
        gold_coins: 1200, // goldPerHour
        size: { x: 3, y: 2 },
        constructionTime: 30  // 30 minutes
    },
    {
        buildingId: "Bell Towers",
        name: "Bell Towers", 
        gold_coins: 1800, // goldPerHour
        size: { x: 3, y: 3 },
        constructionTime: 120  // 120 minutes (2 hours)
    },
    {
        buildingId: "Warg Pen",
        name: "Warg Pen", 
        gold_coins: 1200, // goldPerHour
        size: { x: 3, y: 2 },
        constructionTime: 120  // 120 minutes (2 hours)
    }
];

async function seedBuildings() {
    try {
        console.log("Starting to add buildings...");
        
        // Delete existing buildings with these IDs first
        for (const building of buildings) {
            await Building.deleteOne({ buildingId: building.buildingId });
        }
        
        // Add new buildings
        const result = await Building.insertMany(buildings);
        
        console.log(`Added ${result.length} buildings successfully:`);
        result.forEach(building => {
            console.log(`- ${building.name} (${building.size.x}x${building.size.y}), Construction: ${building.constructionTime} mins, Gold/hour: ${building.gold_coins}`);
        });
        
        mongoose.connection.close();
        console.log("Database connection closed");
    } catch (error) {
        console.error('Error seeding buildings:', error);
        mongoose.connection.close();
    }
}

seedBuildings(); 