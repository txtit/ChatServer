const express = require('express')
const router = express.Router()
const ctrls = require('../controllers/post')

router.get('/getPosts', ctrls.getPosts)
router.get('/getCurrentPost/', ctrls.getCurentPost)
router.get('/getCommentInPost/:pid', ctrls.getCommentInPost)
router.put('/likePost', ctrls.likePost)
router.post('/commentPost', ctrls.addCommentPost)
module.exports = router;