/**
 * Auth middleware cho Learning API
 * Có thể dùng JWT hoặc session-based auth
 */

// Simple middleware để extract userId từ request
const extractUserId = (req, res, next) => {
    // Method 1: Từ JWT token (nếu có)
    if (req.headers.authorization) {
        try {
            const token = req.headers.authorization.split(' ')[1]; // Bearer <token>
            
            // Check for test token in development
            if (token && token.startsWith('test-token-') && process.env.NODE_ENV !== 'production') {
                req.userId = 'test-parent-user-123'; // Use test user ID
                console.log('🔧 Using test token with userId:', req.userId);
                return next();
            }
            
            // Decode JWT và lấy userId
            // const decoded = jwt.verify(token, process.env.JWT_SECRET);
            // req.userId = decoded.userId;
            
            // Temporary: extract userId from token (implement proper JWT verification)
            console.log('🔐 Auth token detected:', token);
        } catch (error) {
            console.warn('⚠️ Invalid JWT token:', error.message);
        }
    }
    
    // Method 2: Từ query params (dev/testing)
    if (req.query.userId && !req.userId) {
        req.userId = req.query.userId;
        console.log('🔐 Using userId from query:', req.userId);
    }
    
    // Method 3: Từ request body (fallback)
    if (req.body.userId && !req.userId) {
        req.userId = req.body.userId;
        console.log('🔐 Using userId from body:', req.userId);
    }
    
    // Method 4: Từ URL params
    if (req.params.userId && !req.userId) {
        req.userId = req.params.userId;
        console.log('🔐 Using userId from params:', req.userId);
    }
    
    next();
};

// Middleware để require authentication
const requireAuth = (req, res, next) => {
    if (!req.userId && !req.body.userId && !req.params.userId) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required - userId not found'
        });
    }
    next();
};

// Middleware để validate ObjectId format
const validateObjectId = (paramName) => {
    return (req, res, next) => {
        const id = req.params[paramName];
        if (id && !id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({
                success: false,
                message: `Invalid ${paramName} format`
            });
        }
        next();
    };
};

// Rate limiting middleware (simple in-memory implementation)
const rateLimitMap = new Map();

const rateLimit = (maxRequests = 100, windowMs = 60000) => {
    return (req, res, next) => {
        const key = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        
        if (!rateLimitMap.has(key)) {
            rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
            return next();
        }
        
        const userData = rateLimitMap.get(key);
        
        if (now > userData.resetTime) {
            userData.count = 1;
            userData.resetTime = now + windowMs;
            return next();
        }
        
        if (userData.count >= maxRequests) {
            return res.status(429).json({
                success: false,
                message: 'Too many requests, please try again later'
            });
        }
        
        userData.count++;
        next();    };
};

// Auth middleware cho protected routes
const protect = (req, res, next) => {
    try {
        // Kiểm tra Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access denied. No token provided.'
            });
        }
        
        const token = authHeader.split(' ')[1];
        
        // Check for test token in development
        if (token && token.startsWith('test-token-') && process.env.NODE_ENV !== 'production') {
            req.user = {
                _id: '670ddbe80ef54ecd786783fe',
                role: 'parent',
                email: 'test-parent@example.com',
                name: 'Test Parent'
            };
            console.log('🔧 Test token authenticated for user:', req.user.email);
            return next();
        }
        
        // TODO: Implement proper JWT verification
        // For now, we'll accept any token and create a mock user
        // const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Mock user for development (replace with real JWT verification)
        req.user = {
            _id: '670ddbe80ef54ecd786783fe', // Mock parent ID
            role: 'parent',
            email: 'parent@example.com'
        };
        
        console.log('🔐 Auth middleware: User authenticated', req.user.email);
        next();
    } catch (error) {
        console.error('❌ Auth middleware error:', error);
        return res.status(401).json({
            success: false,
            message: 'Invalid token.'
        });
    }
};

module.exports = {
    extractUserId,
    requireAuth,
    validateObjectId,
    rateLimit,
    protect
};
