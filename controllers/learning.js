const { Progress, UserStats, LearningSession, Slide } = require('../models');
const ProgressSyncHelper = require('../utils/progressSyncHelper');

/**
 * Learning Controller - Xử lý các API liên quan đến tiến độ học tập
 */

// 1. Khởi tạo hoặc lấy progress cho một lesson
exports.initializeProgress = async (req, res) => {
    try {
        const { lessonId } = req.params;
        const { totalSlides, lessonTitle } = req.body;
        const userId = req.userId || req.body.userId; // Từ auth middleware hoặc request body

        console.log('🚀 Initialize progress:', { userId, lessonId, totalSlides, lessonTitle });

        // Validate input
        if (!userId || !lessonId) {
            return res.status(400).json({
                success: false,
                message: 'userId và lessonId là bắt buộc'
            });
        }

        // Khởi tạo hoặc cập nhật progress
        const progress = await ProgressSyncHelper.initializeOrUpdateProgress(
            userId, lessonId, lessonTitle, totalSlides
        );

        res.status(200).json({
            success: true,
            message: 'Progress được khởi tạo thành công',
            data: {
                lessonId: progress.lessonId,
                totalSlides: progress.totalSlides,
                currentSlideIndex: progress.currentSlideIndex,
                percentage: progress.percentage,
                isCompleted: progress.isCompleted,
                lastAccessTime: progress.lastAccessTime
            }
        });

    } catch (error) {
        console.error('❌ Error initializing progress:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi khởi tạo progress',
            error: error.message
        });
    }
};

// 2. Cập nhật vị trí slide hiện tại
exports.updateSlidePosition = async (req, res) => {
    try {
        const { lessonId } = req.params;
        const { slideIndex, slideId, timeSpentOnSlide, totalSlides } = req.body;
        const userId = req.userId || req.body.userId;

        console.log('📊 Update slide position:', { userId, lessonId, slideIndex, slideId, totalSlides });

        if (!userId || !lessonId || slideIndex === undefined) {
            return res.status(400).json({
                success: false,
                message: 'userId, lessonId và slideIndex là bắt buộc'
            });
        }

        // Cập nhật vị trí slide
        let progress = await ProgressSyncHelper.updateSlidePosition(
            userId, lessonId, slideIndex, slideId
        );

        // Nếu không tìm thấy progress, tự động khởi tạo trước rồi update lại
        if (!progress) {
            console.log('⚠️ Progress not found, auto-initializing...');
            
            // Khởi tạo progress với totalSlides từ request hoặc fallback
            const effectiveTotalSlides = totalSlides || slideIndex + 1;
            progress = await ProgressSyncHelper.initializeOrUpdateProgress(
                userId, lessonId, `Lesson ${lessonId}`, effectiveTotalSlides
            );
            
            // Update lại vị trí slide sau khi khởi tạo
            progress = await ProgressSyncHelper.updateSlidePosition(
                userId, lessonId, slideIndex, slideId
            );
        }

        res.status(200).json({
            success: true,
            message: 'Vị trí slide được cập nhật thành công',
            data: {
                lessonId: progress.lessonId,
                currentSlideIndex: progress.currentSlideIndex,
                percentage: progress.percentage,
                isCompleted: progress.isCompleted,
                completedSlides: progress.completedSlides
            }
        });

    } catch (error) {
        console.error('❌ Error updating slide position:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật vị trí slide',
            error: error.message
        });
    }
};

// 3. Lấy tất cả progress của user
exports.getAllUserProgress = async (req, res) => {
    try {
        const { userId } = req.params;

        console.log('📊 Get all user progress:', { userId });

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'userId là bắt buộc'
            });
        }

        const lessonsData = await ProgressSyncHelper.getAllUserProgress(userId);

        res.status(200).json({
            success: true,
            message: 'Lấy progress thành công',
            data: {
                userId,
                lessonsCount: Object.keys(lessonsData).length,
                lessons: lessonsData
            }
        });

    } catch (error) {
        console.error('❌ Error getting user progress:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy progress của user',
            error: error.message
        });
    }
};

