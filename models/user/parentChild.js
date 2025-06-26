const mongoose = require("mongoose");

// Model định nghĩa mối quan hệ giữa phụ huynh và con
const ParentChildSchema = new mongoose.Schema({
    parentId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    childId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    relationship: { 
        type: String, 
        enum: ['parent', 'guardian', 'teacher'], 
        default: 'parent' 
    },
    permissions: {
        viewProgress: { type: Boolean, default: true },
        viewScores: { type: Boolean, default: true },
        addScores: { type: Boolean, default: true },
        setGoals: { type: Boolean, default: true },
        viewActivities: { type: Boolean, default: true }
    },
    status: {
        type: String,
        enum: ['active', 'pending', 'inactive'],
        default: 'active'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { 
    timestamps: true,
    indexes: [
        { parentId: 1, childId: 1 }, // Tìm children của parent
        { childId: 1, parentId: 1 }, // Tìm parents của child
        { parentId: 1, status: 1 }   // Tìm children active của parent
    ]
});

// Tạo unique index để đảm bảo không trùng lặp relationship
ParentChildSchema.index({ parentId: 1, childId: 1 }, { unique: true });

// Method để kiểm tra quyền
ParentChildSchema.methods.hasPermission = function(permission) {
    return this.permissions[permission] === true;
};

// Static method để tìm children của parent
ParentChildSchema.statics.findChildrenByParent = function(parentId) {
    return this.find({ parentId, status: 'active' }).populate('childId');
};

// Static method để tìm parents của child
ParentChildSchema.statics.findParentsByChild = function(childId) {
    return this.find({ childId, status: 'active' }).populate('parentId');
};

module.exports = mongoose.model("ParentChild", ParentChildSchema);
