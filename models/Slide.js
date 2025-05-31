const mongoose = require('mongoose');

const SlideSchema = new mongoose.Schema({
    curriculumId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Curriculum',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    content: {
        type: Object,
        required: true
    },
    created: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Slide', SlideSchema);