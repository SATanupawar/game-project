const mongoose = require('mongoose');

const creatureSchema = new mongoose.Schema({
    creature_Id: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true
    },
    gold_coins: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    level: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CreatureLevel',
        required: true
    },
    levelNumber: {
        type: Number,
        required: true,
        default: 1
    }
}, {
    timestamps: true
});

// Add middleware to automatically populate level
creatureSchema.pre(['find', 'findOne'], function() {
    this.populate('level');
});

// Update levelNumber when level changes
creatureSchema.pre('save', async function(next) {
    if (this.isModified('level')) {
        const CreatureLevel = mongoose.model('CreatureLevel');
        const levelDoc = await CreatureLevel.findById(this.level);
        if (levelDoc) {
            this.levelNumber = levelDoc.level;
        }
    }
    next();
});

// Virtual for formatted level info
creatureSchema.virtual('levelInfo').get(function() {
    if (this.level) {
        return {
            number: this.level.level,
            id: this.level._id,
           
        };
    }
    return null;
});

module.exports = mongoose.model('Creature', creatureSchema);    
