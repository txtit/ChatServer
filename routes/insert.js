const router = require('express').Router()
const ctrls = require('../controllers/insertData')

router.post('/user', ctrls.insertUser)
router.post('/childPost', ctrls.insertChildPost)
router.post('/replie', ctrls.insertReplie)
router.post('/comment', ctrls.insertComment)
router.post('/post', ctrls.insertPost)
module.exports = router;