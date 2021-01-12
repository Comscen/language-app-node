/**
 * @file routes/upload-api.js is a file responsible for defining further routes at '/upload' API route.
 * @author Tangri Michał
 */

var express = require('express')
var router = express.Router()
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() })

/* Import handlers from upload API controller */
var uploadAPIController = require('../api/upload')

/* Send upload info */
router.get("/", uploadAPIController.getUploadInfo)

/* Handle file upload API route and save files to request object for further processing */
router.post("/", upload.array("files"), uploadAPIController.handleFileUploadRequest)

/* Handle URL upload API route */
router.post("/url", uploadAPIController.handleURLUploadRequest)

module.exports = router
