const mongoose = require("mongoose");

// Model định nghĩa các thành tích có thể đạt được
const AchievementSchema = new mongoose.Schema({
    id: { 
        type: String, 
        unique: true, 
        required: true 
    }, // "math_excellence", "consistency_streak"
    title: { 
        type: String, 
        required: true 
    }, // "Toán học xuất sắc"
    description: { 
        type: String, 
        required: true 
    },
    icon: { 
        type: String, 
        default: "🏆" 
    },
    color: {
        type: String,
        default: "#FFD700"
    },
    category: { 
        type: String, 
        enum: ['academic', 'consistency', 'improvement', 'special', 'milestone'], 
        required: true 
    },
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard', 'legendary'],
        default: 'medium'
    },
    // Điều kiện để đạt thành tích
    conditions: {
        type: { 
            type: String, 
            enum: [
                'consecutive_days', 
                'average_score', 
                'lessons_completed',
                'total_study_time',
                'perfect_scores',
                'improvement_rate',
                'quiz_streak',
                'first_lesson'
            ],
            required: true 
        },
        value: { 
            type: Number, 
            required: true 
        },
        subject: String, // optional, specific subject
        timeframe: String, // "week", "month", "all_time"
        grade: Number // optional, specific grade
    },
    // Phần thưởng khi đạt thành tích
    rewards: {
        xp: { type: Number, default: 100 },
        badges: [String],
        items: [String],
        title: String
    },
    // Thông tin hiển thị
    isActive: { 
        type: Boolean, 
        default: true 
    },
    sortOrder: { 
        type: Number, 
        default: 0 
    },
    // Thống kê
    totalEarned: { 
        type: Number, 
        default: 0 
    },
    rarityScore: { 
        type: Number, 
        default: 0 
    } // 0-100, càng hiếm càng cao
}, { 
    timestamps: true 
});

// Method để kiểm tra user có đạt điều kiện không
AchievementSchema.methods.checkCondition = async function(userId) {
    const Score = require('./scores');
    const Progress = require('./progress');
    const UserStats = require('./userStats');
    
    const userStats = await UserStats.findOne({ userId });
    if (!userStats) return false;
    
    switch (this.conditions.type) {
        case 'consecutive_days':
            return userStats.currentStreak >= this.conditions.value;
            
        case 'average_score':
            if (this.conditions.subject) {
                const avgScore = await Score.getAverageBySubject(userId, this.conditions.subject);
                return avgScore >= this.conditions.value;
            } else {
                return userStats.averageScore >= this.conditions.value;
            }
            
        case 'lessons_completed':
            return userStats.totalLessonsCompleted >= this.conditions.value;
            
        case 'total_study_time':
            // Convert minutes to milliseconds for comparison
            return userStats.totalTimeSpent >= (this.conditions.value * 60 * 1000);
            
        case 'perfect_scores':
            const perfectScores = await Score.countDocuments({
                userId,
                score: 10,
                ...(this.conditions.subject && { subject: this.conditions.subject })
            });
            return perfectScores >= this.conditions.value;
            
        default:
            return false;
    }
};

// Static method để kiểm tra tất cả achievements cho user
AchievementSchema.statics.checkAllForUser = async function(userId) {
    const achievements = await this.find({ isActive: true });
    const earned = [];
    
    for (const achievement of achievements) {
        const hasEarned = await achievement.checkCondition(userId);
        if (hasEarned) {
            earned.push(achievement);
        }
    }
    
    return earned;
};

module.exports = mongoose.model("Achievement", AchievementSchema);
