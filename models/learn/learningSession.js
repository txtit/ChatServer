const mongoose = require("mongoose");

// Model để track chi tiết từng phiên học
const LearningSessionSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    lessonId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Slide', 
        required: true 
    },
    
    // Thông tin phiên học
    sessionId: { 
        type: String, 
        required: true,
        unique: true 
    }, // Unique ID cho mỗi session
    startTime: { 
        type: Date, 
        required: true,
        default: Date.now 
    },
    endTime: { type: Date },
    duration: { type: Number, default: 0 }, // milliseconds
    
    // Thông tin slide
    slidesViewed: [{
        slideIndex: Number,
        timeEntered: Date,
        timeExited: Date,
        timeSpent: Number, // milliseconds
        interactions: Number // số lần click, scroll, etc.
    }],
    
    // Progress trong session này
    startProgress: { type: Number, default: 0 }, // % khi bắt đầu session
    endProgress: { type: Number, default: 0 }, // % khi kết thúc session
    progressGained: { type: Number, default: 0 }, // % tiến bộ trong session
    
    // Activities trong session
    activities: [{
        type: { 
            type: String, 
            enum: ['slide_view', 'exercise_attempt', 'quiz_attempt', 'pause', 'resume', 'exit'] 
        },
        timestamp: { type: Date, default: Date.now },
        slideIndex: Number,
        data: mongoose.Schema.Types.Mixed // Additional data specific to activity type
    }],
    
    // Scores achieved in this session
    exercisesCompleted: [{
        exerciseId: String,
        score: Number,
        attempts: Number,
        timeSpent: Number
    }],
    quizzesCompleted: [{
        quizId: String,
        score: Number,
        answers: [Number],
        timeSpent: Number
    }],
    
    // Technical info
    deviceInfo: {
        userAgent: String,
        platform: String,
        screenResolution: String,
        browserLanguage: String
    },
    
    // Session quality metrics
    focusTime: { type: Number, default: 0 }, // Time actually focused on content
    idleTime: { type: Number, default: 0 }, // Time idle/away
    interactionCount: { type: Number, default: 0 }, // Total interactions
    
    // Completion status
    isCompleted: { type: Boolean, default: false }, // Did user complete the lesson in this session?
    exitReason: { 
        type: String, 
        enum: ['completed', 'user_exit', 'timeout', 'error', 'browser_close'],
        default: 'user_exit'
    },
    
    // Feedback (optional)
    userRating: { type: Number, min: 1, max: 5 },
    userFeedback: String
}, { 
    timestamps: true,
    indexes: [
        { userId: 1, startTime: -1 }, // Recent sessions by user
        { lessonId: 1, startTime: -1 }, // Recent sessions for lesson
        { sessionId: 1 }, // Quick lookup by session ID
        { userId: 1, lessonId: 1, startTime: -1 }, // User's sessions for specific lesson
        { isCompleted: 1, duration: -1 }, // Completed sessions by duration
        { startTime: -1 } // All sessions chronologically
    ]
});

// Virtual để tính efficiency rate
LearningSessionSchema.virtual('efficiencyRate').get(function() {
    if (this.duration === 0) return 0;
    return (this.focusTime / this.duration) * 100;
});

// Virtual để tính average time per slide
LearningSessionSchema.virtual('averageTimePerSlide').get(function() {
    if (this.slidesViewed.length === 0) return 0;
    return this.duration / this.slidesViewed.length;
});

// Method để thêm activity
LearningSessionSchema.methods.addActivity = function(type, slideIndex = null, data = {}) {
    this.activities.push({
        type,
        timestamp: new Date(),
        slideIndex,
        data
    });
    
    this.interactionCount += 1;
};

// Method để cập nhật slide view
LearningSessionSchema.methods.updateSlideView = function(slideIndex, timeSpent, interactions = 0) {
    let slideView = this.slidesViewed.find(sv => sv.slideIndex === slideIndex);
    
    if (slideView) {
        // Update existing
        slideView.timeExited = new Date();
        slideView.timeSpent = timeSpent;
        slideView.interactions += interactions;
    } else {
        // Add new
        this.slidesViewed.push({
            slideIndex,
            timeEntered: new Date(),
            timeExited: new Date(),
            timeSpent,
            interactions
        });
    }
    
    this.addActivity('slide_view', slideIndex, { timeSpent, interactions });
};

// Method để kết thúc session
LearningSessionSchema.methods.endSession = function(exitReason = 'user_exit', finalProgress = null) {
    this.endTime = new Date();
    this.duration = this.endTime - this.startTime;
    this.exitReason = exitReason;
    
    if (finalProgress !== null) {
        this.endProgress = finalProgress;
        this.progressGained = this.endProgress - this.startProgress;
    }
    
    if (exitReason === 'completed') {
        this.isCompleted = true;
    }
    
    this.addActivity('exit', null, { reason: exitReason });
};

// Static method để tạo session mới
LearningSessionSchema.statics.createSession = async function(userId, lessonId, startProgress = 0, deviceInfo = {}) {
    const sessionId = `${userId}_${lessonId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session = new this({
        userId,
        lessonId,
        sessionId,
        startTime: new Date(),
        startProgress,
        endProgress: startProgress,
        deviceInfo
    });
    
    session.addActivity('resume', 0, { startProgress });
    
    await session.save();
    return session;
};

// Static method để lấy session statistics cho lesson
LearningSessionSchema.statics.getLessonStats = async function(lessonId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const stats = await this.aggregate([
        {
            $match: {
                lessonId: mongoose.Types.ObjectId(lessonId),
                startTime: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: null,
                totalSessions: { $sum: 1 },
                completedSessions: { 
                    $sum: { $cond: ['$isCompleted', 1, 0] } 
                },
                averageDuration: { $avg: '$duration' },
                averageProgress: { $avg: '$progressGained' },
                totalUsers: { $addToSet: '$userId' }
            }
        },
        {
            $project: {
                totalSessions: 1,
                completedSessions: 1,
                completionRate: { 
                    $multiply: [
                        { $divide: ['$completedSessions', '$totalSessions'] }, 
                        100
                    ] 
                },
                averageDuration: { $round: ['$averageDuration', 0] },
                averageProgress: { $round: ['$averageProgress', 2] },
                uniqueUsers: { $size: '$totalUsers' }
            }
        }
    ]);
    
    return stats[0] || {
        totalSessions: 0,
        completedSessions: 0,
        completionRate: 0,
        averageDuration: 0,
        averageProgress: 0,
        uniqueUsers: 0
    };
};

// Static method để lấy user learning patterns
LearningSessionSchema.statics.getUserLearningPatterns = async function(userId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const patterns = await this.aggregate([
        {
            $match: {
                userId: mongoose.Types.ObjectId(userId),
                startTime: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: {
                    hour: { $hour: '$startTime' },
                    dayOfWeek: { $dayOfWeek: '$startTime' }
                },
                sessionCount: { $sum: 1 },
                averageDuration: { $avg: '$duration' },
                averageProgress: { $avg: '$progressGained' }
            }
        },
        {
            $sort: { sessionCount: -1 }
        }
    ]);
    
    return patterns;
};

module.exports = mongoose.model("LearningSession", LearningSessionSchema);
