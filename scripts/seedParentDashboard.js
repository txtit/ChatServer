const mongoose = require('mongoose');
const User = require('../models/user/user');
const ParentChild = require('../models/user/parentChild');
const Scores = require('../models/learn/scores');
const Goals = require('../models/learn/goals');
const Achievement = require('../models/learn/achievements');
const UserAchievement = require('../models/learn/userAchievements');
const ActivityLog = require('../models/learn/activityLog');
const UserStats = require('../models/learn/userStats');

/**
 * Script to seed sample data for Parent Dashboard testing
 */

async function seedParentDashboardData() {
    try {
        console.log('🌱 Starting to seed Parent Dashboard data...');
        
        // 1. Create sample parent user
        const parent = await User.create({
            firstName: 'Nguyễn',
            lastName: 'Minh Tuấn',
            email: 'parent@example.com',
            role: 'parent',
            verified: true,
            password: 'password123'
        });
        console.log('✅ Created parent user:', parent.firstName, parent.lastName);
        
        // 2. Create sample children
        const child1 = await User.create({
            firstName: 'Nguyễn',
            lastName: 'Minh An',
            email: 'child1@example.com',
            role: 'student',
            age: 8,
            grade: 'Lớp 3A',
            verified: true,
            weeklyGoals: {
                studyTime: 180,
                lessons: 3
            }
        });
        
        const child2 = await User.create({
            firstName: 'Trần',
            lastName: 'Thị Bảo',
            email: 'child2@example.com',
            role: 'student',
            age: 9,
            grade: 'Lớp 4B',
            verified: true,
            weeklyGoals: {
                studyTime: 120,
                lessons: 2
            }
        });
        
        console.log('✅ Created children:', child1.firstName + ' ' + child1.lastName, child2.firstName + ' ' + child2.lastName);
        
        // 3. Create parent-child relationships
        await ParentChild.create({
            parentId: parent._id,
            childId: child1._id,
            relationship: 'parent'
        });
        
        await ParentChild.create({
            parentId: parent._id,
            childId: child2._id,
            relationship: 'parent'
        });
        
        console.log('✅ Created parent-child relationships');
        
        // 4. Create sample goals
        await Goals.createDefaultGoals(child1._id, parent._id, child1.age);
        await Goals.createDefaultGoals(child2._id, parent._id, child2.age);
        
        console.log('✅ Created default goals');
        
        // 5. Create sample scores
        const subjects = [
            { id: 'math', name: 'Toán học' },
            { id: 'english', name: 'Tiếng Anh' },
            { id: 'science', name: 'Khoa học' },
            { id: 'vietnamese', name: 'Tiếng Việt' }
        ];
        
        const scoreData = [
            // Child 1 scores
            { userId: child1._id, subject: 'math', subjectName: 'Toán học', scores: [8.5, 9.0, 7.5, 8.0, 9.5] },
            { userId: child1._id, subject: 'english', subjectName: 'Tiếng Anh', scores: [7.0, 8.5, 8.0, 9.0, 8.5] },
            { userId: child1._id, subject: 'science', subjectName: 'Khoa học', scores: [8.0, 8.5, 9.0, 8.5, 9.0] },
            
            // Child 2 scores
            { userId: child2._id, subject: 'math', subjectName: 'Toán học', scores: [7.0, 7.5, 8.0, 7.5, 8.5] },
            { userId: child2._id, subject: 'english', subjectName: 'Tiếng Anh', scores: [8.0, 8.5, 9.0, 8.5, 9.0] },
            { userId: child2._id, subject: 'vietnamese', subjectName: 'Tiếng Việt', scores: [8.5, 9.0, 8.0, 8.5, 9.5] }
        ];
        
        for (const data of scoreData) {
            for (let i = 0; i < data.scores.length; i++) {
                const score = data.scores[i];
                const date = new Date();
                date.setDate(date.getDate() - (data.scores.length - i - 1) * 2); // Spread over past days
                
                await Scores.create({
                    userId: data.userId,
                    subject: data.subject,
                    subjectName: data.subjectName,
                    grade: 3,
                    score,
                    assessmentType: ['test', 'homework', 'practice'][i % 3],
                    addedBy: parent._id,
                    addedByType: 'parent',
                    createdAt: date
                });
            }
        }
        
        console.log('✅ Created sample scores');
        
        // 6. Create sample activity logs
        const activities = [
            // Child 1 activities
            {
                userId: child1._id,
                activityType: 'test',
                subject: 'math',
                subjectName: 'Toán học',
                score: 9.5,
                description: 'Hoàn thành bài kiểm tra Toán',
                duration: 30 * 60 * 1000, // 30 minutes
                createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
            },
            {
                userId: child1._id,
                activityType: 'lesson_complete',
                subject: 'english',
                subjectName: 'Tiếng Anh',
                description: 'Hoàn thành bài học Tiếng Anh',
                duration: 45 * 60 * 1000, // 45 minutes
                createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
            },
            
            // Child 2 activities
            {
                userId: child2._id,
                activityType: 'practice',
                subject: 'english',
                subjectName: 'Tiếng Anh',
                score: 8.5,
                description: 'Học từ vựng Tiếng Anh',
                duration: 25 * 60 * 1000, // 25 minutes
                createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago
            },
            {
                userId: child2._id,
                activityType: 'homework',
                subject: 'vietnamese',
                subjectName: 'Tiếng Việt',
                score: 9.0,
                description: 'Bài tập về nhà Tiếng Việt',
                duration: 40 * 60 * 1000, // 40 minutes
                createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
            }
        ];
        
        for (const activity of activities) {
            await ActivityLog.create(activity);
        }
        
        console.log('✅ Created sample activities');
        
        // 7. Create sample achievements
        const achievements = [
            {
                id: 'math_excellence',
                title: 'Toán học xuất sắc',
                description: 'Đạt điểm trung bình trên 8.5 trong 5 bài kiểm tra Toán liên tiếp',
                icon: '🏆',
                category: 'academic',
                conditions: {
                    type: 'average_score',
                    value: 8.5,
                    subject: 'math'
                }
            },
            {
                id: 'consistency_streak',
                title: 'Tiến bộ vượt bậc',
                description: 'Học đều đặn 7 ngày liên tiếp',
                icon: '🔥',
                category: 'consistency',
                conditions: {
                    type: 'consecutive_days',
                    value: 7
                }
            },
            {
                id: 'english_champion',
                title: 'Tiếng Anh giỏi',
                description: 'Đạt điểm 9.0 trở lên trong 3 bài kiểm tra Tiếng Anh',
                icon: '🌟',
                category: 'academic',
                conditions: {
                    type: 'average_score',
                    value: 9.0,
                    subject: 'english'
                }
            },
            {
                id: 'first_lesson',
                title: 'Bước đầu tiên',
                description: 'Hoàn thành bài học đầu tiên',
                icon: '🎯',
                category: 'milestone',
                conditions: {
                    type: 'lessons_completed',
                    value: 1
                }
            }
        ];
        
        for (const achievement of achievements) {
            await Achievement.create(achievement);
        }
        
        console.log('✅ Created sample achievements');
        
        // 8. Award some achievements to children
        await UserAchievement.addAchievement(child1._id, 'math_excellence', {
            scoreValue: 8.7
        });
        
        await UserAchievement.addAchievement(child1._id, 'first_lesson', {
            lessonId: 'sample_lesson_1'
        });
        
        await UserAchievement.addAchievement(child2._id, 'english_champion', {
            scoreValue: 9.0
        });
        
        await UserAchievement.addAchievement(child2._id, 'first_lesson', {
            lessonId: 'sample_lesson_2'
        });
        
        console.log('✅ Awarded sample achievements');
        
        // 9. Create/update user stats
        const userStats1 = await UserStats.create({
            userId: child1._id,
            totalLessonsCompleted: 12,
            totalTimeSpent: 145 * 60 * 1000, // 145 minutes in milliseconds
            averageScore: 8.5,
            currentStreak: 5,
            totalSessions: 15,
            subjectStats: [
                {
                    subject: 'math',
                    subjectName: 'Toán học',
                    lessonsCompleted: 5,
                    averageScore: 8.5,
                    timeSpent: 60 * 60 * 1000,
                    lastActivity: new Date()
                },
                {
                    subject: 'english',
                    subjectName: 'Tiếng Anh',
                    lessonsCompleted: 4,
                    averageScore: 8.2,
                    timeSpent: 50 * 60 * 1000,
                    lastActivity: new Date()
                }
            ],
            subjectAverages: {
                math: 8.5,
                english: 8.2,
                science: 8.6
            }
        });
        
        const userStats2 = await UserStats.create({
            userId: child2._id,
            totalLessonsCompleted: 8,
            totalTimeSpent: 95 * 60 * 1000, // 95 minutes in milliseconds
            averageScore: 8.3,
            currentStreak: 3,
            totalSessions: 10,
            subjectStats: [
                {
                    subject: 'math',
                    subjectName: 'Toán học',
                    lessonsCompleted: 3,
                    averageScore: 7.7,
                    timeSpent: 40 * 60 * 1000,
                    lastActivity: new Date()
                },
                {
                    subject: 'english',
                    subjectName: 'Tiếng Anh',
                    lessonsCompleted: 3,
                    averageScore: 8.6,
                    timeSpent: 35 * 60 * 1000,
                    lastActivity: new Date()
                },
                {
                    subject: 'vietnamese',
                    subjectName: 'Tiếng Việt',
                    lessonsCompleted: 2,
                    averageScore: 9.0,
                    timeSpent: 20 * 60 * 1000,
                    lastActivity: new Date()
                }
            ],
            subjectAverages: {
                math: 7.7,
                english: 8.6,
                vietnamese: 9.0
            }
        });
        
        console.log('✅ Created user stats');
        
        console.log('🎉 Successfully seeded Parent Dashboard data!');
        console.log('\n📊 Summary:');
        console.log(`- Parent: ${parent.email}`);
        console.log(`- Children: ${child1.email}, ${child2.email}`);
        console.log(`- Total scores created: ${scoreData.reduce((total, data) => total + data.scores.length, 0)}`);
        console.log(`- Total activities created: ${activities.length}`);
        console.log(`- Total achievements created: ${achievements.length}`);
        
        return {
            parent,
            children: [child1, child2],
            success: true
        };
        
    } catch (error) {
        console.error('❌ Error seeding data:', error);
        throw error;
    }
}

// If running this script directly
if (require.main === module) {
    const connectDB = async () => {
        try {
            await mongoose.connect(process.env.DATABASE_URL || 'mongodb://localhost:27017/chat-app', {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });
            console.log('✅ Connected to MongoDB');
        } catch (error) {
            console.error('❌ MongoDB connection error:', error);
            process.exit(1);
        }
    };
    
    connectDB().then(async () => {
        try {
            await seedParentDashboardData();
            process.exit(0);
        } catch (error) {
            console.error('❌ Seeding failed:', error);
            process.exit(1);
        }
    });
}

module.exports = seedParentDashboardData;
