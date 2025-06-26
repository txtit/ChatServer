const express = require('express');
const router = express.Router();
const learningController = require('../controllers/learning');
const { extractUserId, requireAuth, validateObjectId, rateLimit } = require('../middleware/learningAuth');

// Apply middleware globally to all learning routes
router.use(extractUserId); // Extract userId from various sources
router.use(rateLimit(200, 60000)); // 200 requests per minute

// Middleware để log requests (optional)
const logRequest = (req, res, next) => {
    console.log(`📡 Learning API: ${req.method} ${req.path}`, {
        userId: req.userId,
        body: Object.keys(req.body).length > 0 ? req.body : undefined,
        params: Object.keys(req.params).length > 0 ? req.params : undefined
    });
    next();
};

router.use(logRequest);

/**
 * Learning Progress API Routes
 */

// 1. Khởi tạo progress cho lesson
// POST /api/learning/lessons/:lessonId/initialize
router.post('/lessons/:lessonId/initialize', 
    validateObjectId('lessonId'),
    requireAuth,
    learningController.initializeProgress
);

// 2. Cập nhật vị trí slide
// PUT /api/learning/lessons/:lessonId/slide-position
router.put('/lessons/:lessonId/slide-position', 
    validateObjectId('lessonId'),
    requireAuth,
    learningController.updateSlidePosition
);

// 3. Lấy tất cả progress của user
// GET /api/learning/users/:userId/progress
router.get('/users/:userId/progress', 
    validateObjectId('userId'),
    learningController.getAllUserProgress
);

// 4. Lấy progress chi tiết cho một lesson
// GET /api/learning/users/:userId/lessons/:lessonId/progress
router.get('/users/:userId/lessons/:lessonId/progress', 
    validateObjectId('userId'),
    validateObjectId('lessonId'),
    learningController.getLessonProgress
);

// 5. Bắt đầu session học tập
// POST /api/learning/lessons/:lessonId/sessions/start
router.post('/lessons/:lessonId/sessions/start', 
    validateObjectId('lessonId'),
    requireAuth,
    learningController.startLearningSession
);

// 6. Kết thúc session học tập
// PUT /api/learning/sessions/:sessionId/end
router.put('/sessions/:sessionId/end', 
    requireAuth,
    learningController.endLearningSession
);

// 7. Lưu kết quả quiz/exercise
// POST /api/learning/lessons/:lessonId/exercises/submit
router.post('/lessons/:lessonId/exercises/submit', 
    validateObjectId('lessonId'),
    requireAuth,
    learningController.submitExerciseResult
);

// 8. Lấy dashboard data
// GET /api/learning/users/:userId/dashboard
router.get('/users/:userId/dashboard', 
    validateObjectId('userId'),
    learningController.getUserDashboard
);

// 9. Bulk update progress
// POST /api/learning/progress/bulk-update
router.post('/progress/bulk-update', 
    requireAuth,
    learningController.bulkUpdateProgress
);

// 10. Reset progress (dev/admin only)
// DELETE /api/learning/users/:userId/lessons/:lessonId/progress
router.delete('/users/:userId/lessons/:lessonId/progress', 
    validateObjectId('userId'),
    validateObjectId('lessonId'),
    learningController.resetLessonProgress
);

/**
 * Additional helper routes
 */

// Health check cho learning service
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Learning API is healthy',
        timestamp: new Date(),
        service: 'learning-progress-api'
    });
});

// Get API documentation
router.get('/docs', (req, res) => {
    res.json({
        success: true,
        message: 'Learning Progress API Documentation',
        endpoints: {
            'POST /lessons/:lessonId/initialize': {
                description: 'Khởi tạo progress cho lesson',
                body: { totalSlides: 'number', lessonTitle: 'string', userId: 'string' }
            },
            'PUT /lessons/:lessonId/slide-position': {
                description: 'Cập nhật vị trí slide hiện tại',
                body: { slideIndex: 'number', slideId: 'string', userId: 'string' }
            },
            'GET /users/:userId/progress': {
                description: 'Lấy tất cả progress của user'
            },
            'GET /users/:userId/lessons/:lessonId/progress': {
                description: 'Lấy progress chi tiết cho một lesson'
            },
            'POST /lessons/:lessonId/sessions/start': {
                description: 'Bắt đầu session học tập',
                body: { userId: 'string', deviceInfo: 'object' }
            },
            'PUT /sessions/:sessionId/end': {
                description: 'Kết thúc session học tập',
                body: { exitReason: 'string', finalProgress: 'number' }
            },
            'POST /lessons/:lessonId/exercises/submit': {
                description: 'Lưu kết quả quiz/exercise',
                body: { exerciseId: 'string', score: 'number', type: 'quiz|exercise', userId: 'string' }
            },
            'GET /users/:userId/dashboard': {
                description: 'Lấy dashboard data cho user'
            },
            'POST /progress/bulk-update': {
                description: 'Bulk update nhiều progress cùng lúc',
                body: { userId: 'string', progressUpdates: 'array' }
            },
            'DELETE /users/:userId/lessons/:lessonId/progress': {
                description: 'Reset progress cho lesson (dev/admin only)'
            }
        }
    });
});

module.exports = router;
