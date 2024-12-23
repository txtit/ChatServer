const mongoose = require('mongoose');

const OneToOneMessageSchema = new mongoose.Schema({
    participants: [
        {
            type: mongoose.Schema.ObjectId,
            ref: "User",
        },
    ],
    delettion: [
        {
            from: {
                type: mongoose.Schema.ObjectId,
                ref: "User",
            },
            deletedAt: {
                type: Date,
                default: Date.now(),
            },
        },

    ],
    messages: [{
        to: {
            type: mongoose.Schema.ObjectId,
            ref: "User",
        },
        from: {
            type: mongoose.Schema.ObjectId,
            ref: "User",
        },
        type: {
            type: String,
            enum: ["Text", "Media", "Document", "Link"],
        },
        created_at: {
            type: Date,
            default: Date.now(),
        },
        updated_at: {
            type: Date,
            default: Date.now(),
        },
        text: {
            type: String,
        },
        file: {
            type: String,
        },
    },
    ],

});

const OneToOneMessage = new mongoose.model("OneToOneMessage", OneToOneMessageSchema);
module.exports = OneToOneMessage;