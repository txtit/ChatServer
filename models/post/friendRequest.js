const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema(
    {
        sender: {
            type: mongoose.Schema.ObjectId,
            ref: "User",
            required: true
        },
        recipient: {
            type: mongoose.Schema.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true // Tự động thêm createdAt và updatedAt
    }
);

const FriendRequest = mongoose.model("FriendRequest", requestSchema);
module.exports = FriendRequest;
