/**
 * @file learning,js is a controller used to generate and process words that the user learns.
 * @author Czajkowski Sebastian
 */

const { updateWord, generateWordsForLearning } = require('../database');

/**
 * Handles '/learn' GET request to render a table with words for user to learn
 * 
 * @param {Request} req - Request received from the client. 
 * @param {Response} res - Response to be sent to the client.
 */
exports.showLearningForm = async (req, res) => {

    //Check whether if the user is logged in or not. If not, render the index with an appropriate error.
    if (typeof req.session.uid == 'undefined') {
        return res.render('index.ejs', { session: req.session, error: 'Nie możesz uczyć się bez zalogowania!' });
    }

    // Generate words for learning. If their length is too short, render an error.
    const amount = 24;
    let wordData = await generateWordsForLearning(req.session.uid, amount);
    if(wordData === undefined){
        return res.render('learn.ejs', {session: req.session, error:'Masz za mało słów w bazie, aby wygenerować kolejny zestaw do nauki!'})
    }

    // Save generated words to session.
    req.session.wordData = wordData

    // Render the site with appropriate information.
    return res.render('learn.ejs', { session: req.session })
}

/**
 * Handles '/learn' POST request to update words that have appeared in this learning session.
 * Generates a new set of words to be learnt and message to confirm that the previous set has been saved.
 * 
 * @param {Request} req - Request from the client.
 * @param {Response} res - Response to be sent to the client.
 */
exports.handleLearningForm = async (req, res) => {

    // Checks whether if the user is logged in or not. If not, render the index with an appropriate error.
    if (typeof req.session.uid == 'undefined') {
        return res.render('index.ejs', { session: req.session, error: 'Nie możesz zapisać postępu nauki bez zalogowania!' });
    }

    // Gets data about appeared words from session.
    let wordData = req.session.wordData

    // Iterates through all the words and updates their appeared field to true, as to mark them that they have been
    // shown in a learning course. This is needed for the tests.
    for (let word of Object.keys(wordData)){
        await updateWord(req.session.uid, word, {appeared: true});
    }
    const amount = 24;
    // Generate a new set of words to be shown instantly after one has been learnt.
    const words = await generateWordsForLearning(req.session.uid, amount);

    if(Object.keys(words).length < amount) {
        return res.render('index.ejs', { session: req.session, message: 'Pomyślnie zapamiętano słowa!', error: 'Masz za mało słów w bazie, aby wygenerować kolejny zestaw do nauki!' });
    }

    req.session.wordData = words;
    // Render the site with appropriate information.
    return res.render('learn.ejs', {session:req.session, message: 'Pomyślnie zapamiętano słowa! Automatycznie wygenerowaliśmy nowy zestaw, jednak jeśli chcesz, możesz po prostu opuścić tę stronę.'})
}