// 4. Lấy progress chi tiết cho một lesson cụ thể
exports.getLessonProgress = async (req, res) => {
    try {
        const { userId, lessonId } = req.params;

        console.log('📊 Get lesson progress:', { userId, lessonId });

        const progress = await Progress.findOne({ userId, lessonId })
            .populate('lessonId', 'title subject grade slideCount');

        if (!progress) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy progress cho lesson này'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Lấy progress lesson thành công',
            data: {
                lessonId: progress.lessonId,
                lessonTitle: progress.lessonTitle,
                totalSlides: progress.totalSlides,
                currentSlideIndex: progress.currentSlideIndex,
                percentage: progress.percentage,
                isCompleted: progress.isCompleted,
                completedSlides: progress.completedSlides,
                startTime: progress.startTime,
                lastAccessTime: progress.lastAccessTime,
                totalTimeSpent: progress.totalTimeSpent,
                overallScore: progress.overallScore,
                viewCount: progress.viewCount
            }
        });

    } catch (error) {
        console.error('❌ Error getting lesson progress:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy progress lesson',
            error: error.message
        });
    }
};

// 5. Bắt đầu session học tập
exports.startLearningSession = async (req, res) => {
    try {
        const { lessonId } = req.params;
        const { deviceInfo } = req.body;
        const userId = req.userId || req.body.userId;

        console.log('🎯 Start learning session:', { userId, lessonId });

        const session = await ProgressSyncHelper.startLearningSession(
            userId, lessonId, deviceInfo
        );

        // Cập nhật progress để bắt đầu session
        const progress = await Progress.findOne({ userId, lessonId });
        if (progress) {
            progress.startSession();
            await progress.save();
        }

        res.status(200).json({
            success: true,
            message: 'Session học tập được bắt đầu',
            data: {
                sessionId: session.sessionId,
                startTime: session.startTime,
                startProgress: session.startProgress
            }
        });

    } catch (error) {
        console.error('❌ Error starting learning session:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi bắt đầu session học tập',
            error: error.message
        });
    }
};

// 6. Kết thúc session học tập
exports.endLearningSession = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { exitReason, finalProgress } = req.body;
        const userId = req.userId || req.body.userId;

        console.log('🏁 End learning session:', { sessionId, exitReason });

        const session = await ProgressSyncHelper.endLearningSession(
            sessionId, exitReason, finalProgress
        );

        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy session'
            });
        }

        // Cập nhật progress để kết thúc session
        const progress = await Progress.findOne({ 
            userId: session.userId, 
            lessonId: session.lessonId 
        });
        if (progress) {
            progress.endSession();
            await progress.save();
        }

        res.status(200).json({
            success: true,
            message: 'Session học tập được kết thúc',
            data: {
                sessionId: session.sessionId,
                duration: session.duration,
                progressGained: session.progressGained
            }
        });

    } catch (error) {
        console.error('❌ Error ending learning session:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi kết thúc session học tập',
            error: error.message
        });
    }
};

// 7. Lưu kết quả quiz/exercise
exports.submitExerciseResult = async (req, res) => {
    try {
        const { lessonId } = req.params;
        const { exerciseId, score, answers, attempts, type } = req.body; // type: 'exercise' hoặc 'quiz'
        const userId = req.userId || req.body.userId;

        console.log('📝 Submit exercise result:', { userId, lessonId, exerciseId, score, type });

        const progress = await Progress.findOne({ userId, lessonId });
        if (!progress) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy progress cho lesson này'
            });
        }

        // Thêm kết quả vào progress
        if (type === 'quiz') {
            progress.completedQuizzes.push({
                quizId: exerciseId,
                score,
                answers,
                attempts: attempts || 1,
                completedAt: new Date()
            });
        } else {
            progress.completedExercises.push({
                exerciseId,
                score,
                attempts: attempts || 1,
                completedAt: new Date()
            });
        }

        // Tính lại overall score
        const allScores = [
            ...progress.completedQuizzes.map(q => q.score),
            ...progress.completedExercises.map(e => e.score)
        ].filter(s => s !== null && s !== undefined);

        if (allScores.length > 0) {
            progress.overallScore = Math.round(
                allScores.reduce((sum, s) => sum + s, 0) / allScores.length
            );
        }

        await progress.save();

        res.status(200).json({
            success: true,
            message: 'Kết quả được lưu thành công',
            data: {
                lessonId: progress.lessonId,
                overallScore: progress.overallScore,
                totalQuizzes: progress.completedQuizzes.length,
                totalExercises: progress.completedExercises.length
            }
        });

    } catch (error) {
        console.error('❌ Error submitting exercise result:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lưu kết quả bài tập',
            error: error.message
        });
    }
};

