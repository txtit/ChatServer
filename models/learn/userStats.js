const mongoose = require("mongoose");

// Model để lưu trữ thống kê học tập tổng thể của user
const UserStatsSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        unique: true 
    },
    
    // Thống kê tổng quan
    totalLessonsStarted: { type: Number, default: 0 },
    totalLessonsCompleted: { type: Number, default: 0 },
    totalLessonsInProgress: { type: Number, default: 0 },
    
    // Thống kê thời gian
    totalTimeSpent: { type: Number, default: 0 }, // milliseconds
    averageSessionTime: { type: Number, default: 0 }, // milliseconds
    longestSessionTime: { type: Number, default: 0 }, // milliseconds
    totalSessions: { type: Number, default: 0 },
    
    // Thống kê điểm số
    averageScore: { type: Number, default: 0 },
    highestScore: { type: Number, default: 0 },
    totalQuizzesCompleted: { type: Number, default: 0 },
    totalExercisesCompleted: { type: Number, default: 0 },
    
    // Streak và consistency
    currentStreak: { type: Number, default: 0 }, // Số ngày liên tiếp học
    longestStreak: { type: Number, default: 0 },
    lastActiveDate: { type: Date },
      // Thống kê theo môn học
    subjectStats: [{
        subject: String,
        subjectName: String, // "Toán học", "Tiếng Anh"
        lessonsCompleted: { type: Number, default: 0 },
        averageScore: { type: Number, default: 0 },
        timeSpent: { type: Number, default: 0 },
        lastActivity: Date
    }],
    
    // Thống kê theo tuần
    weeklyStats: [{
        weekStart: Date,
        weekEnd: Date,
        totalStudyTime: { type: Number, default: 0 }, // milliseconds
        lessonsCompleted: { type: Number, default: 0 },
        averageScore: { type: Number, default: 0 },
        goalAchievement: { type: Number, default: 0 }, // % đạt mục tiêu
        activeDays: { type: Number, default: 0 }
    }],
    
    // Điểm trung bình theo môn
    subjectAverages: {
        math: { type: Number, default: 0 },
        english: { type: Number, default: 0 },
        science: { type: Number, default: 0 },
        vietnamese: { type: Number, default: 0 },
        history: { type: Number, default: 0 },
        geography: { type: Number, default: 0 }
    },
    
    // Thống kê theo lớp
    gradeStats: [{
        grade: Number,
        lessonsCompleted: { type: Number, default: 0 },
        averageScore: { type: Number, default: 0 },
        timeSpent: { type: Number, default: 0 }
    }],
    
    // Achievements và badges
    achievements: [{
        type: String, // 'first_lesson', 'streak_7', 'perfect_score', etc.
        unlockedAt: { type: Date, default: Date.now },
        metadata: mongoose.Schema.Types.Mixed
    }],
    
    // Recent activity
    recentLessons: [{
        lessonId: { type: mongoose.Schema.Types.ObjectId, ref: 'Slide' },
        accessedAt: Date,
        progress: Number
    }],
    
    // Learning preferences
    preferredSubjects: [String],
    preferredDifficulty: { 
        type: String, 
        enum: ['Dễ', 'Trung bình', 'Khó'],
        default: 'Trung bình'
    },
    learningGoals: {
        dailyTimeMinutes: { type: Number, default: 30 },
        weeklyLessons: { type: Number, default: 5 },
        preferredStudyTime: String // 'morning', 'afternoon', 'evening'
    }
}, { 
    timestamps: true,
    indexes: [
        { userId: 1 },
        { totalLessonsCompleted: -1 },
        { averageScore: -1 },
        { currentStreak: -1 },
        { lastActiveDate: -1 }
    ]
});

// Virtual để tính completion rate
UserStatsSchema.virtual('completionRate').get(function() {
    if (this.totalLessonsStarted === 0) return 0;
    return (this.totalLessonsCompleted / this.totalLessonsStarted) * 100;
});

// Virtual để format thời gian học
UserStatsSchema.virtual('formattedTotalTime').get(function() {
    const hours = Math.floor(this.totalTimeSpent / (1000 * 60 * 60));
    const minutes = Math.floor((this.totalTimeSpent % (1000 * 60 * 60)) / (1000 * 60));
    return { hours, minutes };
});

