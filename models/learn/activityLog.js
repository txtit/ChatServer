const mongoose = require("mongoose");

// Model lưu trữ lịch sử hoạt động chi tiết của user
const ActivityLogSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    activityType: { 
        type: String, 
        enum: [
            'lesson_start', 
            'lesson_complete', 
            'lesson_pause',
            'test', 
            'practice', 
            'game', 
            'homework',
            'quiz_complete',
            'exercise_complete',
            'achievement_earned',
            'goal_set',
            'goal_achieved',
            'streak_milestone'
        ], 
        required: true 
    },
    lessonId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Lesson' 
    },
    subject: { 
        type: String, 
        required: true 
    },
    subjectName: {
        type: String,
        required: true // "Toán học", "Tiếng Anh"
    },
    score: { 
        type: Number, 
        min: 0, 
        max: 10 
    },
    maxScore: {
        type: Number,
        default: 10
    },
    duration: { 
        type: Number 
    }, // milliseconds
    description: { 
        type: String,
        required: true
    }, // "Hoàn thành bài kiểm tra Toán"
    
    // Metadata chi tiết
    metadata: {
        slideCount: Number,
        exerciseCount: Number,
        correctAnswers: Number,
        totalAnswers: Number,
        difficulty: String,
        timeSpent: Number,
        attempts: Number,
        perfectScore: Boolean,
        improvementFromLast: Number, // % cải thiện so với lần trước
        streakCount: Number,
        achievementId: String
    },
    
    // Thông tin phiên học
    sessionId: String,
    deviceInfo: {
        userAgent: String,
        platform: String,
        browser: String
    },
    
    // Trạng thái
    status: {
        type: String,
        enum: ['completed', 'in_progress', 'failed', 'skipped'],
        default: 'completed'
    }
}, { 
    timestamps: true,
    indexes: [
        { userId: 1, createdAt: -1 }, // Recent activities
        { userId: 1, subject: 1, createdAt: -1 }, // Activities by subject
        { userId: 1, activityType: 1, createdAt: -1 }, // Activities by type
        { lessonId: 1, userId: 1 }, // Lesson-specific activities
        { createdAt: -1 } // Global recent activities
    ]
});

// Virtual để tính percentage score
ActivityLogSchema.virtual('percentage').get(function() {
    if (!this.score || !this.maxScore) return 0;
    return Math.round((this.score / this.maxScore) * 100);
});

// Method để tạo description tự động
ActivityLogSchema.methods.generateDescription = function() {
    const User = mongoose.model('User');
    
    switch (this.activityType) {
        case 'lesson_complete':
            return `Hoàn thành bài học ${this.subjectName}`;
        case 'test':
            return `Bài kiểm tra ${this.subjectName}`;
        case 'practice':
            return `Luyện tập ${this.subjectName}`;
        case 'game':
            return `Chơi game ${this.subjectName}`;
        case 'homework':
            return `Bài tập về nhà ${this.subjectName}`;
        case 'quiz_complete':
            return `Trả lời câu hỏi ${this.subjectName}`;
        case 'achievement_earned':
            return `Đạt thành tích mới`;
        case 'streak_milestone':
            return `Học đều đặn ${this.metadata.streakCount} ngày`;
        default:
            return `Hoạt động ${this.subjectName}`;
    }
};

// Pre-save middleware để tự động tạo description
ActivityLogSchema.pre('save', function(next) {
    if (!this.description) {
        this.description = this.generateDescription();
    }
    next();
});

// Static method để log activity
ActivityLogSchema.statics.logActivity = async function(data) {
    // Validate required fields
    if (!data.userId || !data.activityType || !data.subject) {
        throw new Error('Missing required fields for activity log');
    }
    
    // Set default subjectName if not provided
    if (!data.subjectName) {
        const subjectNames = {
            'math': 'Toán học',
            'english': 'Tiếng Anh',
            'science': 'Khoa học',
            'vietnamese': 'Tiếng Việt',
            'history': 'Lịch sử',
            'geography': 'Địa lý'
        };
        data.subjectName = subjectNames[data.subject] || data.subject;
    }
    
    return this.create(data);
};

// Static method để lấy recent activities
ActivityLogSchema.statics.getRecentActivities = function(userId, limit = 20, offset = 0) {
    return this.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(offset)
        .populate('lessonId', 'title')
        .populate('userId', 'firstName lastName');
};

// Static method để lấy activities theo subject
ActivityLogSchema.statics.getActivitiesBySubject = function(userId, subject, limit = 10) {
    return this.find({ userId, subject })
        .sort({ createdAt: -1 })
        .limit(limit);
};

// Static method để thống kê activities theo ngày
ActivityLogSchema.statics.getDailyStats = async function(userId, days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const pipeline = [
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId),
                createdAt: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: {
                    date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    subject: "$subject"
                },
                count: { $sum: 1 },
                totalScore: { $sum: "$score" },
                averageScore: { $avg: "$score" },
                totalDuration: { $sum: "$duration" }
            }
        },
        { $sort: { "_id.date": -1 } }
    ];
    
    return this.aggregate(pipeline);
};

// Static method để tính streak hiện tại
ActivityLogSchema.statics.getCurrentStreak = async function(userId) {
    const activities = await this.find({
        userId,
        activityType: { $in: ['lesson_complete', 'test', 'practice', 'homework'] }
    }).sort({ createdAt: -1 });
    
    if (activities.length === 0) return 0;
    
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(23, 59, 59, 999); // End of current day
    
    const activitiesByDate = {};
    activities.forEach(activity => {
        const dateStr = activity.createdAt.toISOString().split('T')[0];
        activitiesByDate[dateStr] = true;
    });
    
    // Check consecutive days backwards from today
    for (let i = 0; i < 365; i++) {
        const checkDate = new Date(currentDate);
        checkDate.setDate(checkDate.getDate() - i);
        const dateStr = checkDate.toISOString().split('T')[0];
        
        if (activitiesByDate[dateStr]) {
            streak++;
        } else if (i > 0) { // Allow today to be empty (might not have studied yet)
            break;
        }
    }
    
    return streak;
};

module.exports = mongoose.model("ActivityLog", ActivityLogSchema);
