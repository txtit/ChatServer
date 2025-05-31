const mongoose = require("mongoose");

// Models/progress.js - Mô hình theo dõi tiến độ
const progressSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    learningPathId: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningPath' },
    completedLessons: [{ type: Number }], // Index các bài học đã hoàn thành
    quizResults: [{
        lessonIndex: Number,
        score: Number,
        answers: [Number],
        completedAt: Date
    }],
    overallProgress: { type: Number, default: 0 }, // % hoàn thành
    lastActivity: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Progress", progressSchema);