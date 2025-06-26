const { Progress, UserStats, LearningSession, Slide } = require('../models');

/**
 * Helper functions để đồng bộ dữ liệu giữa database và frontend Redux
 */

class ProgressSyncHelper {
    /**
     * Tạo hoặc cập nhật progress cho một lesson
     */
    static async initializeOrUpdateProgress(userId, lessonId, lessonTitle, totalSlides) {
        try {
            let progress = await Progress.findOne({ userId, lessonId });
            
            if (!progress) {
                // Tạo mới
                progress = new Progress({
                    userId,
                    lessonId,
                    lessonTitle,
                    totalSlides,
                    currentSlideIndex: 0,
                    percentage: 0,
                    startTime: new Date()
                });
                
                console.log(`📊 Created new progress for user ${userId}, lesson ${lessonId}`);
            } else {
                // Cập nhật totalSlides nếu cần
                if (progress.totalSlides !== totalSlides) {
                    progress.totalSlides = totalSlides;
                    // Tính lại percentage
                    if (totalSlides > 0) {
                        progress.percentage = Math.round(((progress.currentSlideIndex + 1) / totalSlides) * 100);
                    }
                    console.log(`📊 Updated totalSlides for lesson ${lessonId}: ${totalSlides}`);
                }
                
                // Cập nhật last access
                progress.lastAccessTime = new Date();
            }
            
            await progress.save();
            return progress;
            
        } catch (error) {
            console.error('❌ Error in initializeOrUpdateProgress:', error);
            throw error;
        }
    }
    
    /**
     * Cập nhật vị trí slide hiện tại
     */
    static async updateSlidePosition(userId, lessonId, slideIndex, slideId = null) {
        try {
            const progress = await Progress.findOne({ userId, lessonId });
            console.log(progress)
            if (!progress) {
                console.warn(`⚠️ Progress not found for user ${userId}, lesson ${lessonId}`);
                return null;
            }
            
            // Cập nhật vị trí
            progress.currentSlideIndex = slideIndex;
            if (slideId) {
                progress.lastSlideId = slideId;
            }
            
            // Cập nhật percentage
            if (progress.totalSlides > 0) {
                progress.percentage = Math.round(((slideIndex + 1) / progress.totalSlides) * 100);
                
                // Kiểm tra hoàn thành
                if (progress.percentage >= 100 && !progress.isCompleted) {
                    progress.isCompleted = true;
                    progress.completedAt = new Date();
                    
                    // Cập nhật user stats
                    await this.updateUserStatsOnCompletion(userId, lessonId, progress);
                }
            }
            
            // Thêm slide vào danh sách đã xem
            if (!progress.completedSlides.includes(slideIndex)) {
                progress.completedSlides.push(slideIndex);
            }
            
            progress.lastAccessTime = new Date();
            await progress.save();
            
            console.log(`📊 Updated slide position for lesson ${lessonId}: ${slideIndex}/${progress.totalSlides} (${progress.percentage}%)`);
            return progress;
            
        } catch (error) {
            console.error('❌ Error in updateSlidePosition:', error);
            throw error;
        }
    }
    
    /**
     * Lấy tất cả progress của user để sync với Redux
     */
    static async getAllUserProgress(userId) {
        try {
            const progressList = await Progress.find({ userId })
                .populate('lessonId', 'title subject grade slideCount')
                .sort({ lastAccessTime: -1 });
            
            // Convert sang format phù hợp với Redux
            const lessonsData = {};
            
            progressList.forEach(progress => {
                lessonsData[progress.lessonId._id] = {
                    lessonId: progress.lessonId._id,
                    title: progress.lessonTitle || progress.lessonId.title,
                    totalSlides: progress.totalSlides,
                    currentSlideIndex: progress.currentSlideIndex,
                    lastSlideIndex: progress.currentSlideIndex,
                    lastSlideId: progress.lastSlideId,
                    percentage: progress.percentage,
                    isCompleted: progress.isCompleted,
                    completedSlides: progress.completedSlides,
                    startTime: progress.startTime,
                    lastAccessTime: progress.lastAccessTime,
                    completedAt: progress.completedAt,
                    score: progress.overallScore
                };
            });
            
            console.log(`📊 Retrieved progress for ${progressList.length} lessons for user ${userId}`);
            return lessonsData;
            
        } catch (error) {
            console.error('❌ Error in getAllUserProgress:', error);
            throw error;
        }
    }
    
