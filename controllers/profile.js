const { firebase } = require('../database')
const { nanoid } = require('nanoid');

exports.getOwnProfile = (req, res) => {
    if (typeof req.session.idToken == 'undefined') {
        return res.render('index.ejs', { error: 'Aby wejść na profil należy się zalogować!', session: req.session });
    }
    return res.render('profile.ejs', { session: req.session });
}

exports.handlePhotoUpload = async (req, res) => {
    if (typeof req.session.idToken == 'undefined') {
        return res.render('index.ejs', { session: req.session, error: 'Nie można zmienić zdjęcia profilowego bez zalogowania!'});
    }

    let file = req.file;
    if (file.mimetype !== 'image/png' && file.mimetype !== 'image/jpeg') {
        return res.render('index.ejs', { session: req.session, error: `Nieprawidłowy format pliku: ${file.originalName}`});
    }

    let ref = firebase.storage().ref(`avatars/${req.session.uid}/${nanoid(32)}.png`);
    await ref.put(file.buffer).then(_ => {});
    
    let newURL = await ref.getDownloadURL();
    await firebase.auth().currentUser.updateProfile({photoURL: newURL}).then(_ => {
        req.session.photoURL = newURL;
        return res.redirect('/profile');
    });

}