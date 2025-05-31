const mongoose = require("mongoose");

const lessonSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String },
    content: { type: String }, // HTML hoặc text nội dung bài học
    subject: { type: String, required: true }, // Môn học
    grade: { type: Number, required: true }, // Lớp (1-9)
    source: { type: String }, // Nguồn dữ liệu
    sourceUrl: { type: String }, // Link gốc
    videoUrl: { type: String }, // Nếu có video
    thumbnail: { type: String }, // Hình thumbnail
    images: [{ type: String }], // Mảng URL hình ảnh 
    exercises: [{
        question: String,
        options: [String],
        answer: String,
        explanation: String
    }],
    level: { type: String, default: "Cơ bản" },
    tags: [String],
    viewCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("Lesson", lessonSchema);