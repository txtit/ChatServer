const mongoose = require('mongoose'); // Erase if already required

// Declare the Schema of the Mongo model
var commentSchema = new mongoose.Schema({
  // id: {
  //   type: String,
  //   required: true,
  // },
  text: {
    type: String,
    required: true,
  },
  ownerUsername: {
    type: String,
    require: true
  },
  ownerProfilePicUrl: {
    type: String,
    required: true,
  },
  // timestamp: {
  //   type: String,
  //   required: true,
  // },
  repliesCount: {
    type: Number,
    required: true,
  },
  replies: [{
    id: { type: String, ref: 'Replie' }
  }],
  likesCount: {
    type: Number,
    required: true,
  },
  ownerId: {
    type: String,
    ref: 'User'
  },
}, {
  timestamps: true,
});

//Export the model
module.exports = mongoose.model('Comment', commentSchema);