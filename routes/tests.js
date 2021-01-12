/**
 * @file routes/tests.js is a file responsible for defining further routes at '/tests' route.
 * @author Tangri Michał
 */

var express = require('express')
var router = express.Router()

/* Import handlers from tests controller */
var testsController = require('../controllers/tests')

/* Generate and display a test for user to take */
router.get("/", testsController.showNewTest);

/* Handle taken test's data to be validated and saved to database */
router.post("/", testsController.saveTest);

module.exports = router
