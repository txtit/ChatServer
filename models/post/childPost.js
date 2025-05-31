const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
var childPostSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        required: true,
    },
    shortCode: {
        type: String,
        required: true,
    },
    caption: {
        type: String,
    },
    hashtags: {
        type: Array,
    },
    mentions: {
        type: Array,
    },
    url: {
        type: String,
        required: true,
    },
    commentsCount: {
        type: Number,
    },
    comments: {
        type: Array,
    },
    dimensionsHeight: {
        type: Number,
        required: true,
    },
    dimensionsWidth: {
        type: Number,
        required: true,
    },
    displayUrl: {
        type: String,
        required: true,
    },
    images: {
        type: Array,
    },
    alt: {
        type: String,
    },
    likesCount: {
        type: Number,
    },
    timestamp: {
        type: String,
    },
    childPosts: {
        type: Array,
    },
    ownerId: {
        type: String,
    },
});

//Export the model
module.exports = mongoose.model('ChildPost', childPostSchema);