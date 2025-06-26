const express = require('express');
const router = express.Router();
const parentController = require('../controllers/parent');
const { protect } = require('../middleware/learningAuth'); // Assuming you have auth middleware

/**
 * Parent Dashboard Routes
 * Base path: /api/parent
 */

// Children management routes
router.get('/children', protect, parentController.getChildren);
router.get('/children/:childId/progress', protect, parentController.getChildProgress);
router.get('/children/:childId/scores', protect, parentController.getChildScores);
router.post('/children/:childId/scores', protect, parentController.addChildScore);
router.get('/children/:childId/activities', protect, parentController.getChildActivities);
router.get('/children/:childId/achievements', protect, parentController.getChildAchievements);
router.get('/children/:childId/weekly-report', protect, parentController.getWeeklyReport);

// Dashboard summary
router.get('/dashboard/summary', protect, parentController.getDashboardSummary);

// Goals management (to be implemented)
router.get('/children/:childId/goals', protect, (req, res) => {
    res.status(501).json({
        success: false,
        message: 'Goals API endpoint not implemented yet'
    });
});

router.put('/children/:childId/goals', protect, (req, res) => {
    res.status(501).json({
        success: false,
        message: 'Goals API endpoint not implemented yet'
    });
});

// Study time analytics (to be implemented)
router.get('/children/:childId/study-time', protect, (req, res) => {
    res.status(501).json({
        success: false,
        message: 'Study time analytics API endpoint not implemented yet'
    });
});

// Subject list
router.get('/children/:childId/subjects', protect, (req, res) => {
    // Return static subject list for now
    res.status(200).json({
        success: true,
        data: [
            {
                id: 'math',
                name: 'Toán học',
                color: '#FF6B6B'
            },
            {
                id: 'english',
                name: 'Tiếng Anh',
                color: '#4ECDC4'
            },
            {
                id: 'science',
                name: 'Khoa học',
                color: '#45B7D1'
            },
            {
                id: 'vietnamese',
                name: 'Tiếng Việt',
                color: '#96CEB4'
            }
        ]
    });
});

// Recent activities across all children
router.get('/activities/recent', protect, async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const parentId = req.user._id;
        
        const ParentChild = require('../models/user/parentChild');
        const ActivityLog = require('../models/learn/activityLog');
        
        // Get all children of this parent
        const relationships = await ParentChild.findChildrenByParent(parentId);
        const childIds = relationships.map(rel => rel.childId._id);
        
        if (childIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }
        
        // Get recent activities
        const activities = await ActivityLog.find({
            userId: { $in: childIds }
        })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .populate('userId', 'firstName lastName');
        
        res.status(200).json({
            success: true,
            data: activities.map(activity => ({
                childId: activity.userId._id,
                childName: `${activity.userId.firstName} ${activity.userId.lastName}`,
                activity: activity.description,
                score: activity.score,
                subject: activity.subjectName,
                timestamp: activity.createdAt
            }))
        });
    } catch (error) {
        console.error('Error getting recent activities:', error);
        res.status(500).json({
            success: false,
            message: 'Lỗi khi lấy hoạt động gần đây',
            error: error.message
        });
    }
});

module.exports = router;
