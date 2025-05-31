const mongoose = require("mongoose");

const classSchema = new mongoose.Schema({
    name: String,
    subject: String,
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    assignments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Assignment" }]
}, { timestamps: true });

module.exports = mongoose.model("Class", classSchema);