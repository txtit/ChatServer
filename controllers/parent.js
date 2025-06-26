const User = require('../models/user/user');
const ParentChild = require('../models/user/parentChild');
const Progress = require('../models/learn/progress');
const UserStats = require('../models/learn/userStats');
const Scores = require('../models/learn/scores');
const Goals = require('../models/learn/goals');
const UserAchievement = require('../models/learn/userAchievements');
const ActivityLog = require('../models/learn/activityLog');
const mongoose = require('mongoose');

/**
 * Parent Dashboard API Controller
 * Handles all API endpoints for parent dashboard functionality
 */

// GET /api/parent/children - Lấy danh sách con của phụ huynh
exports.getChildren = async (req, res) => {
    try {
        const parentId = req.user._id; // Assuming parent is authenticated
        
        const relationships = await ParentChild.findChildrenByParent(parentId);
        
        const children = await Promise.all(relationships.map(async (rel) => {
            const child = rel.childId;
            const userStats = await UserStats.findOne({ userId: child._id });
            
            return {
                id: child._id,
                name: `${child.firstName} ${child.lastName}`,
                avatar: child.avatar || `${child.firstName.charAt(0)}${child.lastName.charAt(0)}`,
                grade: child.grade || 'Chưa xác định',
                age: child.age,
                role: child.role,
                lastActivity: userStats?.lastActiveDate || child.updatedAt,
                relationship: rel.relationship,
                permissions: rel.permissions
            };
        }));
        
        res.status(200).json({
            success: true,
            data: children
        });
    } catch (error) {
        console.error('Error getting children:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy danh sách con',
            error: error.message
        });
    }
};

// GET /api/parent/children/:childId/progress - Tiến độ tổng quan của con
exports.getChildProgress = async (req, res) => {
    try {
        const { childId } = req.params;
        const parentId = req.user._id;
        
        // Verify parent-child relationship
        const relationship = await ParentChild.findOne({ 
            parentId, 
            childId, 
            status: 'active' 
        });
        
        if (!relationship || !relationship.hasPermission('viewProgress')) {
            return res.status(403).json({
                success: false,
                message: 'Không có quyền xem tiến độ của học sinh này'
            });
        }
        
        const userStats = await UserStats.findOne({ userId: childId });
        const currentGoals = await Goals.getCurrentGoals(childId);
        
        // Calculate weekly progress
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        
        const weeklyActivities = await ActivityLog.find({
            userId: childId,
            createdAt: { $gte: weekStart },
            activityType: { $in: ['lesson_complete', 'test', 'practice', 'homework'] }
        });
        
        const weeklyStudyTime = weeklyActivities.reduce((total, activity) => {
            return total + (activity.duration || 0);
        }, 0);
        
        const weeklyLessons = weeklyActivities.filter(a => 
            a.activityType === 'lesson_complete'
        ).length;
        
        res.status(200).json({
            success: true,
            data: {
                totalStudyTime: Math.round(weeklyStudyTime / (1000 * 60)), // Convert to minutes
                weeklyGoal: currentGoals?.studyTimeGoals?.weekly || 180,
                completedLessons: weeklyLessons,
                totalLessons: currentGoals?.lessonGoals?.weekly || 3,
                lastActivity: userStats?.lastActiveDate,
                currentStreak: userStats?.currentStreak || 0,
                totalLessonsCompleted: userStats?.totalLessonsCompleted || 0
            }
        });
    } catch (error) {
        console.error('Error getting child progress:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy tiến độ học tập',
            error: error.message
        });
    }
};

