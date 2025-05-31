const mongoose = require("mongoose");

const rewardSchema = new mongoose.Schema({
    name: String,
    type: { type: String, enum: ["avatar", "theme", "badge", "sticker"] },
    image: String,
    price: Number // điểm cần để mua
}, { timestamps: true });

module.exports = mongoose.model("Reward", rewardSchema);