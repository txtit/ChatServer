const mongoose = require("mongoose");

// Model cho thông báo học tập
const NotificationSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    title: { 
        type: String, 
        required: true 
    },
    message: { 
        type: String, 
        required: true 
    },
    type: {
        type: String,
        enum: [
            'lesson_completed',
            'achievement_unlocked', 
            'streak_milestone',
            'quiz_result',
            'reminder',
            'system'
        ],
        default: 'system'
    },
    data: mongoose.Schema.Types.Mixed, // Additional data for the notification
    isRead: { 
        type: Boolean, 
        default: false 
    },
    readAt: { 
        type: Date 
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    }
}, { 
    timestamps: true,
    indexes: [
        { userId: 1, createdAt: -1 }, // For getting user notifications
        { userId: 1, isRead: 1 }, // For unread notifications
        { type: 1, createdAt: -1 } // For filtering by type
    ]
});

// Virtual để check if notification is recent (within 24 hours)
NotificationSchema.virtual('isRecent').get(function() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.createdAt > oneDayAgo;
});

// Method để đánh dấu đã đọc
NotificationSchema.methods.markAsRead = function() {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
};

// Static method để tạo notification mới
NotificationSchema.statics.createNotification = async function(userId, title, message, type = 'system', data = {}) {
    const notification = new this({
        userId,
        title,
        message,
        type,
        data
    });
    
    await notification.save();
    return notification;
};

// Static method để lấy unread notifications count
NotificationSchema.statics.getUnreadCount = async function(userId) {
    return this.countDocuments({ userId, isRead: false });
};

module.exports = mongoose.model("Notification", NotificationSchema);