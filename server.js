const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });

const path = require("path");

process.on("uncaughtException", (err) => {
    console.log(err);
    console.log("UNCAUGHT Exception! Shutting down ...");
    process.exit(1); // Exit Code 1 indicates that a container shut down, either because of an application failure.
});

const app = require("./app");

const http = require("http");
const server = http.createServer(app);

const { Server } = require("socket.io");
const { promisify } = require("util");
const User = require("./models/user");
const FriendRequest = require("./models/friendRequest");
const OneToOneMessage = require("./models/OneToOneMessage");
const VideoCall = require("./models/videoCall");
const AudioCall = require("./models/audioCall");

const io = new Server(server, {
    cors: {
        origin: "http://localhost:3001",
        methos: ["GET", "POST"],
    },
});




const DB = process.env.DATABASE.replace(
    "<PASSWORD>",
    process.env.DATABASE_PASSWORD
);

mongoose
    .connect(DB, {
        // useNewUrlParser: true, // The underlying MongoDB driver has deprecated their current connection string parser. Because this is a major change, they added the useNewUrlParser flag to allow users to fall back to the old parser if they find a bug in the new parser.
        // useCreateIndex: true, // Again previously MongoDB used an ensureIndex function call to ensure that Indexes exist and, if they didn't, to create one. This too was deprecated in favour of createIndex . the useCreateIndex option ensures that you are using the new function calls.
        // useFindAndModify: false, // findAndModify is deprecated. Use findOneAndUpdate, findOneAndReplace or findOneAndDelete instead.
        // useUnifiedTopology: true, // Set to true to opt in to using the MongoDB driver's new connection management engine. You should set this option to true , except for the unlikely case that it prevents you from maintaining a stable connection.
    })
    .then((con) => {
        console.log("DB Connection successful");
    });

const port = process.env.PORT || 8000;

server.listen(port, () => {
    console.log(`App running on port ${port} ...`);
});

