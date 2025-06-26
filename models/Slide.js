const mongoose = require('mongoose');

const SlideSchema = new mongoose.Schema({
    curriculumId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Curriculum',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    grade: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    content: {
        type: Object,
        required: true
    },
    
    // Thông tin slide
    slideCount: { type: Number, default: 0 }, // Tổng số slide trong bài học này
    estimatedDuration: { type: Number, default: 0 }, // Thời gian ước tính (phút)
    difficulty: { 
        type: String, 
        enum: ['Dễ', 'Trung bình', 'Khó'], 
        default: 'Trung bình' 
    },
    
    // Thống kê
    viewCount: { type: Number, default: 0 },
    completionRate: { type: Number, default: 0 }, // % người dùng hoàn thành
    averageScore: { type: Number, default: 0 }, // Điểm trung bình
    averageTimeSpent: { type: Number, default: 0 }, // Thời gian học trung bình (phút)
    
    // Metadata cho SEO và tìm kiếm
    description: { type: String },
    tags: [String],
    keywords: [String],
    
    // Trạng thái
    isPublished: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    
    // Thêm trạng thái tạo hình ảnh
    imageGenerationStatus: {
        type: String,
        enum: ['not_started', 'pending', 'processing', 'completed', 'failed'],
        default: 'not_started'
    },
    
    // Thông tin tác giả
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    created: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    // Tạo các index để tìm kiếm nhanh hơn
    indexes: [
        { subject: 1, grade: 1 }, // Tìm theo môn học và lớp
        { title: 'text', description: 'text', tags: 'text' }, // Text search
        { isPublished: 1, isDeleted: 1, created: -1 }, // Lấy bài học công khai
        { createdBy: 1, created: -1 }, // Bài học của tác giả
        { viewCount: -1 }, // Sắp xếp theo popularity
        { completionRate: -1 } // Sắp xếp theo completion rate
    ]
});

// Virtual để tính engagement rate
SlideSchema.virtual('engagementRate').get(function() {
    if (this.viewCount === 0) return 0;
    return (this.completionRate * this.averageScore) / 100;
});

// Method để cập nhật thống kê
SlideSchema.methods.updateStats = async function() {
    const Progress = mongoose.model('Progress');
    
    // Tính completion rate
    const totalUsers = await Progress.countDocuments({ lessonId: this._id });
    const completedUsers = await Progress.countDocuments({ 
        lessonId: this._id, 
        isCompleted: true 
    });
    
    this.completionRate = totalUsers > 0 ? (completedUsers / totalUsers) * 100 : 0;
    
    // Tính average score
    const avgScoreResult = await Progress.aggregate([
        { $match: { lessonId: this._id, overallScore: { $ne: null } } },
        { $group: { _id: null, avgScore: { $avg: '$overallScore' } } }
    ]);
    
    this.averageScore = avgScoreResult.length > 0 ? Math.round(avgScoreResult[0].avgScore) : 0;
    
    // Tính average time spent
    const avgTimeResult = await Progress.aggregate([
        { $match: { lessonId: this._id, totalTimeSpent: { $gt: 0 } } },
        { $group: { _id: null, avgTime: { $avg: '$totalTimeSpent' } } }
    ]);
    
    this.averageTimeSpent = avgTimeResult.length > 0 ? 
        Math.round(avgTimeResult[0].avgTime / (1000 * 60)) : 0; // Convert to minutes
    
    this.updatedAt = new Date();
    return this.save();
};

// Pre-save middleware để cập nhật updatedAt
SlideSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Slide', SlideSchema);