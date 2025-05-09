const mongoose = require('mongoose');

const ArcaneEnergyBuildingSchema = new mongoose.Schema({
    level: {
        type: Number,
        required: true,
        min: 1,
        max: 8
    },
    production_time_minutes: {
        type: Number,
        required: true
    },
    arcane_energy_production: {
        type: Number,
        required: true
    },
    activation_gold_cost: {
        type: Number,
        required: true
    },
    upgrade_cost: {
        type: Number,
        required: true
    }
});

// Create a model from the schema
const ArcaneEnergyBuilding = mongoose.model('ArcaneEnergyBuilding', ArcaneEnergyBuildingSchema);

module.exports = ArcaneEnergyBuilding; 