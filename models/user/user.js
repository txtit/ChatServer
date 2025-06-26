const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, "First Name is required"],
    },
    lastName: {
        type: String,
        required: [true, "Last Name is required"],
    },
    username: {
        type: String,
        unique: true,
    },
    about: {
        type: String,
    },
    avatar: {
        type: String,
    },
    email: {
        type: String,
        required: [true, "Email is required"],
        validate: {
            validator: function (email) {
                return String(email)
                    .toLowerCase()
                    .match(
                        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
                    );
            },
            message: (props) => `Email (${props.value}) is invalid!`,
        },
    },
    password: {
        // unselect
        type: String,
    },
    passwordChangedAt: {
        // unselect
        type: Date,
    },
    passwordResetToken: {
        // unselect
        type: String,
    },
    passwordResetExpires: {
        // unselect
        type: Date,
    },
    createdAt: {
        type: Date,
        default: Date.now(),
    },
    updatedAt: {
        // unselect
        type: Date,
    },
    verified: {
        type: Boolean,
        default: false,
    },
    otp: {
        type: String,
    },
    otp_expiry_time: {
        type: Date,
    },
    friends: [
        {
            type: mongoose.Schema.ObjectId,
            ref: "User",
        },
    ],
    arrayUserFollowed: [
        {
            type: mongoose.Schema.ObjectId,
            ref: "User",
        },
    ],
    socket_id: {
        type: String
    },
    status: {
        type: String,
        enum: ["Online", "Offline"]
    },
    likePostId: [{
        type: mongoose.Types.ObjectId,
        ref: 'Post'
    }],
    token: {
        type: String
    },    age: { type: Number, min: 6, max: 10 }, // Độ tuổi target
    grade: { type: String }, // "Lớp 5A", "Lớp 4B"
    parentEmail: { type: String }, // Email phụ huynh
    learningLevel: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
    totalXP: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    badges: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Badge' }],
    
    // Role và relationships
    role: { 
        type: String, 
        enum: ['student', 'parent', 'teacher', 'admin'], 
        default: 'student' 
    },
    parentIds: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }],
    childrenIds: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }],
    
    // Weekly goals
    weeklyGoals: {
        studyTime: { type: Number, default: 180 }, // phút
        lessons: { type: Number, default: 3 }
    },
    
    parentalControls: {
        dailyTimeLimit: { type: Number, default: 60 }, // phút
        allowedHours: {
            start: { type: String, default: '08:00' },
            end: { type: String, default: '20:00' }
        }
    },
    // Thêm các trường khác nếu cần
});

userSchema.pre("save", async function (next) {
    // Only run this function if password was actually modified
    if (!this.isModified("otp") || !this.otp) return next();

    // Hash the otp with cost of 12
    this.otp = await bcrypt.hash(this.otp.toString(), 12);

    console.log(this.otp.toString(), "FROM PRE SAVE HOOK");

    next();
});

userSchema.pre("save", async function (next) {
    // Only run this function if password was actually modified
    if (!this.isModified("password") || !this.password) return next();

    // Hash the password with cost of 12
    this.password = await bcrypt.hash(this.password, 12);

    console.log(this.password.toString(), "password");
    //! Shift it to next hook // this.passwordChangedAt = Date.now() - 1000;

    next();
});

userSchema.pre("save", function (next) {
    if (!this.isModified("password") || this.isNew || !this.password)
        return next();

    this.passwordChangedAt = Date.now() - 1000;
    next();
});

userSchema.methods.correctPassword = async function (
    candidatePassword,
    userPassword
) {
    return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.correctOTP = async function (candidateOTP, userOTP) {
    return await bcrypt.compare(candidateOTP, userOTP);
};

userSchema.methods.changedPasswordAfter = function (JWTTimeStamp) {
    if (this.passwordChangedAt) {
        const changedTimeStamp = parseInt(
            this.passwordChangedAt.getTime() / 1000,
            10
        );
        return JWTTimeStamp < changedTimeStamp;
    }

    // FALSE MEANS NOT CHANGED
    return false;
};

userSchema.methods.createPasswordResetToken = function () {
    const resetToken = crypto.randomBytes(32).toString("hex");

    this.passwordResetToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

    this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

    return resetToken;
};

const User = new mongoose.model("User", userSchema);
module.exports = User;