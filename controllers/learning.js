const { updateWord, generateWordsForLearning } = require('../database');

exports.showLearningForm = async (req, res) => {
    if (typeof req.session.idToken == 'undefined') {
        return res.render('index.ejs', { session: req.session, error: 'Nie możesz uczyć się bez zalogowania!' });
    }
    req.session.wordData = await generateWordsForLearning(req.session.uid);
    return res.render('learn.ejs', { session: req.session })
}

exports.handleLearningForm = async (req, res) => {
    if (typeof req.session.idToken == 'undefined') {
        return res.render('index.ejs', { session: req.session, error: 'Nie możesz zapisać postępu nauki bez zalogowania!' });
    }

    let wordData = req.session.wordData
    let words = Object.keys(wordData)

    for (let word of words){
        await updateWord(req.session.uid, word, {appeared: true});
    }
    req.session.wordData = await generateWordsForLearning(req.session.uid)
    return res.render('learn.ejs', {session:req.session, message: 'Pomyślnie zapamiętano słowa! Automatycznie wygenerowaliśmy nowy zestaw, jednak jeśli chcesz, możesz po prostu opuścić tę stronę.'})
}