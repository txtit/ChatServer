const mongoose = require("mongoose");

// Models/learningPath.js - Mô hình lộ trình học
const learningPathSchema = new mongoose.Schema({
    curriculumId: { type: mongoose.Schema.Types.ObjectId, ref: 'Curriculum' },
    title: String,
    lessons: [{
        title: String,
        description: String,
        content: String,
        duration: Number, // Thời gian học (phút)
        day: Number, // Ngày thứ mấy trong lộ trình
        session: String, // Buổi (sáng/chiều)
        resources: [String], // Tài liệu bổ sung
        quiz: [{
            question: String,
            options: [String],
            answer: Number
        }]
    }],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("LearningPath", learningPathSchema);