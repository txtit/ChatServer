const mongoose = require("mongoose");

const leaderboardSchema = new mongoose.Schema({
    type: { type: String, enum: ["weekly", "monthly", "class"] },
    users: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        xp: Number,
        badges: [String]
    }]
}, { timestamps: true });

module.exports = mongoose.model("Leaderboard", leaderboardSchema);