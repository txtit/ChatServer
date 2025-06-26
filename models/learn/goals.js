const mongoose = require("mongoose");

// Model lưu trữ mục tiêu học tập
const GoalsSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    goalType: {
        type: String,
        enum: ['weekly', 'monthly', 'semester', 'annual'],
        default: 'weekly'
    },
    // Mục tiêu thời gian học
    studyTimeGoals: {
        daily: { type: Number, default: 30 }, // phút/ngày
        weekly: { type: Number, default: 180 }, // phút/tuần
        monthly: { type: Number, default: 720 } // phút/tháng
    },
    // Mục tiêu số bài học
    lessonGoals: {
        daily: { type: Number, default: 1 },
        weekly: { type: Number, default: 3 },
        monthly: { type: Number, default: 12 }
    },
    // Mục tiêu điểm số theo môn
    scoreGoals: {
        math: { type: Number, min: 0, max: 10, default: 8 },
        english: { type: Number, min: 0, max: 10, default: 8 },
        science: { type: Number, min: 0, max: 10, default: 8 },
        vietnamese: { type: Number, min: 0, max: 10, default: 8 }
    },
    // Mục tiêu streak (ngày học liên tiếp)
    streakGoal: { type: Number, default: 7 },
    
    // Thông tin ai đặt mục tiêu
    setBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        required: true
    }, // Parent ID hoặc User ID
    setByType: {
        type: String,
        enum: ['parent', 'self', 'teacher', 'system'],
        default: 'parent'
    },
    
    // Thời gian hiệu lực
    activeFrom: { 
        type: Date, 
        default: Date.now 
    },
    activeTo: { 
        type: Date 
    },
    
    // Trạng thái
    status: {
        type: String,
        enum: ['active', 'completed', 'paused', 'cancelled'],
        default: 'active'
    },
    
    // Ghi chú
    notes: String,
    
    // Thưởng khi đạt mục tiêu
    rewards: [{
        type: { type: String, enum: ['xp', 'badge', 'item', 'privilege'] },
        value: mongoose.Schema.Types.Mixed,
        description: String
    }]
}, { 
    timestamps: true,
    indexes: [
        { userId: 1, status: 1, activeFrom: -1 },
        { userId: 1, goalType: 1, status: 1 },
        { setBy: 1, createdAt: -1 }
    ]
});

// Method để kiểm tra mục tiêu có đang active không
GoalsSchema.methods.isActive = function() {
    const now = new Date();
    return this.status === 'active' && 
           this.activeFrom <= now && 
           (!this.activeTo || this.activeTo >= now);
};

// Method để tính % hoàn thành mục tiêu
GoalsSchema.methods.calculateProgress = async function(currentStats) {
    const progress = {};
    
    // Tính % hoàn thành study time
    if (this.goalType === 'weekly') {
        progress.studyTime = Math.min(100, (currentStats.weeklyStudyTime / this.studyTimeGoals.weekly) * 100);
        progress.lessons = Math.min(100, (currentStats.weeklyLessons / this.lessonGoals.weekly) * 100);
    } else if (this.goalType === 'daily') {
        progress.studyTime = Math.min(100, (currentStats.dailyStudyTime / this.studyTimeGoals.daily) * 100);
        progress.lessons = Math.min(100, (currentStats.dailyLessons / this.lessonGoals.daily) * 100);
    }
    
    // Tính % hoàn thành điểm số
    progress.scores = {};
    for (const [subject, targetScore] of Object.entries(this.scoreGoals)) {
        const currentScore = currentStats.averageScores[subject] || 0;
        progress.scores[subject] = Math.min(100, (currentScore / targetScore) * 100);
    }
    
    // Tính % hoàn thành streak
    progress.streak = Math.min(100, (currentStats.currentStreak / this.streakGoal) * 100);
    
    return progress;
};

// Static method để lấy mục tiêu hiện tại của user
GoalsSchema.statics.getCurrentGoals = function(userId) {
    return this.findOne({
        userId,
        status: 'active',
        activeFrom: { $lte: new Date() },
        $or: [
            { activeTo: { $exists: false } },
            { activeTo: { $gte: new Date() } }
        ]
    });
};

// Static method để tạo mục tiêu mặc định
GoalsSchema.statics.createDefaultGoals = function(userId, setBy, userAge = 8) {
    const defaultGoals = {
        userId,
        setBy,
        setByType: 'parent',
        goalType: 'weekly'
    };
    
    // Điều chỉnh mục tiêu theo độ tuổi
    if (userAge <= 6) {
        defaultGoals.studyTimeGoals = { daily: 20, weekly: 120, monthly: 480 };
        defaultGoals.lessonGoals = { daily: 1, weekly: 2, monthly: 8 };
        defaultGoals.scoreGoals = { math: 7, english: 7, science: 7, vietnamese: 7 };
        defaultGoals.streakGoal = 5;
    } else if (userAge <= 8) {
        defaultGoals.studyTimeGoals = { daily: 30, weekly: 180, monthly: 720 };
        defaultGoals.lessonGoals = { daily: 1, weekly: 3, monthly: 12 };
        defaultGoals.scoreGoals = { math: 8, english: 8, science: 8, vietnamese: 8 };
        defaultGoals.streakGoal = 7;
    } else {
        defaultGoals.studyTimeGoals = { daily: 45, weekly: 270, monthly: 1080 };
        defaultGoals.lessonGoals = { daily: 2, weekly: 4, monthly: 16 };
        defaultGoals.scoreGoals = { math: 8.5, english: 8.5, science: 8.5, vietnamese: 8.5 };
        defaultGoals.streakGoal = 10;
    }
    
    return this.create(defaultGoals);
};

module.exports = mongoose.model("Goals", GoalsSchema);
