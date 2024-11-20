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
                io.to(to.socket_id).emit("New_friend_request", {
                    message: "New friend request received",
                });
            }

            if (from?.socket_id) {
                io.to(from.socket_id).emit("request_send", {
                    message: "Request send successfully",
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
            message: "Friend Reqeust Accepted",
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


    socket.on("get_messages", async (data, callback) => {
        try {
            const { messages } = await OneToOneMessage.findById(
                data.conversation_id
            ).select("messages");
            callback(messages)
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
            io.to(from_user?.socket_id).emit("new message", {
                conversation_id,
                message: new_message,
            });
            io.to(to_user?.socket_id).emit("new message", {
                conversation_id,
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