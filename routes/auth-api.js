/**
 * @file routes/auth-api.js is a file responsible for defining further routes at '/auth' API route.
 * @author Czajkowski Sebastian
 */

var express = require('express')
var router = express.Router()

/* Import handlers from auth API controller */
var authAPIController = require('../api/auth')

/* Return an UID and user info using user's e-mail address and password */
router.get("/login/:email/:password", authAPIController.getUIDByEmail)

/* Return an UID and user info using user's idToken (register an account if necessary) */
router.get("/login/oauth", authAPIController.getUIDByToken)

/* Create a new account using user's e-mail and return UID */
router.post("/register", authAPIController.createAccount)


module.exports = router
