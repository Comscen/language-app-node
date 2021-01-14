var express = require('express')
var router = express.Router()

var learningController = require('../controllers/learning')


router.get('/', learningController.showLearningForm)

router.post('/', learningController.handleLearningForm)

module.exports = router