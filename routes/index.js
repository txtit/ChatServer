const router = require("express").Router();

const authRoute = require("./auth");
const userRoute = require("./user");
const insertRoute = require("./insert");
const postRoute = require("./post");
const learnRoute = require("./learn");
const learningRoute = require("./learning"); // New learning progress API
const parentRoute = require("./parent"); // Parent dashboard API

router.use("/auth", authRoute);
router.use("/user", userRoute);
router.use("/insert", insertRoute);
router.use("/learn", learnRoute);
router.use("/learning", learningRoute); // Mount learning progress API at /api/learning
router.use("/parent", parentRoute); // Mount parent API at /api/parent
router.use("/post", postRoute);

module.exports = router;