// GET /api/parent/children/:childId/scores - Lấy điểm số theo môn
exports.getChildScores = async (req, res) => {
    try {
        const { childId } = req.params;
        const { subject, limit = 5 } = req.query;
        const parentId = req.user._id;
        
        // Verify permissions
        const relationship = await ParentChild.findOne({ 
            parentId, 
            childId, 
            status: 'active' 
        });
        
        if (!relationship || !relationship.hasPermission('viewScores')) {
            return res.status(403).json({
                success: false,
                message: 'Không có quyền xem điểm số của học sinh này'
            });
        }
        
        if (subject) {
            // Get scores for specific subject
            const scores = await Scores.find({ userId: childId, subject })
                .sort({ createdAt: -1 })
                .limit(parseInt(limit));
            
            const average = await Scores.getAverageBySubject(childId, subject);
            const trend = await Scores.getScoreTrend(childId, subject);
            
            res.status(200).json({
                success: true,
                data: {
                    subject,
                    scores: scores.map(s => s.score),
                    average,
                    trend,
                    lastScore: scores[0]?.score || 0,
                    lastAssessmentDate: scores[0]?.createdAt
                }
            });
        } else {
            // Get all subjects summary
            const userStats = await UserStats.findOne({ userId: childId });
            const subjectStats = userStats?.subjectStats || [];
            
            res.status(200).json({
                success: true,
                data: subjectStats.map(stat => ({
                    subject: stat.subject,
                    subjectName: stat.subjectName,
                    averageScore: stat.averageScore,
                    totalAssessments: stat.lessonsCompleted,
                    lastActivity: stat.lastActivity
                }))
            });
        }
    } catch (error) {
        console.error('Error getting child scores:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy điểm số',
            error: error.message
        });
    }
};

// POST /api/parent/children/:childId/scores - Thêm điểm mới
exports.addChildScore = async (req, res) => {
    try {
        const { childId } = req.params;
        const { subject, subjectName, score, maxScore = 10, assessmentType, notes } = req.body;
        const parentId = req.user._id;
        
        // Verify permissions
        const relationship = await ParentChild.findOne({ 
            parentId, 
            childId, 
            status: 'active' 
        });
        
        if (!relationship || !relationship.hasPermission('addScores')) {
            return res.status(403).json({
                success: false,
                message: 'Không có quyền thêm điểm cho học sinh này'
            });
        }
        
        // Validate input
        if (!subject || score === undefined || !assessmentType) {
            return res.status(400).json({
                success: false,
                message: 'Thiếu thông tin bắt buộc: subject, score, assessmentType'
            });
        }
        
        const child = await User.findById(childId);
        if (!child) {
            return res.status(404).json({
                success: false,
                message: 'Không tìm thấy học sinh'
            });
        }
        
        // Create new score record
        const newScore = await Scores.create({
            userId: childId,
            subject,
            subjectName: subjectName || subject,
            grade: child.grade ? parseInt(child.grade.match(/\d+/)?.[0]) || 5 : 5,
            score: parseFloat(score),
            maxScore: parseFloat(maxScore),
            assessmentType,
            addedBy: parentId,
            addedByType: 'parent',
            notes
        });
        
        // Log activity
        await ActivityLog.logActivity({
            userId: childId,
            activityType: assessmentType,
            subject,
            subjectName: subjectName || subject,
            score: parseFloat(score),
            maxScore: parseFloat(maxScore),
            description: `Bài kiểm tra ${subjectName || subject}`,
            metadata: {
                addedByParent: true,
                parentId
            }
        });
        
        // Update user stats
        await updateUserStatsAfterScore(childId, subject, parseFloat(score));
        
        res.status(201).json({
            success: true,
            data: newScore,
            message: 'Đã thêm điểm thành công'
        });
    } catch (error) {
        console.error('Error adding child score:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi thêm điểm',
            error: error.message
        });
    }
};

