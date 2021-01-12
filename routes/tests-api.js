var express = require('express')
var router = express.Router()

var testsAPIController = require('../api/tests')

router.get("/", testsAPIController.getNewTest);

router.post("/", testsAPIController.saveTest);

module.exports = router