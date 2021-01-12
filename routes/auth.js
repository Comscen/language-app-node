/**
 * @file routes/auth.js is a file responsible for defining further routes at '/auth' route.
 * @author Czajkowski Sebastian
 */

var express = require('express')
var router = express.Router()

/* Import handlers from auth controller */
var authController = require('../controllers/auth')

/* Show sign in form */
router.get("/login", authController.showLoginForm)

/* Handle sign in with user's e-mail */
router.post("/login", authController.handleEmailLogin)

/* Handle sign in with user's Google, Facebook or Twitter account */
router.post("/login/oauth", authController.handleOAuthLogin)

/* Show sign up form */
router.get("/register", authController.showRegisterForm)

/* Handle sign up with user's e-mail */
router.post("/register", authController.handleRegisterForm)

/* Handle sign out */
router.get("/logout", authController.logout)


module.exports = router
