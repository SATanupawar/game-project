const mongoose = require('mongoose');

const creatureSlotSchema = new mongoose.Schema({
    slot_number: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
        unique: true
    },
    is_elite: {
        type: Boolean,
        required: true,
        default: false
    },
    gold_cost: {
        type: Number,
        required: true,
        default: 0
    },
    description: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Create slots if they don't exist
creatureSlotSchema.statics.initializeSlots = async function() {
    try {
        const slots = [
            { slot_number: 1, is_elite: false, gold_cost: 0, description: 'Basic slot for common creatures' },
            { slot_number: 2, is_elite: false, gold_cost: 200, description: 'Basic slot for common creatures' },
            { slot_number: 3, is_elite: true, gold_cost: 0, description: 'Elite slot for special creatures' },
            { slot_number: 4, is_elite: true, gold_cost: 0, description: 'Elite slot for special creatures' },
            { slot_number: 5, is_elite: true, gold_cost: 0, description: 'Elite slot for special creatures' }
        ];
        
        // Use bulkWrite with updateOne operations and upsert option
        const bulkOps = slots.map(slot => ({
            updateOne: {
                filter: { slot_number: slot.slot_number },
                update: { $set: slot },
                upsert: true
            }
        }));
        
        await this.bulkWrite(bulkOps);
        console.log('Creature slots initialized or updated successfully');
    } catch (error) {
        console.error('Error initializing creature slots:', error);
        throw error;
    }
};

module.exports = mongoose.model('CreatureSlot', creatureSlotSchema); 