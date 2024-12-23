// !mdbgum
const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
var postSchema = new mongoose.Schema({
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
    unique: true,
  },
  caption: {
    type: String,
    require: true
  },
  hashtags: {
    type: Array,
  },
  mentions: {
    type: Array,
  },
  url: {
    type: String,
    require: true
  },
  commentsCount: {
    type: Number,
    require: true
  },
  comments: [{
    id: { type: String, ref: 'Comment' }
  }],
  dimensionsHeight: {
    type: Number,
    require: true
  },
  dimensionsWidth: {
    type: Number,
    require: true
  },
  displayUrl: {
    type: String,
  },
  images: {
    type: Array,
  },
  videoUrl: {
    type: String,
  },
  alt: {
    type: String,
  },
  likesCount: {
    type: Number,
  },
  timestamp: {
    type: String,
    require: true
  },
  videoViewCount: {
    type: Number,
  },
  videoPlayCount: {
    type: Number,
  },
  childPosts: [{
    id: { type: String, ref: 'ChildPost' }
  }],
  ownerFullName: {
    type: String,
  },
  ownerUsername: {
    type: String,
  },
  ownerId: {
    type: String,
  },
  productType: {
    type: String,
  },
  isSponsored: {
    type: Boolean,
    default: false
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  musicInfo: {
    artist_name: { type: String },
    song_name: { type: String },
    uses_original_audio: { type: Boolean },
    should_mute_audio: { type: Boolean },
    should_mute_audio_reason: { type: String },
    audio_id: { type: String },
  },
  arrayUserLike: [{
    type: mongoose.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

//Export the model
module.exports = mongoose.model('Post', postSchema);