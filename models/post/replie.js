const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
var replieSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
    },
    text: {
        type: String,
        required: true,
    },
    ownerUsername: {
        type: String,
        required: true,
    },
    ownerProfilePicUrl: {
        type: String,
        required: true,
    },
    timestamp: {
        type: String,
        required: true,
    },
    repliesCount: {
        type: Number,
        required: true,
    },
    replies: {
        type: Array,
    },
    likesCount: {
        type: Number,
        required: true,
    },
    ownerId: {
        type: String, 
    },
});

//Export the model
module.exports = mongoose.model('Replie', replieSchema);