var express = require('express')
var router = express.Router()
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() })

var uploadController = require('../controllers/upload')

router.get("/", uploadController.showUploadForm)

router.post("/", upload.array("files"), uploadController.handleUploadForm)

router.post("/url", uploadController.handleURLForm)

module.exports = router