var express = require('express')
var router = express.Router()

var testsController = require('../controllers/tests')

router.get("/", testsController.showNewTest);

router.post("/", testsController.saveTest);

module.exports = router