io.on("connection", async (socket) => {

    console.log("new connection:", socket.id);
    const user_id = socket.handshake.query["user_id"];

    const socket_id = socket.id;

    if (Boolean(user_id)) {
        await User.findByIdAndUpdate(user_id, { socket_id: socket_id, status: "Online" })
    }
    // we can write our socket event listeners here...
    socket.on("friend_request", async (data, callback) => {
        try {
            console.log("request", data);

            // const existingRequest = FriendRequest.findOne({
            //     sender: data.from,
            //     recipient: data.to
            // })

            // if (existingRequest) {
            //     return callback({ message: "Friend request already sent" });
            // }

            const to = await User.findById(data.to).select("socket_id");
            const from = await User.findById(data.from).select("socket_id");

            if (to?.socket_id) {
                io.to(to.socket_id).emit("new_friend_request", {
                    message: "New friend request received",
                });
            }

            if (from?.socket_id) {
                io.to(from.socket_id).emit("request_send", {
                    message: "Request send successfully",
                    to: to
                });
            }

            // Create a new friend request
            await FriendRequest.create({
                sender: data.from,
                recipient: data.to
            });

            callback(null, { success: true });
        } catch (error) {
            console.error("error in friend_request", error);
            callback(error)
        }

    });

    socket.on("cancel_send_request", async (data, callback) => {
        try {
            console.log("request", data);
            const to = await User.findById(data.to).select("socket_id");
            const from = await User.findById(data.from).select("socket_id");
            if (from?.socket_id) {
                io.to(from.socket_id).emit("request_send_cancel", {
                    message: "Request cancel send successfully",
                    to: to,
                });
            }
            const exitsting_request = await FriendRequest.findOne({
                sender: from._id,
                recipient: to._id
            })
            // Create a new friend request
            console.log(exitsting_request)
            await FriendRequest.findByIdAndDelete(exitsting_request._id);
            callback(null, { success: true });
        } catch (error) {
            console.error("error in friend_request", error);
            callback(error)
        }

    });


    socket.on("accept_request", async (data) => {
        console.log("accept", data);
        const requestId = new mongoose.Types.ObjectId(data.request_id);
        const request_doc = await FriendRequest.findById(requestId);
        console.log(data.request_id);
        console.log('docs', request_doc);

        const sender = await User.findById(request_doc.sender);
        const receiver = await User.findById(request_doc.recipient);

        //save new friends
        sender.friends.push(request_doc.recipient);
        receiver.friends.push(request_doc.sender);

        await receiver.save({ new: true, validateModifiedOnly: true });
        await sender.save({ new: true, validateModifiedOnly: true });


        await FriendRequest.findByIdAndDelete(data.request_id);

        io.to(sender.socket_id).emit("request_accepted", {
            message: "Friend Request Accepted",
        });
        io.to(receiver.socket_id).emit("request_accepted", {
            message: "Accepting Successfull",
        });

    });
    socket.on("get_direct_conversations", async ({ user_id }, callback) => {
        try {
            console.log(user_id);
            const userId = new mongoose.Types.ObjectId(user_id);
            console.log(userId);

            // Kiểm tra xem user_id có tồn tại không
            if (!userId) {
                return callback({ error: "User ID is missing" });
            }

            // Truy vấn các cuộc trò chuyện có user_id trong danh sách participants và có tin nhắn
            const existing_conversations = await OneToOneMessage.find({
                participants: { $all: [userId] },
                // messages: { $exists: true, $ne: [] }
            }).populate("participants", "firstName lastName _id email status");

            console.log("Existing conversations:", existing_conversations);

            // Trả về danh sách các cuộc trò chuyện qua callback
            callback(existing_conversations);
        } catch (error) {
            console.error("Error fetching conversations:", error);
            callback({ error: "Failed to fetch conversations" });
        }
    });


    socket.on("start_conversations", async (data) => {
        // data : {to:from:}
        const { to, from } = data;

        // check if there us any existing conversation 

        const exitsting_conversations = await OneToOneMessage.find({
            participants: { $size: 2, $all: [to, from] },
        }).populate("participants", "firstName lastName _id email status");
        console.log("hehe", exitsting_conversations)

        // if no => create a new OneToOneMesaage doc & emit event "start_chat" & send conversation details as payload
        if (exitsting_conversations.length === 0) {

            let new_chat = await OneToOneMessage.create({
                participants: [to, from],
            });

            new_chat = await OneToOneMessage.findById(new_chat).populate(
                "participants",
                "firstName lastName _id email status"
            );
            console.log(exitsting_conversations[0], 'Exustubg Conversation');

            console.log(new_chat);

            socket.emit("start_chat", new_chat);



        }

        // if yes => just emit event " start_chat" & send conversation details as payload
        else {
            socket.emit("start_chat", exitsting_conversations[0]);
        }
    });

    socket.on("delete_conversations", async (data) => {
        // data : {to:from:}
        const { to, from } = data;

        // check if there us any existing conversation 

        const exitsting_conversations = await OneToOneMessage.find({
            participants: { $size: 2, $all: [to, from] },
        }).populate("participants", "firstName lastName _id email status");
        console.log("hehe", exitsting_conversations.map(con => con._id))

        try {
            const conversationId = exitsting_conversations.map(con => con._id);
            const conversation = await OneToOneMessage.findById(conversationId);

            if (!conversation) {
                return socket.emit("delete_chat_fail", { message: "Conversation not found" });
            }

            // Kiểm tra xem người dùng đã có trong danh sách `deletion` chưa
            const alreadyDeleted = conversation.delettion.some(
                (entry) => entry.from.toString() === from
            );

            if (!alreadyDeleted) {
                // Thêm thông tin xóa vào mảng `deletion`
                conversation.delettion.push({ from: from, deletedAt: new Date() });
                await conversation.save();
            } else {
                // Nếu đã xóa trước đó, cập nhật thời gian xóa mới và người xóa
                const deletionEntry = conversation.delettion.find(entry => entry.from.toString() === from);
                if (deletionEntry) {
                    // Cập nhật lại thời gian xóa cho người xóa này
                    deletionEntry.deletedAt = new Date();
                    await conversation.save();
                }

            }

            socket.emit("delete_chat_success", { message: "Conversation marked as deleted" });
        } catch (err) {
            console.log("error delete chat", err);
        }

    });




    socket.on("get_messages", async (data, callback) => {
        try {
            console.log("dâtnek", data)
            const conversation = await OneToOneMessage.findById(data.conversation_id);

            if (!conversation) {
                return socket.emit("fetch_messages_fail", { message: "Conversation not found" });
            }

            // Lấy thời gian xóa của người dùng (nếu có)
            const deletionEntry = conversation.delettion.find(
                (entry) => entry.from.toString() === data.user_id
            );

            const deletedAt = deletionEntry ? deletionEntry.deletedAt : null;

            // Lọc tin nhắn dựa trên thời gian xóa
            const filteredMessages = deletedAt
                ? conversation.messages.filter((msg) => msg.created_at - deletedAt > 0)
                : conversation.messages;
            // const { messages } = await OneToOneMessage.findById(
            //     data.conversation_id
            // ).select("messages");
            console.log("mes", deletedAt)
            console.log("mes", deletedAt)
            callback(filteredMessages)
        } catch (error) {
            console.log(error);
        }
    });

    // Handle text/ link message

    socket.on("text_message", async (data) => {
        try {
            console.log("Received Message", data);
            // data: {to,from ,text}
            const { message, conversation_id, from, to, type } = data;
            const to_user = await User.findById(to);
            const from_user = await User.findById(from);
            // message => {to,from,type,created_at,text,file}
            // fecth OneToOneMessage Doc & push a new message to exitsting conversation 
            const chat = await OneToOneMessage.findOne({
                participants: { $size: 2, $all: [to, from] },
            });
            if (!chat) {
                chat = await OneToOneMessage.create({
                    participants: [to, from],
                    messages: []
                })
            }
            console.log("chattttttttttttttt", chat);
            const new_message = {
                to: to,
                from: from,
                created_at: Date.now(),
                text: message
            }
            chat.messages.push(new_message);
            await chat?.save({ new: true, validateModifiedOnly: true });
            // emit incoming_message -> to user 
            let new_chat = await OneToOneMessage.findOne({
                participants: { $all: [to, from] },
            }).populate(
                "participants",
                "firstName lastName _id email status" // Chọn trường bạn muốn populate
            );
            io.to(from_user?.socket_id).emit("new message", {
                conversation_id,
                new_chat,
                message: new_message,
            });
            io.to(to_user?.socket_id).emit("new message", {
                conversation_id,
                new_chat,
                message: new_message,
            });
        } catch (error) {
            console.error("Error handling text message:", error);
        }
    });

    socket.on("file_message", (data) => {
        console.log("Received Message", data);
        //data: {to, from ,text,file}
        // get the file extension 
        const filExtension = path.extname(data.file.name);
        //generate a unique filename 
        const fileName = `${Date.now()}_${Math.floor(Math.random() * 10000)}${filExtension} `;
        //upload file to AWS s3
        // create a new conversatuon if it doesn't exist yet or add new message to the messages list
        // save to db
        // emit incoming_message -> to user 
        // emit outgoing_message -> from user
    })

    // handle start_audio_call event
    socket.on("start_audio_call", async (data) => {
        const { from, to, roomID } = data;

        const to_user = await User.findById(to);
        const from_user = await User.findById(from);

        console.log("to_user", to_user);

        // send notification to receiver of call
        io.to(to_user?.socket_id).emit("audio_call_notification", {
            from: from_user,
            roomID,
            streamID: from,
            userID: to,
            userName: to,
        });
    });

    // handle audio_call_not_picked
    socket.on("audio_call_not_picked", async (data) => {
        console.log(data);
        // find and update call record
        const { to, from } = data;

        const to_user = await User.findById(to);

        await AudioCall.findOneAndUpdate(
            {
                participants: { $size: 2, $all: [to, from] },
            },
            { verdict: "Missed", status: "Ended", endedAt: Date.now() }
        );

        // TODO => emit call_missed to receiver of call
        io.to(to_user?.socket_id).emit("audio_call_missed", {
            from,
            to,
        });
    });

    // handle audio_call_accepted
    socket.on("audio_call_accepted", async (data) => {
        const { to, from } = data;

        const from_user = await User.findById(from);

        // find and update call record
        await AudioCall.findOneAndUpdate(
            {
                participants: { $size: 2, $all: [to, from] },
            },
            { verdict: "Accepted" }
        );

        // TODO => emit call_accepted to sender of call
        io.to(from_user?.socket_id).emit("audio_call_accepted", {
            from,
            to,
        });
    });

    // handle audio_call_denied
    socket.on("audio_call_denied", async (data) => {
        // find and update call record
        const { to, from } = data;

        await AudioCall.findOneAndUpdate(
            {
                participants: { $size: 2, $all: [to, from] },
            },
            { verdict: "Denied", status: "Ended", endedAt: Date.now() }
        );

        const from_user = await User.findById(from);
        // TODO => emit call_denied to sender of call

        io.to(from_user?.socket_id).emit("audio_call_denied", {
            from,
            to,
        });
    });

    // handle user_is_busy_audio_call
    socket.on("user_is_busy_audio_call", async (data) => {
        const { to, from } = data;
        // find and update call record
        await AudioCall.findOneAndUpdate(
            {
                participants: { $size: 2, $all: [to, from] },
            },
            { verdict: "Busy", status: "Ended", endedAt: Date.now() }
        );

        const from_user = await User.findById(from);
        // TODO => emit on_another_audio_call to sender of call
        io.to(from_user?.socket_id).emit("on_another_audio_call", {
            from,
            to,
        });
    });

    // --------------------- HANDLE VIDEO CALL SOCKET EVENTS ---------------------- //

    // handle start_video_call event
    socket.on("start_video_call", async (data) => {
        const { from, to, roomID } = data;

        console.log(data);

        const to_user = await User.findById(to);
        const from_user = await User.findById(from);

        console.log("to_user", to_user);

        // send notification to receiver of call
        io.to(to_user?.socket_id).emit("video_call_notification", {
            from: from_user,
            roomID,
            streamID: from,
            userID: to,
            userName: to,
        });
    });

    // handle video_call_not_picked
    socket.on("video_call_not_picked", async (data) => {
        console.log(data);
        // find and update call record
        const { to, from } = data;

        const to_user = await User.findById(to);

        await VideoCall.findOneAndUpdate(
            {
                participants: { $size: 2, $all: [to, from] },
            },
            { verdict: "Missed", status: "Ended", endedAt: Date.now() }
        );

        // TODO => emit call_missed to receiver of call
        io.to(to_user?.socket_id).emit("video_call_missed", {
            from,
            to,
        });
    });

    // handle video_call_accepted
    socket.on("video_call_accepted", async (data) => {
        const { to, from } = data;

        const from_user = await User.findById(from);

        // find and update call record
        await VideoCall.findOneAndUpdate(
            {
                participants: { $size: 2, $all: [to, from] },
            },
            { verdict: "Accepted" }
        );

        // TODO => emit call_accepted to sender of call
        io.to(from_user?.socket_id).emit("video_call_accepted", {
            from,
            to,
        });
    });

    // handle video_call_denied
    socket.on("video_call_denied", async (data) => {
        // find and update call record
        const { to, from } = data;

        await VideoCall.findOneAndUpdate(
            {
                participants: { $size: 2, $all: [to, from] },
            },
            { verdict: "Denied", status: "Ended", endedAt: Date.now() }
        );

        const from_user = await User.findById(from);
        // TODO => emit call_denied to sender of call

        io.to(from_user?.socket_id).emit("video_call_denied", {
            from,
            to,
        });
    });

    // handle user_is_busy_video_call
    socket.on("user_is_busy_video_call", async (data) => {
        const { to, from } = data;
        // find and update call record
        await VideoCall.findOneAndUpdate(
            {
                participants: { $size: 2, $all: [to, from] },
            },
            { verdict: "Busy", status: "Ended", endedAt: Date.now() }
        );

        const from_user = await User.findById(from);
        // TODO => emit on_another_video_call to sender of call
        io.to(from_user?.socket_id).emit("on_another_video_call", {
            from,
            to,
        });
    });


    socket.on("end", async (data) => {
        //Find user by _id and set the status to Offline
        if (data.user_id) {
            await User.findByIdAndUpdate(data.user_id, { status: "Offline" });
        }

        // broadcast user_disconected 


        console.log("Closing connection");
        socket.disconnect(0);
    })
});