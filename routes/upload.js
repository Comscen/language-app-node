/**
 * @file routes/upload.js is a file responsible for defining further routes at '/upload' route.
 * @author Tangri Michał
 */

var express = require('express')
var router = express.Router()
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() })

/* Import handlers from upload controller */
var { showUploadForm, handleUploadForm, handleURLForm } = require('../controllers/upload')

/* Show upload form */
router.get("/", showUploadForm)

/* Handle file upload route and save files to request object for further processing */
router.post("/", upload.array("files"), handleUploadForm)

/* Handle URL upload route */
router.post("/url", handleURLForm)

module.exports = router