// GET /api/parent/children/:childId/activities - Lịch sử hoạt động
exports.getChildActivities = async (req, res) => {
    try {
        const { childId } = req.params;
        const { limit = 20, page = 1 } = req.query;
        const parentId = req.user._id;
        
        // Verify permissions
        const relationship = await ParentChild.findOne({ 
            parentId, 
            childId, 
            status: 'active' 
        });
        
        if (!relationship || !relationship.hasPermission('viewActivities')) {
            return res.status(403).json({
                success: false,
                message: 'Không có quyền xem hoạt động của học sinh này'
            });
        }
        
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const activities = await ActivityLog.getRecentActivities(childId, parseInt(limit), offset);
        const totalActivities = await ActivityLog.countDocuments({ userId: childId });
        
        res.status(200).json({
            success: true,
            data: {
                activities: activities.map(activity => ({
                    id: activity._id,
                    type: activity.activityType,
                    activity: activity.description,
                    subject: activity.subject,
                    subjectName: activity.subjectName,
                    score: activity.score,
                    maxScore: activity.maxScore,
                    duration: activity.duration ? Math.round(activity.duration / (1000 * 60)) : null, // minutes
                    timestamp: activity.createdAt,
                    lessonId: activity.lessonId
                })),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: totalActivities,
                    totalPages: Math.ceil(totalActivities / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error('Error getting child activities:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy lịch sử hoạt động',
            error: error.message
        });
    }
};

// GET /api/parent/children/:childId/achievements - Thành tích của con
exports.getChildAchievements = async (req, res) => {
    try {
        const { childId } = req.params;
        const parentId = req.user._id;
        
        // Verify relationship
        const relationship = await ParentChild.findOne({ 
            parentId, 
            childId, 
            status: 'active' 
        });
        
        if (!relationship) {
            return res.status(403).json({
                success: false,
                message: 'Không có quyền xem thành tích của học sinh này'
            });
        }
        
        const achievements = await UserAchievement.getUserAchievements(childId, { recent: true });
        
        res.status(200).json({
            success: true,
            data: achievements.map(ua => ({
                id: ua.achievement.id,
                title: ua.achievement.title,
                description: ua.achievement.description,
                icon: ua.achievement.icon,
                earnedDate: ua.earnedDate,
                category: ua.achievement.category
            }))
        });
    } catch (error) {
        console.error('Error getting child achievements:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy thành tích',
            error: error.message
        });
    }
};

// GET /api/parent/children/:childId/weekly-report - Báo cáo tuần
exports.getWeeklyReport = async (req, res) => {
    try {
        const { childId } = req.params;
        const parentId = req.user._id;
        
        // Verify permissions
        const relationship = await ParentChild.findOne({ 
            parentId, 
            childId, 
            status: 'active' 
        });
        
        if (!relationship) {
            return res.status(403).json({
                success: false,
                message: 'Không có quyền xem báo cáo của học sinh này'
            });
        }
        
        // Calculate week boundaries
        const weekEnd = new Date();
        const weekStart = new Date();
        weekStart.setDate(weekEnd.getDate() - 6);
        weekStart.setHours(0, 0, 0, 0);
        weekEnd.setHours(23, 59, 59, 999);
        
        // Get weekly data
        const weeklyActivities = await ActivityLog.find({
            userId: childId,
            createdAt: { $gte: weekStart, $lte: weekEnd }
        });
        
        const totalStudyTime = weeklyActivities.reduce((total, activity) => {
            return total + (activity.duration || 0);
        }, 0);
        
        const lessonsCompleted = weeklyActivities.filter(a => 
            a.activityType === 'lesson_complete'
        ).length;
        
        const averageScores = {};
        const subjectScores = {};
        
        weeklyActivities.forEach(activity => {
            if (activity.score && activity.subject) {
                if (!subjectScores[activity.subject]) {
                    subjectScores[activity.subject] = [];
                }
                subjectScores[activity.subject].push(activity.score);
            }
        });
        
        for (const [subject, scores] of Object.entries(subjectScores)) {
            averageScores[subject] = Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1));
        }
        
        const currentGoals = await Goals.getCurrentGoals(childId);
        const studyTimeTarget = currentGoals?.studyTimeGoals?.weekly || 180;
        const studyTimeActual = Math.round(totalStudyTime / (1000 * 60)); // minutes
        
        res.status(200).json({
            success: true,
            data: {
                weekStart: weekStart.toISOString().split('T')[0],
                weekEnd: weekEnd.toISOString().split('T')[0],
                studyTimeTarget,
                studyTimeActual,
                studyTimePercentage: Number(((studyTimeActual / studyTimeTarget) * 100).toFixed(1)),
                lessonsCompleted,
                averageScores,
                improvements: generateImprovements(averageScores, lessonsCompleted),
                concerns: generateConcerns(studyTimeActual, studyTimeTarget, lessonsCompleted)
            }
        });
    } catch (error) {
        console.error('Error getting weekly report:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tạo báo cáo tuần',
            error: error.message
        });
    }
};

