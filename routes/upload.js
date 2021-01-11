var express = require('express')
var router = express.Router()
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() })

var { showUploadForm, handleUploadForm, handleURLForm} = require('../controllers/upload')

router.get("/", showUploadForm)

router.post("/", upload.array("files"), handleUploadForm)

router.post("/url", handleURLForm)

module.exports = router