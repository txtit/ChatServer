const express = require('express')
const router = express.Router()
const ctrls = require('../controllers/post')
const {uploadImage} = require('../config/cloudinary.config')

router.get('/getPosts', ctrls.getPosts)
router.get('/getCurrentPost/', ctrls.getCurentPost)
router.get('/getCommentInPost/:pid', ctrls.getCommentInPost)
router.put('/likePost', ctrls.likePost)
router.post('/commentPost', ctrls.addCommentPost)
router.post('/create', uploadImage.fields([
    { name: 'images', maxCount: 10 },
]), ctrls.createPost)
router.get('/getPostsByuid/:id', ctrls.getPostsByuid)
module.exports = router;