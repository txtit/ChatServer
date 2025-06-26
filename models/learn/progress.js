const mongoose = require("mongoose");

// Models/progress.js - Mô hình theo dõi tiến độ chi tiết cho từng bài học
const ProgressSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Slide', required: true }, // ID của bài học (slideshow)
    lessonTitle: { type: String }, // Tiêu đề bài học để dễ debug
    
    // Thông tin slide
    totalSlides: { type: Number, required: true, default: 0 }, // Tổng số slide trong bài học
    currentSlideIndex: { type: Number, default: 0 }, // Vị trí slide hiện tại (0-based index)
    lastSlideId: { type: String }, // ID của slide cuối cùng đã xem
    completedSlides: [Number], // Mảng index của các slide đã hoàn thành
    
    // Thông tin tiến độ
    percentage: { type: Number, default: 0, min: 0, max: 100 }, // Phần trăm hoàn thành (0-100)
    isCompleted: { type: Boolean, default: false }, // Đã hoàn thành bài học chưa
    completedAt: { type: Date }, // Thời điểm hoàn thành bài học
    
    // Thông tin bài tập và quiz
    completedExercises: [{
        exerciseId: String,
        score: Number,
        attempts: { type: Number, default: 1 },
        completedAt: { type: Date, default: Date.now }
    }],
    completedQuizzes: [{
        quizId: String,
        score: Number,
        answers: [Number], // Mảng đáp án đã chọn
        attempts: { type: Number, default: 1 },
        completedAt: { type: Date, default: Date.now }
    }],
    
    // Điểm số tổng thể
    overallScore: { type: Number, default: null, min: 0, max: 100 }, // Điểm trung bình của bài học
    
    // Thời gian học tập
    startTime: { type: Date }, // Lần đầu tiên bắt đầu học bài này
    lastAccessTime: { type: Date, default: Date.now }, // Lần cuối cùng truy cập bài học
    totalTimeSpent: { type: Number, default: 0 }, // Tổng thời gian học (milliseconds)
    
    // Thông tin phiên học hiện tại
    sessionStartTime: { type: Date }, // Thời điểm bắt đầu phiên học hiện tại
    
    // Thống kê
    viewCount: { type: Number, default: 0 }, // Số lần xem bài học
    attempts: { type: Number, default: 1 }, // Số lần thử học bài này
    
    // Metadata
    deviceInfo: {
        userAgent: String,
        platform: String,
        screenResolution: String
    }
}, { 
    timestamps: true,
    // Tạo index compound để query nhanh hơn
    indexes: [
        { userId: 1, lessonId: 1 }, // Index chính để tìm tiến độ của user cho lesson cụ thể
        { userId: 1, lastAccessTime: -1 }, // Để tìm các bài học gần đây của user
        { lessonId: 1, isCompleted: 1 }, // Để thống kê completion rate của lesson
        { userId: 1, isCompleted: 1, completedAt: -1 } // Để tìm các bài học đã hoàn thành
    ]
});

// Tạo unique index để đảm bảo mỗi user chỉ có 1 progress record cho mỗi lesson
ProgressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });

// Virtual để tính thời gian học trong phiên hiện tại
ProgressSchema.virtual('currentSessionTime').get(function() {
    if (this.sessionStartTime) {
        return Date.now() - this.sessionStartTime.getTime();
    }
    return 0;
});

// Method để cập nhật tiến độ
ProgressSchema.methods.updateProgress = function(slideIndex, totalSlides) {
    this.currentSlideIndex = slideIndex;
    this.totalSlides = totalSlides || this.totalSlides;
    
    if (this.totalSlides > 0) {
        this.percentage = Math.round(((slideIndex + 1) / this.totalSlides) * 100);
        this.isCompleted = this.percentage >= 100;
        
        if (this.isCompleted && !this.completedAt) {
            this.completedAt = new Date();
        }
    }
    
    this.lastAccessTime = new Date();
    
    // Thêm slide vào danh sách đã xem nếu chưa có
    if (!this.completedSlides.includes(slideIndex)) {
        this.completedSlides.push(slideIndex);
    }
};

// Method để bắt đầu phiên học mới
ProgressSchema.methods.startSession = function() {
    this.sessionStartTime = new Date();
    this.viewCount += 1;
    
    if (!this.startTime) {
        this.startTime = new Date();
    }
};

// Method để kết thúc phiên học
ProgressSchema.methods.endSession = function() {
    if (this.sessionStartTime) {
        const sessionTime = Date.now() - this.sessionStartTime.getTime();
        this.totalTimeSpent += sessionTime;
        this.sessionStartTime = null;
    }
    this.lastAccessTime = new Date();
};

module.exports = mongoose.model("Progress", ProgressSchema);