/**
 * @file tests.js is a controller used to generate, display, and process tests designed to check user's knowledge.
 * @author Tangri Michał
 */

const firebaseService = require('../database')
const app = require('firebase/app');
const { body } = require('express-validator');

/** This function parses an ISODate string to be displayed for user in a friendly way.
 * 
 *  @param {string} dateToParse - Date string in ISO format to be parsed
 *  @returns {string} String representing a date 
 */
exports.parseDate = dateToParse => {
    let [date, time] = dateToParse.split('T');
    let dateParts = date.split('-');
    let timeParts = time.split(':')

    return `${dateParts[2]}-${dateParts[1]}-${dateParts[0]} ${timeParts[0]}:${timeParts[1]}`;
}


/** Handles '/tests' GET request to render a test for user to take. 
 * 
 *  It checks if user's uid is saved in session to decide whether said user is logged in or he's not and should be denided access.
 *  
 *  @async
 *  @param {Request} req - Request received from client.
 *  @param {Response} res - Response to be sent to client.
 */
exports.showNewTest = async (req, res) => {

    if (typeof req.session.idToken == 'undefined') {
        return res.render('index.ejs', { session: req.session, error: 'Nie możesz wykonać testu bez zalogowania!' });
    }

    /* 
        Select 24 random words and their translations to display them on the test.
        Only words seen by user in learning section and words that never were in a test before are valid.
    */
    let testData = await firebaseService.generateTestQuestions(req.session.uid, 24);

    /* If user does not have enough seen and not learnt words to generate a test - an error is displayed */
    if (testData === undefined) {
        return res.render('test.ejs', { error: 'Brak wystarczającej ilości nowych przerobionych słówek (minimum 24). Przejdź do seksji "Nauka" i naucz się nowych słówek, aby wygenerować test.', session: req.session })
    }

    /* Selected words are saved to session for when test is saved*/
    req.session.testData = testData;
    /* Render a test page */
    return res.render('test.ejs', { session: req.session });
}


/** Handles '/tests' POST request to save a test taken by user.
 * 
 *  It checks if user's uid is saved in session to decide whether said user is logged in or he's not and should be denided access.
 *  
 *  @async
 *  @param {Request} req - Request received from client.
 *  @param {Response} res - Response to be sent to client.
 */
exports.saveTest = async (req, res) => {

    const uid = req.session.uid;
    if (typeof uid == 'undefined') {
        return res.render('index.ejs', { session: req.session, error: 'Nie możesz zapisać testu bez zalogowania!' });
    }

    /* Array of strings with user's answers */
    let answers = req.body.answers;

    /* Trim leading and trailing whitespaces and remove HTML specific characters to prevent HTML injection */
    for (let i = 0; i < answers.length; i++)
        await body(`answers[${i}]`).trim().escape().run(req)

    /* Test data saved in session during test generation is now loaded to a local variable and removed from said session */
    let testData = req.session.testData;
    req.session.testData = undefined;

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
        dateStarted: testData.dateCreated,
        dateFinished: finishDate.toISOString(),
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
    for (; i < (answers.length - 1) / 2; i++) {
        let correct = false;
        let word = keys[i];
        let answer = answers[i];
        if (answer.toLowerCase() === testData[word].toLowerCase()) {
            await firebaseService.updateWord(uid, word, { timesInTest: firestoreIncrement, learnt: true, learntDate: finishDate, })
            correct = true;
            results.points++;
        } else {
            await firebaseService.updateWord(uid, word, { timesInTest: firestoreIncrement })
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
            await firebaseService.updateWord(uid, word, { timesInTest: firestoreIncrement, learnt: true, learntDate: finishDate, })
            correct = true;
            results.points++;
        } else {
            await firebaseService.updateWord(uid, word, { timesInTest: firestoreIncrement })
        }
        results.words[word] = { translation: testData[word], answer: answer, correct: correct }
    }

    /* Save a test and it's results to database */
    await firebaseService.saveTest(uid, results)

    results.dateStarted = this.parseDate(results.dateStarted);
    results.dateFinished = this.parseDate(results.dateFinished);
    /* Render summary page with total points, date of start and finish and a list of words that were in a test with their 
     * and user's answers (it also shows which guesses were correct and which were not).
     */
    return res.render('testResults.ejs', { session: req.session, results: results });
}