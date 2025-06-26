const mongoose = require("mongoose");

// Model lưu trữ thành tích mà user đã đạt được
const UserAchievementSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    achievementId: { 
        type: String, 
        required: true 
    },
    earnedDate: { 
        type: Date, 
        default: Date.now 
    },
    progress: { 
        type: Number, 
        default: 100,
        min: 0,
        max: 100 
    }, // % progress towards achievement (100 = completed)
    isVisible: {
        type: Boolean,
        default: true
    },
    isNotified: {
        type: Boolean,
        default: false
    },
    // Thông tin bối cảnh khi đạt thành tích
    context: {
        lessonId: mongoose.Schema.Types.ObjectId,
        sessionId: String,
        scoreValue: Number,
        streakValue: Number
    }
}, { 
    timestamps: true,
    indexes: [
        { userId: 1, earnedDate: -1 },
        { userId: 1, achievementId: 1 },
        { achievementId: 1, earnedDate: -1 }
    ]
});

// Unique constraint để tránh duplicate achievements
UserAchievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });

// Virtual để populate achievement details
UserAchievementSchema.virtual('achievement', {
    ref: 'Achievement',
    localField: 'achievementId',
    foreignField: 'id',
    justOne: true
});

// Method để đánh dấu đã thông báo
UserAchievementSchema.methods.markAsNotified = function() {
    this.isNotified = true;
    return this.save();
};

// Static method để thêm achievement cho user
UserAchievementSchema.statics.addAchievement = async function(userId, achievementId, context = {}) {
    try {
        const userAchievement = await this.create({
            userId,
            achievementId,
            context,
            progress: 100
        });
        
        // Cập nhật thống kê achievement
        const Achievement = require('./achievements');
        await Achievement.findOneAndUpdate(
            { id: achievementId },
            { $inc: { totalEarned: 1 } }
        );
        
        return userAchievement;
    } catch (error) {
        if (error.code === 11000) {
            // Achievement đã tồn tại, không làm gì
            return null;
        }
        throw error;
    }
};

// Static method để lấy achievements của user
UserAchievementSchema.statics.getUserAchievements = function(userId, options = {}) {
    const query = this.find({ userId, isVisible: true });
    
    if (options.limit) {
        query.limit(options.limit);
    }
    
    if (options.recent) {
        query.sort({ earnedDate: -1 });
    }
    
    return query.populate('achievement');
};

// Static method để lấy achievements mới chưa thông báo
UserAchievementSchema.statics.getUnnotifiedAchievements = function(userId) {
    return this.find({
        userId,
        isNotified: false,
        isVisible: true
    }).populate('achievement');
};

// Static method để thống kê achievements theo category
UserAchievementSchema.statics.getAchievementStats = async function(userId) {
    const pipeline = [
        { $match: { userId: new mongoose.Types.ObjectId(userId), isVisible: true } },
        {
            $lookup: {
                from: 'achievements',
                localField: 'achievementId',
                foreignField: 'id',
                as: 'achievement'
            }
        },
        { $unwind: '$achievement' },
        {
            $group: {
                _id: '$achievement.category',
                count: { $sum: 1 },
                totalXP: { $sum: '$achievement.rewards.xp' },
                latestDate: { $max: '$earnedDate' }
            }
        }
    ];
    
    return this.aggregate(pipeline);
};

module.exports = mongoose.model("UserAchievement", UserAchievementSchema);
