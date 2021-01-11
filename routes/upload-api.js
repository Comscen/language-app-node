var express = require('express')
var router = express.Router()
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() })

var uploadAPIController = require('../api/upload')

router.get("/", uploadAPIController.getUploadInfo)

router.post("/", upload.array("files"), uploadAPIController.handleFileUploadRequest)

router.post("/url", uploadAPIController.handleURLUploadRequest)

module.exports = router