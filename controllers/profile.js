/**
 * @file profile.js is a controller used to display user profile
 * @author Tangri Michał
 */

const { firebase, getStats } = require('../database')
const { nanoid } = require('nanoid');


/** Handles '/profile' GET request to render user's profile with basic statistics. 
 * 
 *  It checks if user's idToken is saved in session to decide whether said user is logged in or he's not and should be denided access.
 *  
 *  @async
 *  @param {Request} req - Request received from client.
 *  @param {Response} res - Response to be sent to client.
 */
exports.showOwnProfile = async (req, res) => {
    if (typeof req.session.idToken == 'undefined') {
        return res.render('index.ejs', { error: 'Aby wejść na profil należy się zalogować!', session: req.session });
    }
    const stats = await getStats(req.session.uid);
    return res.render('profile.ejs', { session: req.session, stats: stats });
}


/** Handles '/profile/editPhoto' POST request to change user's profile picture if he has created his account
 *  using an e-mail address instead of an OAuth.
 * 
 *  It checks if user's idToken is saved in session to decide whether said user is logged in or he's not and should be denided access.
 *  
 *  @async
 *  @param {Request} req - Request received from client.
 *  @param {Response} res - Response to be sent to client.
 */
exports.handlePhotoUpload = async (req, res) => {
    if (typeof req.session.idToken == 'undefined') {
        return res.render('index.ejs', { session: req.session, error: 'Nie można zmienić zdjęcia profilowego bez zalogowania!' });
    }

    /* Check if submitted file is an png or jpeg image, if not, display an error message. */
    let file = req.file;
    if (file.mimetype !== 'image/png' && file.mimetype !== 'image/jpeg') {
        return res.render('index.ejs', { session: req.session, error: `Nieprawidłowy format pliku: ${file.originalName}` });
    }

    /* Save uploaded file to Firestore with a new name */
    let ref = firebase.storage().ref(`avatars/${req.session.uid}/${nanoid(32)}.png`);
    await ref.put(file.buffer).then(_ => { });

    /* Set saved file's download link as user's profile picture URL and render his profile page */
    let newURL = await ref.getDownloadURL();
    await firebase.auth().currentUser.updateProfile({ photoURL: newURL }).then(_ => {
        req.session.photoURL = newURL;
        return res.redirect('/profile');
    });

}