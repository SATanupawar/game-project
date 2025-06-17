/**
 * Script to initialize ticket categories and subcategories
 */
const mongoose = require('mongoose');
require('dotenv').config();

// Define ticket category schema
const ticketCategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    icon: {
        type: String,
        required: true
    },
    subcategories: [{
        name: {
            type: String,
            required: true
        },
        description: {
            type: String
        }
    }],
    active: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Create model
const TicketCategory = mongoose.model('TicketCategory', ticketCategorySchema);

// Predefined categories and subcategories
const ticketCategories = [
    {
        name: 'Account Support',
        icon: '🧾',
        subcategories: [
            {
                name: 'I\'m receiving a login error',
                description: 'Issues with logging into your account'
            }
        ]
    },
    {
        name: 'Purchases and Billing Issues',
        icon: '💳',
        subcategories: [
            {
                name: 'I didn\'t receive my gems',
                description: 'Issues with purchased gems not appearing in your account'
            },
            {
                name: 'Request a refund',
                description: 'Request a refund for a purchase'
            },
            {
                name: 'There was a billing error',
                description: 'Issues with billing or payment processing'
            },
            {
                name: 'I want to change the region of my store or payment currency',
                description: 'Change your store region or payment currency'
            },
            {
                name: 'My payment was declined',
                description: 'Issues with declined payments'
            }
        ]
    },
    {
        name: 'Technical Issues',
        icon: '🐛',
        subcategories: [
            {
                name: 'Game won\'t launch or crashes',
                description: 'Issues with game launching or crashes'
            },
            {
                name: 'I\'m experiencing lag or high ping',
                description: 'Performance issues like lag or high ping'
            },
            {
                name: 'Can\'t download or update the client',
                description: 'Issues with downloading or updating the game client'
            },
            {
                name: 'My game is freezing or has graphical glitches',
                description: 'Issues with game freezing or graphical glitches'
            }
        ]
    },
    {
        name: 'In-Game Issues',
        icon: '🎮',
        subcategories: [
            {
                name: 'Item or character missing',
                description: 'Missing items or characters from your inventory'
            },
            {
                name: 'Progress lost after disconnect',
                description: 'Lost progress after disconnection'
            },
            {
                name: 'Wrong item purchased or used',
                description: 'Issues with purchasing or using the wrong item'
            },
            {
                name: 'Can\'t complete a quest or event due to a bug',
                description: 'Issues with completing quests or events due to bugs'
            },
            {
                name: 'Achievement not tracking',
                description: 'Issues with achievement tracking'
            }
        ]
    },
    {
        name: 'Rules Violations and Reporting Players',
        icon: '⚖️',
        subcategories: [
            {
                name: 'Report a bot, spammer, or cheater',
                description: 'Report players using bots, spamming, or cheating'
            },
            {
                name: 'Report offensive name',
                description: 'Report players with offensive names'
            },
            {
                name: 'Report hacking and exploiting',
                description: 'Report players hacking or exploiting the game'
            },
            {
                name: 'Appeal a suspension or ban',
                description: 'Appeal a suspension or ban on your account'
            }
        ]
    },
    {
        name: 'Security Concerns',
        icon: '🔒',
        subcategories: [
            {
                name: 'Account Hacked',
                description: 'Report a hacked account'
            },
            {
                name: 'Game Exploit',
                description: 'Report a game exploit or vulnerability'
            }
        ]
    }
];

// Connect to MongoDB
mongoose.connect(process.env.mongodb_uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(async () => {
    console.log('Connected to MongoDB');
    
    try {
        // Clear existing categories
        await TicketCategory.deleteMany({});
        console.log('Cleared existing ticket categories');
        
        // Insert new categories
        const result = await TicketCategory.insertMany(ticketCategories);
        console.log(`Inserted ${result.length} ticket categories`);
        
        // Log the inserted categories
        console.log('Ticket categories initialized:');
        result.forEach(category => {
            console.log(`- ${category.icon} ${category.name} (${category.subcategories.length} subcategories)`);
        });
        
        console.log('Ticket categories initialization complete');
    } catch (error) {
        console.error('Error initializing ticket categories:', error);
    } finally {
        // Close the connection
        mongoose.connection.close();
        console.log('MongoDB connection closed');
    }
})
.catch(error => {
    console.error('MongoDB connection error:', error);
}); 