const router = require("express").Router();

const userController = require("../controllers/user");
const authController = require("../controllers/auth");

router.patch("/update-me", authController.protect, userController.updateMe);
router.get("/get-users", authController.protect, userController.getUsers);
router.get("/get-user/:id", userController.getUserById);
router.get("/get-friends", authController.protect, userController.getFriends);
router.get("/get-friends/:id", authController.protect, userController.getFriendsById);
router.get("/get-request-friends", authController.protect, userController.getRequest);
router.get("/get-follower/:id", authController.protect, userController.getArrayFollower);
router.get("/get-following/:id", authController.protect, userController.getArrayFollowing);
router.put("/remove-token/:id", userController.removeToken);


router.post("/start-audio-call", authController.protect, userController.startAudioCall);
router.post("/start-video-call", authController.protect, userController.startVideoCall);

router.post("/generate-zego-token", authController.protect, userController.generateZegoToken);

module.exports = router;