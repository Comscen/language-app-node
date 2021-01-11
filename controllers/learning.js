const firebaseService = require('../database')


exports.showLearningForm = async (req, res) => {
    let data = firebaseService.generateWordsForLearning(req.session.uid)
    return res.render('learn.ejs', {session: req.session, wordData: data})
}

exports.handleLearningForm = async (req, res) => {
}