// Export all models for easy importing
const User = require('./user/user');
const Slide = require('./Slide');

// Learning models
const Progress = require('./learn/progress');
const UserStats = require('./learn/userStats');
const LearningSession = require('./learn/learningSession');
const Lesson = require('./learn/lesson');
const Quiz = require('./learn/quiz');
const Curriculum = require('./learn/currculum');
const LearningPath = require('./learn/learningPath');
const Class = require('./learn/class');
const Game = require('./learn/game');
const Leaderboard = require('./learn/leaderboard');
const Notification = require('./learn/notification');
const Quest = require('./learn/quest');
const Reward = require('./learn/reward');

module.exports = {
    // Core models
    User,
    Slide,
    
    // Learning models
    Progress,
    UserStats,
    LearningSession,
    Lesson,
    Quiz,
    Curriculum,
    LearningPath,
    Class,
    Game,
    Leaderboard,
    Notification,
    Quest,
    Reward
};