// Method để cập nhật streak
UserStatsSchema.methods.updateStreak = function() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastActive = this.lastActiveDate ? new Date(this.lastActiveDate) : null;
    
    if (lastActive) {
        lastActive.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((today - lastActive) / (1000 * 60 * 60 * 24));
        
        if (daysDiff === 1) {
            // Học liên tiếp
            this.currentStreak += 1;
            this.longestStreak = Math.max(this.longestStreak, this.currentStreak);
        } else if (daysDiff > 1) {
            // Đã nghỉ > 1 ngày, reset streak
            this.currentStreak = 1;
        }
        // daysDiff === 0 means học trong cùng ngày, không thay đổi streak
    } else {
        // Lần đầu học
        this.currentStreak = 1;
        this.longestStreak = 1;
    }
    
    this.lastActiveDate = new Date();
};

// Method để thêm achievement
UserStatsSchema.methods.addAchievement = function(type, metadata = {}) {
    // Kiểm tra xem đã có achievement này chưa
    const existing = this.achievements.find(a => a.type === type);
    if (!existing) {
        this.achievements.push({
            type,
            metadata,
            unlockedAt: new Date()
        });
        return true; // Achievement mới
    }
    return false; // Đã có rồi
};

// Method để cập nhật recent lessons
UserStatsSchema.methods.updateRecentLesson = function(lessonId, progress) {
    // Remove existing entry for this lesson
    this.recentLessons = this.recentLessons.filter(
        rl => !rl.lessonId.equals(lessonId)
    );
    
    // Add to beginning
    this.recentLessons.unshift({
        lessonId,
        accessedAt: new Date(),
        progress
    });
    
    // Keep only last 10
    this.recentLessons = this.recentLessons.slice(0, 10);
};

// Static method để lấy hoặc tạo stats cho user
UserStatsSchema.statics.getOrCreateUserStats = async function(userId) {
    let stats = await this.findOne({ userId });
    
    if (!stats) {
        stats = new this({ userId });
        await stats.save();
    }
    
    return stats;
};

// Static method để cập nhật stats sau khi hoàn thành lesson
UserStatsSchema.statics.updateAfterLessonCompletion = async function(userId, lessonData, scoreData) {
    const stats = await this.getOrCreateUserStats(userId);
    
    stats.totalLessonsCompleted += 1;
    stats.totalQuizzesCompleted += scoreData.quizzes || 0;
    stats.totalExercisesCompleted += scoreData.exercises || 0;
    
    // Cập nhật điểm số
    if (scoreData.score !== null && scoreData.score !== undefined) {
        const totalScorePoints = (stats.averageScore * (stats.totalLessonsCompleted - 1)) + scoreData.score;
        stats.averageScore = Math.round(totalScorePoints / stats.totalLessonsCompleted);
        stats.highestScore = Math.max(stats.highestScore, scoreData.score);
    }
    
    // Cập nhật streak
    stats.updateStreak();
    
    // Cập nhật subject stats
    if (lessonData.subject) {
        let subjectStat = stats.subjectStats.find(s => s.subject === lessonData.subject);
        if (!subjectStat) {
            subjectStat = { subject: lessonData.subject, lessonsCompleted: 0, averageScore: 0, timeSpent: 0 };
            stats.subjectStats.push(subjectStat);
        }
        subjectStat.lessonsCompleted += 1;
        if (scoreData.score !== null) {
            const totalSubjectScore = (subjectStat.averageScore * (subjectStat.lessonsCompleted - 1)) + scoreData.score;
            subjectStat.averageScore = Math.round(totalSubjectScore / subjectStat.lessonsCompleted);
        }
    }
    
    // Check for achievements
    if (stats.totalLessonsCompleted === 1) {
        stats.addAchievement('first_lesson');
    }
    if (stats.currentStreak === 7) {
        stats.addAchievement('streak_7');
    }
    if (scoreData.score === 100) {
        stats.addAchievement('perfect_score', { lessonId: lessonData.lessonId });
    }
    
    await stats.save();
    return stats;
};

module.exports = mongoose.model("UserStats", UserStatsSchema);
