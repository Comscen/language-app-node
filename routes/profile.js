var express = require('express')
var router = express.Router()
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() })

var profileController = require('../controllers/profile')

router.get("/", profileController.getOwnProfile);

router.post("/editPhoto", upload.single('photo'), profileController.handlePhotoUpload);

module.exports = router