const mongoose = require("mongoose");

const questSchema = new mongoose.Schema({
    description: String,
    type: { type: String, enum: ["study", "game", "video"] },
    xp: Number,
    badge: String,
    reward: String
}, { timestamps: true });

module.exports = mongoose.model("Quest", questSchema);