const mongoose = require('mongoose');

// Define a schema for the stats at each level
const levelStatsSchema = new mongoose.Schema({
    level: {
        type: Number,
        required: true,
        min: 1,
        max: 40
    },
    attack: {
        type: Number,
        required: true
    },
    health: {
        type: Number,
        required: true
    },
    speed: {
        type: Number,
        default: 100
    },
    armor: {
        type: Number,
        default: 50
    },
    critical_damage_percentage: {
        type: Number,
        default: 50
    },
    critical_damage: {
        type: Number,
        default: 20
    },
    gold: {
        type: Number,
        default: 0
    },
    arcane_energy: {
        type: Number,
        default: 0
    }
}, { _id: false });

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
        required: true,
        enum: ['common', 'rare', 'epic', 'legendary', 'elite' ]
    },
    gold_coins: {
        type: Number,
        required: true
    },
    arcane_energy: {
        type: Number,
        default: 0
    },
    description: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    // Current level of the creature
    level: {
        type: Number,
        required: true,
        default: 1,
        min: 1,
        max: 40
    },
    // Array of stats for each level (1-40)
    level_stats: [levelStatsSchema],
    // Base stats as a reference
    base_attack: {
        type: Number,
        required: true
    },
    base_health: {
        type: Number,
        required: true
    },
    // Default stats for the creature
    speed: {
        type: Number,
        default: 100
    },
    armor: {
        type: Number,
        default: 50
    },
    critical_damage_percentage: {
        type: Number,
        default: 50
    },
    critical_damage: {
        type: Number,
        default: 20
    },
    unlock_time: {
        type: Number,
        default: 10
    },
    interval_time: {
        type: Number,
        default: 0
    },
    // Additional fields for creature metadata
    unlock_level: {
        type: Number,
        default: 1
    },
    creature_type: {
        type: String,
        enum: ['Draconic', 'Beast', 'Fractal'],
        required: true
    },
    anima_cost: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Method to get current stats at the current level
creatureSchema.methods.getCurrentStats = function() {
    // Get stats for the current level from the level_stats array
    const statsForLevel = this.level_stats.find(stat => stat.level === this.level);
    
    if (statsForLevel) {
        return {
            level: this.level,
            attack: statsForLevel.attack,
            health: statsForLevel.health,
            speed: statsForLevel.speed || this.speed,
            armor: statsForLevel.armor || this.armor,
            critical_damage_percentage: statsForLevel.critical_damage_percentage || this.critical_damage_percentage,
            critical_damage: statsForLevel.critical_damage || this.critical_damage,
            gold: statsForLevel.gold || this.gold_coins,
            arcane_energy: statsForLevel.arcane_energy || this.arcane_energy
        };
    }
    
    // Fallback to base stats if level stats not found
    return {
        level: this.level,
        attack: this.base_attack,
        health: this.base_health,
        speed: this.speed,
        armor: this.armor,
        critical_damage_percentage: this.critical_damage_percentage,
        critical_damage: this.critical_damage,
        gold: this.gold_coins,
        arcane_energy: this.arcane_energy
    };
};

// Method to set a specific level
creatureSchema.methods.setLevel = function(newLevel) {
    if (newLevel >= 1 && newLevel <= 40 && this.level_stats.some(stat => stat.level === newLevel)) {
        this.level = newLevel;
        return true;
    }
    return false;
};

// Generate level stats for all 40 levels
creatureSchema.methods.generateLevelStats = function(attackIncreasePercent = 3, healthIncreasePercent = 3) {
    this.level_stats = [];
    
    // Define base gold and arcane energy values based on creature type
    let baseGold = this.gold_coins;
    let baseArcaneEnergy = this.arcane_energy;
    
    // If not explicitly set, use default values based on creature type
    if (!baseArcaneEnergy) {
        switch(this.type.toLowerCase()) {
            case 'common':
                baseArcaneEnergy = 99;
                if (!baseGold) baseGold = 77;
                break;
            case 'rare':
                baseArcaneEnergy = 212;
                if (!baseGold) baseGold = 125;
                break;
            case 'epic':
                baseArcaneEnergy = 403;
                if (!baseGold) baseGold = 415;
                break;
            case 'legendary':
                baseArcaneEnergy = 612;
                if (!baseGold) baseGold = 1001;
                break;
            case 'elite':
                baseArcaneEnergy = 843;
                if (!baseGold) baseGold = 1503;
                break;
            default:
                baseArcaneEnergy = 99;
                if (!baseGold) baseGold = 77;
        }
    }
    
    for (let i = 1; i <= 40; i++) {
        // Calculate compounding increase based on percentages for attack and health
        // For level 1, we use base stats
        // For each subsequent level, we apply the percentage increase
        let currentAttack = this.base_attack;
        let currentHealth = this.base_health;
        
        // Apply compounding percentage increase for each level up to current level
        for (let level = 1; level < i; level++) {
            currentAttack += Math.round(currentAttack * (attackIncreasePercent / 100));
            currentHealth += Math.round(currentHealth * (healthIncreasePercent / 100));
        }
        
        // Calculate gold and arcane energy - doubles with each level
        // Level 1 uses base values
        let currentGold = baseGold;
        let currentArcaneEnergy = baseArcaneEnergy;
        
        if (i > 1) {
            // Double arcane energy but increase gold by 30% for each level above 1
            const arcaneMultiplier = Math.pow(2, i - 1);
            const goldMultiplier = Math.pow(1.3, i - 1); // 30% increase per level
            currentGold = Math.round(baseGold * goldMultiplier);
            currentArcaneEnergy = baseArcaneEnergy * arcaneMultiplier;
        }
        
        this.level_stats.push({
            level: i,
            attack: currentAttack,
            health: currentHealth,
            speed: this.speed,
            armor: this.armor,
            critical_damage_percentage: this.critical_damage_percentage,
            critical_damage: this.critical_damage,
            gold: currentGold,
            arcane_energy: currentArcaneEnergy
        });
    }
};

// Pre-save hook to generate level stats if not present
creatureSchema.pre('save', function(next) {
    if (this.isNew || this.isModified('base_attack') || this.isModified('base_health') || !this.level_stats || this.level_stats.length === 0) {
        // Generate stats for all 40 levels
        // Adjust attack and health increase percentages based on creature type
        let attackIncreasePercent = 3;
        let healthIncreasePercent = 3;
        
        switch(this.type) {
            case 'legendary':
                attackIncreasePercent = 4;
                healthIncreasePercent = 4;
                break;
            case 'elite':
                attackIncreasePercent = 5;
                healthIncreasePercent = 5;
                break;
            case 'epic':
                attackIncreasePercent = 4;
                healthIncreasePercent = 4;
                break;
            case 'rare':
                attackIncreasePercent = 3;
                healthIncreasePercent = 3;
                break;
            default: // common
                attackIncreasePercent = 3;
                healthIncreasePercent = 3;
        }
        
        this.generateLevelStats(attackIncreasePercent, healthIncreasePercent);
    }
    next();
});

module.exports = mongoose.model('Creature', creatureSchema);    
