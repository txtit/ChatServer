const router = require("express").Router();

const authRoute = require("./auth");
const userRoute = require("./user");
const insertRoute = require("./insert");
const postRoute = require("./post");

router.use("/auth", authRoute);
router.use("/user", userRoute);
router.use("/insert", insertRoute);
router.use("/post", postRoute);

module.exports = router;