const { verify } = require("jsonwebtoken");
const User = require("../models/user");
const FriendRequest = require("../models/friendRequest");
const { default: mongoose } = require("mongoose");
const AudioCall = require("../models/audioCall");
const VideoCall = require("../models/videoCall");

const { generateToken04 } = require("./zegoServerAssistant");

// Please change appID to your appId, appid is a number
// Example: 1234567890
const appID = process.env.ZEGO_APP_ID; // type: number

// Please change serverSecret to your serverSecret, serverSecret is string
// Example：'sdfsdfsd323sdfsdf'
const serverSecret = process.env.ZEGO_SERVER_SECRET; // type: 32 byte length string

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
    }).select("firstName lastName _id username friends");


    const this_user = req.user;
    const cur_user = {
        firstName: this_user.firstName,
        lastName: this_user.lastName,
        _id: this_user._id,
        token: this_user.token,
    };
    const remaining_users = all_users.filter(
        (user) =>
            !this_user.friends.includes(user._id) &&
            user._id.toString() !== req.user._id.toString()
    );

    res.status(200).json({
        status: "success",
        data: remaining_users,
        cur_user: cur_user,
        message: "User found successfully",
    });
};

exports.getUserById = async (req, res) => {
    try {
        // Lấy id từ request params
        const { id } = req.params;

        // Kiểm tra nếu id không được cung cấp
        if (!id) {
            return res.status(400).json({
                status: "fail",
                message: "User ID is required",
            });
        }
        const userid = new mongoose.Types.ObjectId(id);
        // Tìm người dùng theo id
        const user = await User.findById(userid).select("firstName lastName _id verified likePostId email username token arrayUserFollowed avatar ");

        // Kiểm tra nếu không tìm thấy người dùng
        if (!user) {
            return res.status(404).json({
                status: "fail",
                message: "User not found",
            });
        }

        // Trả thông tin người dùng
        return res.status(200).json({
            status: "success",
            data: user,
            message: "User found successfully",
        });
    } catch (error) {
        // Xử lý lỗi
        console.error("Error fetching user by ID:", error);
        return res.status(500).json({
            status: "error",
            message: "An error occurred while fetching the user",
        });
    }
};




// exports.getAll

exports.getFriends = async (req, res) => {
    const this_user = await User.findById(req.user._id).populate("friends",
        "_id firstName lastName username",
    );
    res.status(200).json({
        status: "success",
        data: this_user.friends,
        message: "Friend found successfully"
    });
}
exports.getFriendsById = async (req, res) => {
    const { id } = req.params;
    const userid = new mongoose.Types.ObjectId(id);
    const this_user = await User.findById(userid).populate("friends",
        "_id firstName lastName username avatar",
    );
    res.status(200).json({
        status: "success",
        data: this_user.friends,
        message: "Friend found successfully"
    });
}

