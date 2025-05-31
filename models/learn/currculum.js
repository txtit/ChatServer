const mongoose = require("mongoose");

// Models/curriculum.js - Mô hình giáo án
const curriculumSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: String,
    subject: String,
    grade: Number,
    content: String,
    fileUrl: String, // URL Cloudinary
    fileName: String,
    fileType: String,
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Curriculum", curriculumSchema);