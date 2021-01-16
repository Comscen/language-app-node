/**
 * @file routes/profile.js is a file responsible for defining further routes at '/profile' API route.
 * @author Tangri Michał
 */

var express = require('express')
var router = express.Router()
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() })

/* Import handlers from profile API controller */
var profileAPIController = require('../api/profile')

/* Retrieves user's information and basic statistics */
router.get("/:uid", profileAPIController.getProfile);

module.exports = router
