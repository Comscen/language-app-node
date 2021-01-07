var express = require('express')
var router = express.Router()

var uploadController = require('../controllers/upload')

router.get("/", uploadController.showUploadForm)

router.post("/", uploadController.handleUploadForm)

router.get("/choose", uploadController.showWordsTable)

router.post("/choose", uploadController.saveSelectedWords)


module.exports = router