// 8. Lấy dashboard data cho user
exports.getUserDashboard = async (req, res) => {
    try {
        const { userId } = req.params;

        console.log('📊 Get user dashboard:', { userId });

        const dashboardData = await ProgressSyncHelper.getUserDashboardData(userId);

        // Tính toán thêm một số thống kê
        const progressList = await Progress.find({ userId });
        const totalLessons = progressList.length;
        const completedLessons = progressList.filter(p => p.isCompleted).length;
        const inProgressLessons = progressList.filter(p => p.percentage > 0 && !p.isCompleted).length;

        res.status(200).json({
            success: true,
            message: 'Lấy dashboard thành công',
            data: {
                userId,
                stats: dashboardData.stats,
                overview: {
                    totalLessons,
                    completedLessons,
                    inProgressLessons,
                    completionRate: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0
                },
                recentLessons: dashboardData.recentLessons,
                activeSessions: dashboardData.activeSessions
            }
        });

    } catch (error) {
        console.error('❌ Error getting user dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy dashboard',
            error: error.message
        });
    }
};

// 9. Bulk update progress (để đồng bộ từ frontend)
exports.bulkUpdateProgress = async (req, res) => {
    try {
        const { userId, progressUpdates } = req.body;

        console.log('📦 Bulk update progress:', { userId, updatesCount: progressUpdates?.length });

        if (!userId || !Array.isArray(progressUpdates)) {
            return res.status(400).json({
                success: false,
                message: 'userId và progressUpdates (array) là bắt buộc'
            });
        }

        const results = [];

        for (const update of progressUpdates) {
            try {
                const { lessonId, slideIndex, timeSpent, totalSlides } = update;

                if (lessonId && slideIndex !== undefined) {
                    // Cập nhật progress
                    const progress = await Progress.findOne({ userId, lessonId });
                    if (progress) {
                        progress.updateProgress(slideIndex, totalSlides);
                        if (timeSpent) {
                            progress.totalTimeSpent += timeSpent;
                        }
                        await progress.save();

                        results.push({
                            lessonId,
                            success: true,
                            percentage: progress.percentage
                        });
                    } else {
                        results.push({
                            lessonId,
                            success: false,
                            error: 'Progress not found'
                        });
                    }
                }
            } catch (updateError) {
                results.push({
                    lessonId: update.lessonId,
                    success: false,
                    error: updateError.message
                });
            }
        }

        res.status(200).json({
            success: true,
            message: 'Bulk update hoàn thành',
            data: {
                totalUpdates: progressUpdates.length,
                successCount: results.filter(r => r.success).length,
                results
            }
        });

    } catch (error) {
        console.error('❌ Error bulk updating progress:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi bulk update progress',
            error: error.message
        });
    }
};

// 10. Reset progress cho một lesson (dev/admin only)
exports.resetLessonProgress = async (req, res) => {
    try {
        const { userId, lessonId } = req.params;

        console.log('🔄 Reset lesson progress:', { userId, lessonId });

        const result = await Progress.deleteOne({ userId, lessonId });

        res.status(200).json({
            success: true,
            message: result.deletedCount > 0 ? 'Progress đã được reset' : 'Không tìm thấy progress để reset',
            data: {
                deletedCount: result.deletedCount
            }
        });

    } catch (error) {
        console.error('❌ Error resetting lesson progress:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi reset progress',
            error: error.message
        });
    }
};
