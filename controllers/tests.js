const firebaseService = require('../database')
const app = require('firebase/app');
const { body } = require('express-validator');

const parseDate = dateToParse => {
    let [date, time] = dateToParse.split('T');
    let dateParts = date.split('-');
    let timeParts = time.split(':')

    return `${dateParts[2]}-${dateParts[1]}-${dateParts[0]} ${timeParts[0]}:${timeParts[1]}`;
}

exports.showNewTest = async (req, res) => {

    if (typeof req.session.idToken == 'undefined') {
        return res.render('index.ejs', { session: req.session, error: 'Nie możesz wykonać testu bez zalogowania!' });
    }

    let testData = await firebaseService.generateTestQuestions(req.session.uid, 24);

    if (testData === null) {
        return res.render('test.ejs', { error: 'Brak wystarczającej ilości nowych przerobionych słówek. Przejdź do seksji "Nauka" i naucz się nowych słówek, aby wygenerować test.', session: req.session })
    }

    req.session.testData = testData;
    return res.render('test.ejs', { session: req.session });
}

exports.saveTest = async (req, res) => {
    if (typeof req.session.idToken == 'undefined') {
        return res.render('index.ejs', { session: req.session, error: 'Nie możesz zapisać testu bez zalogowania!' });
    }

    let answers = req.body.answers;
    for (let i = 0; i < answers.length; i++)
        await body(`answers[${i}]`).trim().escape().run(req)

    let testData = req.session.testData;
    const finishDate = new Date();
    req.session.testData = undefined;

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

    for (; i < (answers.length - 1) / 2; i++) {
        let correct = false;
        let word = keys[i];
        let answer = answers[i];
        if (answer.toLowerCase() === testData[word].toLowerCase()) {
            await firebaseService.updateWord(req.session.uid, word, { timesInTest: firestoreIncrement, learnt: true, learntDate: finishDate, })
            correct = true;
            results.points++;
        } else {
            await firebaseService.updateWord(req.session.uid, word, { timesInTest: firestoreIncrement })
        }
        results.words[word] = { translation: testData[word], answer: answer, correct: correct }
    }

    for (; i < (answers.length - 1); i++) {
        let correct = false;
        let word = keys[i];
        let answer = answers[i];
        if (answer.toLowerCase() === word.toLowerCase()) {
            await firebaseService.updateWord(req.session.uid, word, { timesInTest: firestoreIncrement, learnt: true, learntDate: finishDate, })
            correct = true;
            results.points++;
        } else {
            await firebaseService.updateWord(req.session.uid, word, { timesInTest: firestoreIncrement })
        }
        results.words[word] = { translation: testData[word], answer: answer, correct: correct }
    }
    
    await firebaseService.saveTest(req.session.uid, results)
    return res.render('testResults.ejs', { session: req.session, results: results });
}