// GET /api/parent/dashboard/summary - Tổng quan dashboard
exports.getDashboardSummary = async (req, res) => {
    try {
        const parentId = req.user._id;
        
        const relationships = await ParentChild.findChildrenByParent(parentId);
        const totalChildren = relationships.length;
        
        if (totalChildren === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    totalChildren: 0,
                    activeToday: 0,
                    weeklyStudyTime: 0,
                    averageProgress: 0,
                    recentAchievements: 0,
                    pendingAssignments: 0
                }
            });
        }
        
        const childIds = relationships.map(rel => rel.childId._id);
        
        // Get today's activities
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        
        const todayActivities = await ActivityLog.find({
            userId: { $in: childIds },
            createdAt: { $gte: todayStart, $lte: todayEnd }
        });
        
        const activeToday = new Set(todayActivities.map(a => a.userId.toString())).size;
        
        // Get weekly study time
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        
        const weeklyActivities = await ActivityLog.find({
            userId: { $in: childIds },
            createdAt: { $gte: weekStart }
        });
        
        const weeklyStudyTime = Math.round(weeklyActivities.reduce((total, activity) => {
            return total + (activity.duration || 0);
        }, 0) / (1000 * 60)); // Convert to minutes
        
        // Get recent achievements (last 7 days)
        const recentAchievements = await UserAchievement.countDocuments({
            userId: { $in: childIds },
            earnedDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        });
        
        res.status(200).json({
            success: true,
            data: {
                totalChildren,
                activeToday,
                weeklyStudyTime,
                averageProgress: 75.5, // This would need more complex calculation
                recentAchievements,
                pendingAssignments: 0 // This would need assignment system
            }
        });
    } catch (error) {
        console.error('Error getting dashboard summary:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi tải tổng quan dashboard',
            error: error.message
        });
    }
};

// Helper functions
async function updateUserStatsAfterScore(userId, subject, score) {
    try {
        let userStats = await UserStats.findOne({ userId });
        if (!userStats) {
            userStats = await UserStats.create({ userId });
        }
        
        // Update subject stats
        const subjectIndex = userStats.subjectStats.findIndex(s => s.subject === subject);
        if (subjectIndex >= 0) {
            const currentAvg = userStats.subjectStats[subjectIndex].averageScore || 0;
            const currentCount = userStats.subjectStats[subjectIndex].lessonsCompleted || 0;
            const newAvg = ((currentAvg * currentCount) + score) / (currentCount + 1);
            
            userStats.subjectStats[subjectIndex].averageScore = Number(newAvg.toFixed(1));
            userStats.subjectStats[subjectIndex].lessonsCompleted += 1;
            userStats.subjectStats[subjectIndex].lastActivity = new Date();
        } else {
            userStats.subjectStats.push({
                subject,
                averageScore: score,
                lessonsCompleted: 1,
                lastActivity: new Date()
            });
        }
        
        await userStats.save();
    } catch (error) {
        console.error('Error updating user stats:', error);
    }
}

function generateImprovements(averageScores, lessonsCompleted) {
    const improvements = [];
    
    for (const [subject, score] of Object.entries(averageScores)) {
        if (score >= 8.5) {
            improvements.push(`Điểm ${subject} xuất sắc (${score})`);
        }
    }
    
    if (lessonsCompleted >= 3) {
        improvements.push(`Hoàn thành ${lessonsCompleted} bài học trong tuần`);
    }
    
    return improvements;
}

function generateConcerns(studyTimeActual, studyTimeTarget, lessonsCompleted) {
    const concerns = [];
    
    if (studyTimeActual < studyTimeTarget * 0.8) {
        concerns.push('Thời gian học chưa đạt mục tiêu tuần');
    }
    
    if (lessonsCompleted < 2) {
        concerns.push('Số bài học hoàn thành ít hơn mong đợi');
    }
    
    return concerns;
}
