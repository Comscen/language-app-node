var express = require('express')
var router = express.Router()

var authController = require('../controllers/auth')

router.get("/login", authController.showLoginForm)

router.post("/login", authController.handleEmailLogin)

router.post("/login/oauth", authController.handleOAuthLogin)

router.get("/register", authController.showRegisterForm)

router.post("/register", authController.handleRegisterForm)

router.get("/logout", authController.logout)


module.exports = router