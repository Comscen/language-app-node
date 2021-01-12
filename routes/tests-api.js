/**
 * @file routes/tests-api.js is a file responsible for defining further routes at '/tests' API route.
 * @author Tangri Michał
 */

var express = require('express')
var router = express.Router()

/* Import handlers from tests API controller */
var testsAPIController = require('../api/tests')

/* Generate and send a test */
router.get("/", testsAPIController.getNewTest);

/* Handle taken test's data to be validated and saved to database.
 * As a response, results of said test are sent.
 */
router.post("/", testsAPIController.saveTest);

module.exports = router
