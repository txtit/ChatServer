const mongoose = require("mongoose");

// Model lưu trữ điểm số chi tiết theo môn học
const ScoreSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    subject: { 
        type: String, 
        required: true,
        enum: ['math', 'english', 'science', 'vietnamese', 'history', 'geography', 'art', 'music', 'pe']
    },
    subjectName: {
        type: String,
        required: true // "Toán học", "Tiếng Anh", etc.
    },
    grade: { 
        type: Number, 
        required: true, 
        min: 1, 
        max: 12 
    },
    score: { 
        type: Number, 
        required: true, 
        min: 0, 
        max: 10 
    },
    maxScore: { 
        type: Number, 
        default: 10 
    },
    assessmentType: { 
        type: String, 
        enum: ['test', 'homework', 'practice', 'game', 'quiz', 'exercise', 'exam'], 
        required: true 
    },
    lessonId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Lesson' 
    },
    addedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        required: true
    }, // Parent ID hoặc system ID
    addedByType: {
        type: String,
        enum: ['parent', 'system', 'teacher'],
        default: 'system'
    },
    notes: { 
        type: String 
    },
    metadata: {
        duration: Number, // thời gian làm bài (milliseconds)
        attempts: { type: Number, default: 1 },
        difficulty: { type: String, enum: ['easy', 'medium', 'hard'] },
        tags: [String]
    }
}, { 
    timestamps: true,
    indexes: [
        { userId: 1, subject: 1, createdAt: -1 }, // Điểm theo môn, mới nhất trước
        { userId: 1, createdAt: -1 }, // Tất cả điểm của user
        { subject: 1, grade: 1, score: -1 }, // Ranking theo môn và lớp
        { userId: 1, subject: 1, assessmentType: 1 } // Điểm theo loại bài kiểm tra
    ]
});

// Virtual để tính phần trăm điểm
ScoreSchema.virtual('percentage').get(function() {
    return Math.round((this.score / this.maxScore) * 100);
});

// Method để xác định mức độ điểm
ScoreSchema.methods.getScoreLevel = function() {
    const percentage = this.percentage;
    if (percentage >= 90) return 'excellent';
    if (percentage >= 80) return 'good';
    if (percentage >= 70) return 'average';
    if (percentage >= 60) return 'below_average';
    return 'poor';
};

// Static method để tính điểm trung bình theo môn
ScoreSchema.statics.getAverageBySubject = async function(userId, subject, limit = 5) {
    const scores = await this.find({ userId, subject })
        .sort({ createdAt: -1 })
        .limit(limit);
    
    if (scores.length === 0) return 0;
    
    const total = scores.reduce((sum, score) => sum + score.score, 0);
    return Number((total / scores.length).toFixed(1));
};

// Static method để lấy xu hướng điểm số
ScoreSchema.statics.getScoreTrend = async function(userId, subject, limit = 5) {
    const scores = await this.find({ userId, subject })
        .sort({ createdAt: -1 })
        .limit(limit);
    
    if (scores.length < 2) return 'stable';
    
    const recent = scores[0].score;
    const previous = scores[1].score;
    
    if (recent > previous) return 'improving';
    if (recent < previous) return 'declining';
    return 'stable';
};

// Static method để lấy thống kê điểm theo user
ScoreSchema.statics.getUserScoreStats = async function(userId) {
    const pipeline = [
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        {
            $group: {
                _id: '$subject',
                averageScore: { $avg: '$score' },
                totalAssessments: { $sum: 1 },
                latestScore: { $last: '$score' },
                highestScore: { $max: '$score' },
                lowestScore: { $min: '$score' }
            }
        }
    ];
    
    return this.aggregate(pipeline);
};

module.exports = mongoose.model("Score", ScoreSchema);