    /**
     * Cập nhật user stats khi hoàn thành lesson
     */
    static async updateUserStatsOnCompletion(userId, lessonId, progressData) {
        try {
            // Lấy thông tin lesson
            const lesson = await Slide.findById(lessonId);
            if (!lesson) return;
            
            // Cập nhật user stats
            await UserStats.updateAfterLessonCompletion(userId, {
                lessonId,
                subject: lesson.subject,
                grade: lesson.grade
            }, {
                score: progressData.overallScore,
                quizzes: progressData.completedQuizzes.length,
                exercises: progressData.completedExercises.length
            });
            
            console.log(`📈 Updated user stats for user ${userId} after completing lesson ${lessonId}`);
            
        } catch (error) {
            console.error('❌ Error updating user stats:', error);
        }
    }
    
    /**
     * Tạo session tracking cho lesson
     */
    static async startLearningSession(userId, lessonId, deviceInfo = {}) {
        try {
            // Lấy progress hiện tại
            const progress = await Progress.findOne({ userId, lessonId });
            const startProgress = progress ? progress.percentage : 0;
            
            // Tạo session mới
            const session = await LearningSession.createSession(
                userId, 
                lessonId, 
                startProgress, 
                deviceInfo
            );
            
            console.log(`🎯 Started learning session ${session.sessionId} for user ${userId}, lesson ${lessonId}`);
            return session;
            
        } catch (error) {
            console.error('❌ Error starting learning session:', error);
            throw error;
        }
    }
    
    /**
     * Kết thúc session tracking
     */
    static async endLearningSession(sessionId, exitReason = 'user_exit', finalProgress = null) {
        try {
            const session = await LearningSession.findOne({ sessionId });
            if (!session) {
                console.warn(`⚠️ Session not found: ${sessionId}`);
                return null;
            }
            
            session.endSession(exitReason, finalProgress);
            await session.save();
            
            // Cập nhật user stats với session data
            const userStats = await UserStats.getOrCreateUserStats(session.userId);
            userStats.totalSessions += 1;
            userStats.totalTimeSpent += session.duration;
            
            if (session.duration > userStats.longestSessionTime) {
                userStats.longestSessionTime = session.duration;
            }
            
            // Cập nhật average session time
            userStats.averageSessionTime = Math.round(userStats.totalTimeSpent / userStats.totalSessions);
            
            await userStats.save();
            
            console.log(`🏁 Ended learning session ${sessionId}, duration: ${Math.round(session.duration/1000/60)}min`);
            return session;
            
        } catch (error) {
            console.error('❌ Error ending learning session:', error);
            throw error;
        }
    }
    
    /**
     * Lấy dashboard data cho user
     */
    static async getUserDashboardData(userId) {
        try {
            const [userStats, recentProgress, activeSessions] = await Promise.all([
                UserStats.findOne({ userId }) || UserStats.getOrCreateUserStats(userId),
                Progress.find({ userId })
                    .populate('lessonId', 'title subject grade')
                    .sort({ lastAccessTime: -1 })
                    .limit(5),
                LearningSession.find({ 
                    userId, 
                    endTime: null 
                }).sort({ startTime: -1 }).limit(3)
            ]);
            
            return {
                stats: userStats,
                recentLessons: recentProgress,
                activeSessions
            };
            
        } catch (error) {
            console.error('❌ Error getting dashboard data:', error);
            throw error;
        }
    }
}

module.exports = ProgressSyncHelper;
