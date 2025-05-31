const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema({
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: "Lesson" },
    questions: [{
        question: String,
        options: [String],
        answer: Number, // index của đáp án đúng
        explanation: String
    }]
}, { timestamps: true });

module.exports = mongoose.model("Quiz", quizSchema);