const mongoose = require("mongoose");

const gameSchema = new mongoose.Schema({
    name: String,
    description: String,
    type: String,
    reward: String,
    xp: Number
}, { timestamps: true });

module.exports = mongoose.model("Game", gameSchema);