/**
 * @file routes/learning-api.js is a file responsible for defining further routes at '/learning' API route.
 * @author Czajkowski Sebastian
 */

var express = require('express')
var router = express.Router()

/* Import handlers from learning API controller */
var learningAPIController = require('../api/learning')

/* Return an object with words for learning */
router.get("/:uid/:amount", learningAPIController.getNewSetOfWordsForLearning)

/* Update words as appeared in the database */
router.post("/", learningAPIController.saveSetOfWordsAsAppearedInLearning)

module.exports = router