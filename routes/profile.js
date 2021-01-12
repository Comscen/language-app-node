/**
 * @file routes/profile.js is a file responsible for defining further routes at '/profile' route.
 * @author Tangri Michał
 */

var express = require('express')
var router = express.Router()
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() })

/* Import handlers from profile controller */
var profileController = require('../controllers/profile')

/* Show signed in user's profile with basic statistics */
router.get("/", profileController.showOwnProfile);

/* Save submitted file as a new profile picture for users without OAuth */
router.post("/editPhoto", upload.single('photo'), profileController.handlePhotoUpload);

module.exports = router
