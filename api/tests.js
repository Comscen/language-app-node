const { parseDate } = require('../controllers/tests');
const { generateTestQuestions} = require('../database');
const { body } = require('express-validator');
const app = require('firebase/app');
const firebaseService = require('../database')

exports.getNewTest = async (req, res) => {
    const uid = req.body.uid;
    const amount = typeof req.body.amount == 'undefined' ? 24 : req.body.amount;
    let errors = [];

    let status = 200;
    if (typeof uid == 'undefined')
        return res.status(400).send({error: 'UID not specified'});

    let testData = await generateTestQuestions(uid, amount).catch(error => {
        status = 404;
        errors.push('Could not generate test. User with given UID does not exits');
    });;

    if (testData === null) {
        return res.status(409).send({error: 'This user does not have enough words ready for test generation.'});
    }

    return res.status(status).send({ testData: testData});
}

exports.saveTest = async (req, res) => {
    const uid = req.body.uid;
    const answers = req.body.answers;
    const testData = req.body.testData;

    let status = 200;
    if (typeof uid == 'undefined')
        return res.status(400).send({error: 'UID not specified'});

    if (typeof answers == 'undefined')
        return res.status(400).send({error: 'Answers not specified'});

    if (typeof testData == 'undefined')
        return res.status(400).send({error: 'Test data not specified'});
    
    if (typeof testData.dateCreated == 'undefined')
    return res.status(400).send({error: 'Test data does not contain creation date'});

    for (let i = 0; i < answers.length; i++)
        await body(`answers[${i}]`).trim().escape().run(req)

    const finishDate = new Date();

    let results = {
        words: {},
        dateStarted: parseDate(testData.dateCreated),
        dateFinished: parseDate(finishDate.toISOString()),
        points: 0,
        maxPoints: answers.length
    };

    let i = 0;
    let keys = Object.keys(testData);
    let firestoreIncrement = app.default.firestore.FieldValue.increment(1);

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
    
    await firebaseService.saveTest(uid, results)
    return res.status(status).send({ results: results, errors: errors });
}


