/**
 * @file api/tests.js is an API controller used to generate, send, and process tests.
 * @author Tangri Michał
 */


const { parseDate } = require('../controllers/tests');
const { generateTestQuestions } = require('../database');
const { body } = require('express-validator');
const app = require('firebase/app');
const firebaseService = require('../database')


/** Handles '/tests' (API) GET request to render a test for user to take. 
 * 
 *  It requires UID to be provided in request's body.
 *  
 *  @async
 *  @param {Request} req - Request received from client.
 *  @param {Response} res - Response to be sent to client.
 */
exports.getNewTest = async (req, res) => {
    const uid = req.params.uid;

    /* Check if amount of words to select has been specified. If not, use the default value of 24 per test */
    const amount = typeof req.params.amount == 'undefined' ? 24 : req.params.amount;
    let errors = [];

    let status = 200;
    if (typeof uid == 'undefined')
        return res.status(400).send({ error: 'UID not specified' });

    /* Generate test or return an error if specified ID is invalid. */
    let testData = await generateTestQuestions(uid, amount).catch(error => {
        status = 404;
        errors.push('Could not generate test. User with given UID does not exist.');
    });;

    /* If user does not have enough seen and not learnt words to generate a test - an error is sent */
    if (testData === null) {
        return res.status(409).send({ error: 'This user does not have enough words ready for test generation.' });
    }

    return res.status(status).send({ testData: testData, errors: errors });
}

/** Handles '/tests' (API) POST request to save a test taken by user.
 * 
 *  It requires UID to be provided in request's body.
 *  
 *  @async
 *  @param {Request} req - Request received from client.
 *  @param {Response} res - Response to be sent to client.
 */
exports.saveTest = async (req, res) => {
    const uid = req.body.uid;
    const answers = req.body.answers;
    const testData = req.body.testData;

    /* Check if every necessary information has been provided */
    let status = 200;
    if (typeof uid == 'undefined')
        return res.status(400).send({ error: 'UID not specified' });

    if (typeof answers == 'undefined')
        return res.status(400).send({ error: 'Answers not specified' });

    if (typeof testData == 'undefined')
        return res.status(400).send({ error: 'Test data not specified' });

    if (typeof testData.dateCreated == 'undefined')
        return res.status(400).send({ error: 'Test data does not contain creation date' });

    /* Trim leading and trailing whitespaces and remove HTML specific characters to prevent HTML injection */
    for (let i = 0; i < answers.length; i++)
        await body(`answers[${i}]`).trim().escape().run(req)

    /* Current date to be saved as a time when the test had ended */
    const finishDate = new Date();

    /** Preparing data object which will be send to a summary page 
     *  
     * @property {object} words - Contains words, their translation and user's answers
     * @property {string} dateStarted - Time when the test has been generated and displayed to user
     * @property {string} dateFinished - Time when user had finished taking the test.
     * @property {number} points - Amount of points gained by user
     * @property {number} maxPoints - Total points to be gained (equal to the number of words in a test)
     */
    let results = {
        words: {},
        dateStarted: parseDate(testData.dateCreated),
        dateFinished: parseDate(finishDate.toISOString()),
        points: 0,
        maxPoints: answers.length
    };

    /* Used to increment a value in a field in database without knowing what's this field's current value */
    let firestoreIncrement = app.default.firestore.FieldValue.increment(1);

    /* Array of words in english */
    let keys = Object.keys(testData);

    /* Iteration variable */
    let i = 0;

    /*  Process all words that were supposed to be translated from english to polish
     *  It increments the number of times a given english word was in all tests.
     *  If user's answer was correct, it marks this word as learnt. 
     */
    let errors = [];
    for (; i < (answers.length - 1) / 2; i++) {
        let correct = false;
        let word = keys[i];
        let answer = answers[i];
        if (answer.toLowerCase() === testData[word].toLowerCase()) {
            await firebaseService.updateWord(uid, word, { timesInTest: firestoreIncrement, learnt: true, learntDate: finishDate, }).catch(error => {
                status = 404;
                errors.push(`Given word does not exist: ${word}`);
            })
            correct = true;
            results.points++;
        } else {
            await firebaseService.updateWord(uid, word, { timesInTest: firestoreIncrement }).catch(error => {
                status = 404;
                errors.push(`Given word does not exist: ${word}`);
            })
        }
        results.words[word] = { translation: testData[word], answer: answer, correct: correct }
    }

    /*  Process all words that were supposed to be translated from polish to english
     *  It increments the number of times a given english word was in all tests.
     *  If user's answer was correct, it marks this word as learnt. 
     */
    for (; i < (answers.length - 1); i++) {
        let correct = false;
        let word = keys[i];
        let answer = answers[i];
        if (answer.toLowerCase() === word.toLowerCase()) {
            await firebaseService.updateWord(uid, word, { timesInTest: firestoreIncrement, learnt: true, learntDate: finishDate, }).catch(error => {
                status = 404;
                errors.push(`Given word does not exist: ${word}`);
            })
            correct = true;
            results.points++;
        } else {
            await firebaseService.updateWord(uid, word, { timesInTest: firestoreIncrement }).catch(error => {
                status = 404;
                errors.push(`Given word does not exist: ${word}`);
            })
        }
        results.words[word] = { translation: testData[word], answer: answer, correct: correct }
    }

    /* Save a test and it's results to database */
    await firebaseService.saveTest(uid, results)

    /* Send back a summary object with total points, date of start and finish and a list of words that were in a test with their 
     * and user's answers (it also tells which guesses were correct and which were not).
     */
    return res.status(status).send({ results: results, errors: errors });
}
