const { verify } = require("jsonwebtoken");
const User = require("../models/user");
const FriendRequest = require("../models/friendRequest");
const { default: mongoose } = require("mongoose");

exports.updateMe = async (req, res, next) => {
    const filteredBody = filterObj(
        req.body,
        "firstName",
        "lastName",
        "about",
        "avatar"
    );



    const userDoc = await User.findByIdAndUpdate(req.user._id, filteredBody);

    res.status(200).json({
        status: "success",
        data: userDoc,
        message: "User Updated successfully"
    });
};



exports.getUsers = async (req, res) => {

    const all_users = await User.find({
        verified: true
    }).select("firstName lastName _id");


    const this_user = req.user;
    const remaining_users = all_users.filter(
        (user) =>
            !this_user.friends.includes(user._id) &&
            user._id.toString() !== req.user._id.toString()
    );

    res.status(200).json({
        status: "success",
        data: remaining_users,
        message: "User found successfully",
    });
};



// exports.getAll

exports.getFriends = async (req, res) => {
    const this_user = await User.findById(req.user._id).populate("friends",
        "_id firstName lastName",
    );
    res.status(200).json({
        status: "success",
        data: this_user.friends,
        message: "Friend found successfully"
    });
}

exports.getRequest = async (req, res) => {
    try {
        const userId = new mongoose.Types.ObjectId(req.user._id);

        // Truy vấn FriendRequest với recipient là userId
        const requests = await FriendRequest.find({ recipient: userId })
            .populate("sender", "firstName lastName")
            .select("_id sender recipient createdAt");

        // console.log("Friend requests found:", requests);

        return res.status(200).json({
            status: "success",
            data: requests,
            message: "Request found successfully"
        });
    } catch (error) {
        console.error("Error fetching friend requests:", error);
        res.status(500).json({
            status: "error",
            message: "Could not fetch friend requests"
        });
    }
};

