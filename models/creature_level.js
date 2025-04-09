const mongoose = require("mongoose");

const creatureLevelSchema = new mongoose.Schema({
  creature_Id: {
    type: String,
    required: true,
  },
  level: {
    type: Number,
    required: true,
    default: 1,
  },
  attack: {
    type: Number,
    required: true,
  },
  health: {
    type: Number,
    required: true,
  },
  speed: {
    type: Number,
    required: true,
    default: 100,
  },
  armor: {
    type: Number,
    required: true,
    default: 50,
  },
  critical_health: {
    type: Number,
    required: true,
    default: 50,
  },
  critical_damage: {
    type: Number,
    required: true,
    default: 20,
  },
  gold_coins: {
    type: Number,
    required: true,
    default: 100,
  },
});

// Create a compound index to ensure each creature has unique level numbers
creatureLevelSchema.index({ creature_Id: 1, level: 1 }, { unique: true });

module.exports = mongoose.model("CreatureLevel", creatureLevelSchema);
