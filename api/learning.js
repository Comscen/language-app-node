const { generateWordsForLearning, updateWords, checkIfWordExists } = require('../database')

exports.getNewSetOfWordsForLearning(uid, amount) = async (req, res) => {
    const uid = req.body.uid;

    const amount = req.body.amount == 'undefined' ? 24 : req.body.amount;
    let errors = [];

    let status = 200;
    if (typeof uid == 'undefined')
        return res.status(400).send({ error: 'UID not specified' });

    let wordData = await generateWordsForLearning(uid, amount).catch(_ => {
        status = 404;
        errors.push('Could not generate a set of words. User with given UID does not exist.');
    })

    if (wordData === null)
        return res.status(409).send({ error: 'This user does not have enough non learnt words ready for a word set generation' });

    return res.status(status).send({ wordData: wordData, errors: errors })
}

exports.saveSetOfWordsAsAppearedInLearning(uid, arrayOfWords) = async (req, res) => {
    const uid = req.body.uid;
    const words = arrayOfWords;

    let errors = [];

    let status = 200;
    if (typeof uid == 'undefined')
        return res.status(400).send({ error: 'UID not specified' });
    if (typeof words == 'undefined')
        return res.status(400).send({ error: 'Words not specified' });

    for (let word of words) {
        await checkIfWordExists(uid, word).then(result => {
            if (!result){
                status = 409;
                errors.push(`${word} cannot be set as appearead, because it does not exist.`);
            }
        })
    }

    if(errors.length == 0){
        await updateWords(uid, arrayOfWords);
    }

    return res.status(status).send({errors: errors});
}