exports.removeToken = async (req, res, next) => {
    const { id } = req.params;
    if (!id) {
        res.status(400).json({
            status: "failed",
            message: "id is null!",
        });
    }
    try {
        const userId = new mongoose.Types.ObjectId(id);
        const user = await User.findByIdAndUpdate(userId,
            { token: "" }, // Đảm bảo truyền giá trị mới cho `token`
            { new: true }
        )
        await user.save();
        res.status(200).json({
            status: "success",
            message: "Remove successfully!",
            data: user,
        });
    } catch (error) {
        res.status(401).json({
            status: "failed",
            message: error,
            data: user,
        });
    }

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

// const statusFollow = asyncHandler(async (req, res) => {
//     const { id, fid } = req.query;
//     try {
//         // console.log(id, fid);
//         const user = await User.findById(id);
//         if (!user) return res.status(404).json({ mes: 'User not found' });
//         if (!user.followsCountArr.includes(fid)) return res.status(200).json({ success: false, mes: 'This account is not followed yet.' });
//         return res.status(200).json({
//             success: true,
//             mes: 'This account was followed'
//         })
//     } catch (error) {
//         console.log('error at status follow ' + error);
//     }
// })

exports.getArrayFollower = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = new mongoose.Types.ObjectId(id);

        // Truy vấn FriendRequest với recipient là userId
        const requests = await FriendRequest.find({ recipient: userId })
            .populate("sender", "firstName lastName username avatar")
            .select("_id sender recipient createdAt");

        // console.log("Friend requests found:", requests);

        return res.status(200).json({
            status: "success",
            data: requests,
            count: requests.length,
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
exports.getArrayFollowing = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = new mongoose.Types.ObjectId(id);

        // Truy vấn FriendRequest với recipient là userId
        const requests = await FriendRequest.find({ sender: userId })
            .populate("recipient", "firstName lastName username verified avatar")
            .select("_id sender recipient createdAt");

        // console.log("Friend requests found:", requests);

        return res.status(200).json({
            status: "success",
            data: requests,
            count: requests.length,
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

/**
 * Authorization authentication token generation
 */

exports.generateZegoToken = async (req, res, next) => {
    try {
        const { userId, room_id } = req.body;

        console.log(userId, room_id, "from generate zego token");

        const effectiveTimeInSeconds = 3600; //type: number; unit: s; token expiration time, unit: second
        const payloadObject = {
            room_id, // Please modify to the user's roomID
            // The token generated allows loginRoom (login room) action
            // The token generated in this example allows publishStream (push stream) action
            privilege: {
                1: 1, // loginRoom: 1 pass , 0 not pass
                2: 1, // publishStream: 1 pass , 0 not pass
            },
            stream_id_list: null,
        }; //
        const payload = JSON.stringify(payloadObject);
        // Build token
        const token = generateToken04(
            appID * 1, // APP ID NEEDS TO BE A NUMBER
            userId,
            serverSecret,
            effectiveTimeInSeconds,
            payload
        );
        res.status(200).json({
            status: "success",
            message: "Token generated successfully",
            token,
        });
    } catch (err) {
        console.log(err);
    }
};

exports.startAudioCall = async (req, res, next) => {
    const from = req.user_id;
    const to = req.body.id;

    const from_user = await User.findById(from);
    const to_user = await User.findById(to);

    // create a new call audioCall Doc and send required data to client
    const new_audio_call = await AudioCall.create({
        participants: [from, to],
        from,
        to,
        status: "Ongoing",
    });

    res.status(200).json({
        data: {
            from: to_user,
            roomID: new_audio_call._id,
            streamID: to,
            userID: from,
            userName: from,
        },
    });
};

exports.startVideoCall = async (req, res, next) => {
    const from = req.user._id;
    const to = req.body.id;

    const from_user = await User.findById(from);
    const to_user = await User.findById(to);

    // create a new call videoCall Doc and send required data to client
    const new_video_call = await VideoCall.create({
        participants: [from, to],
        from,
        to,
        status: "Ongoing",
    });

    res.status(200).json({
        data: {
            from: to_user,
            roomID: new_video_call._id,
            streamID: to,
            userID: from,
            userName: from,
        },
    });
};

exports.getCallLogs = async (req, res, next) => {
    const user_id = req.user._id;

    const call_logs = [];

    const audio_calls = await AudioCall.find({
        participants: { $all: [user_id] },
    }).populate("from to");

    const video_calls = await VideoCall.find({
        participants: { $all: [user_id] },
    }).populate("from to");

    console.log(audio_calls, video_calls);

    for (let elm of audio_calls) {
        const missed = elm.verdict !== "Accepted";
        if (elm.from._id.toString() === user_id.toString()) {
            const other_user = elm.to;

            // outgoing
            call_logs.push({
                id: elm._id,
                img: other_user.avatar,
                name: other_user.firstName,
                online: true,
                incoming: false,
                missed,
            });
        } else {
            // incoming
            const other_user = elm.from;

            // outgoing
            call_logs.push({
                id: elm._id,
                img: other_user.avatar,
                name: other_user.firstName,
                online: true,
                incoming: false,
                missed,
            });
        }
    }

    for (let element of video_calls) {
        const missed = element.verdict !== "Accepted";
        if (element.from._id.toString() === user_id.toString()) {
            const other_user = element.to;

            // outgoing
            call_logs.push({
                id: element._id,
                img: other_user.avatar,
                name: other_user.firstName,
                online: true,
                incoming: false,
                missed,
            });
        } else {
            // incoming
            const other_user = element.from;

            // outgoing
            call_logs.push({
                id: element._id,
                img: other_user.avatar,
                name: other_user.firstName,
                online: true,
                incoming: false,
                missed,
            });
        }
    }

    res.status(200).json({
        status: "success",
        message: "Call Logs Found successfully!",
        data: call_logs,
    });
};