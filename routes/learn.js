const router = require("express").Router();
const learnController = require("../controllers/learn");
const { uploadCurriculum } = require('../config/cloudinary.config');

router.post("/suggest-learning-path", learnController.suggestLearningPath);
router.post('/upload', uploadCurriculum.single('file'), learnController.uploadCurriculum);
router.post('/create-learning-path', learnController.createLearningPath);
router.post('/slides', learnController.createSlidesFromCurriculum);
// Thêm route mới vào routes/learn.js
// Thêm vào routes/learn.js
router.get('/slides-data/:slideId', learnController.getSlidesData);
router.get('/view-slides/:slideId', learnController.viewSlides);
module.exports = router;