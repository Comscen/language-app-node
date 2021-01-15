/**
 * 
 * @file api/learning.js is an API controller used to get generate and process learning words.
 * 
 */

const { generateWordsForLearning, updateWords, checkIfWordExists } = require('../database')

/**
 * Handles '/learning' GET API request to render a set of words for learning.
 * 
 * Requires UID to be sent in the request's body.
 * 
 * @param {Request} req - Request from the client.
 * @param {Response} res - Response to be sent to the client. 
 */
exports.getNewSetOfWordsForLearning = async (req, res) => {
    const uid = req.body.uid;

    // Checks if the amount of words to be sent is provided. If not use the default value of 24.
    const amount = req.body.amount == 'undefined' ? 24 : req.body.amount;
    let errors = [];

    // Checks whether if the UID has been specified.
    let status = 200;
    if (typeof uid == 'undefined')
        return res.status(400).send({ error: 'UID not specified' });

    // Generates a set of words for learning. Pushes an error if UID is invalid.
    let wordData = await generateWordsForLearning(uid, amount).catch(_ => {
        status = 404;
        errors.push('Could not generate a set of words. User with given UID does not exist.');
    })

    // Checks if a user has enough non-appeared words in his collection to generate a test. If not, returns an error. 
    if (wordData === null)
        return res.status(409).send({ error: 'This user does not have enough non learnt words ready for a word set generation' });

    // Returns a response with appropriate status and information.
    return res.status(status).send({ wordData: wordData, errors: errors })
}

/**
 * Handles '/learning' POST API request to process received words
 * 
 * Requires UID and an array of words for the update to be specified in the request body.
 * 
 * @param {Request} req - Request from the client.
 * @param {Response} res - Response to be sent to the client.
 */
exports.saveSetOfWordsAsAppearedInLearning = async (req, res) => {
    const uid = req.body.uid;
    const words = req.body.words;

    let errors = [];

    // Checks whether if the necessary information has been porovided in the request body.
    let status = 200;
    if (typeof uid == 'undefined')
        return res.status(400).send({ error: 'UID not specified' });
    if (typeof words == 'undefined')
        return res.status(400).send({ error: 'Words not specified' });

    // Iterates through all the words and checks whether if they exist. If not, pushes an error back, specifying,
    // which of the words are not present in the database.
    for (let word of words) {
        await checkIfWordExists(uid, word).then(result => {
            if (!result){
                status = 409;
                errors.push(`${word} cannot be set as appearead, because it does not exist.`);
            }
        })
    }

    // Checks if there are any errors. If not, updates the appeared field of provided words to true. 
    if(errors.length == 0){
        await updateWords(uid, words);
    }

    // Returns a response with appropriate status and information.
    return res.status(status).send({errors: errors});
}