const { body, validationResult } = require('express-validator');
const firebaseService = require('../database')


exports.showLoginForm = (req, res) => {
    if (typeof req.session.idToken != 'undefined') {
        return res.render('index.ejs', { session: req.session, error: 'Jesteś już zalogowany!' })
    }
    return res.render('login.ejs', { session: req.session });
}

exports.handleEmailLogin = async (req, res) => {
    firebaseService.signInWithEmailAndPassword(req.body.email, req.body.password).then(user => {
        req.session.uid = user.user.uid;
        req.session.name = user.user.displayName;
        req.session.photoURL = user.user.photoURL == null ? undefined : user.user.photoURL;
        user.user.getIdToken(true).then(token => {
            req.session.idToken = token
            return res.render('index.ejs', { message: 'Pomyślnie zalogowano!', session: req.session })
        }).catch(error => {
            console.log(`TOKEN ERROR (LOGIN) ${error}`)
        })
    }).catch(error => {
        switch (error.code) {
            case 'auth/wrong-email':
                return res.render('login.ejs', { error: 'Niepoprawny e-mail lub hasło.', session: req.session })
            case 'auth/wrong-password':
                return res.render('login.ejs', { error: 'Niepoprawny e-mail lub hasło.', session: req.session })
            default:
                console.log(`UNKNOWN ERROR: ${error}`);
        }
    })
}

exports.handleOAuthLogin = async (req, res) => {
    const idToken = req.body.idToken;
    await firebaseService.admin.auth().verifyIdToken(idToken).then(decodedToken => {
        req.session.name = decodedToken.name;
        req.session.uid = decodedToken.uid;
        req.session.photoURL = decodedToken.picture;
        req.session.idToken = idToken;
    }).catch(error => {
        console.log(`Error while saving data from OAuth login: ${error}`);
    })
    await firebaseService.firebase.firestore().doc(`users/${req.session.uid}`).set({ wordAmount: 0, name: req.session.name}).then(_ => {

    }).catch(error => {
        console.log(`FIRESTORE ERROR: ${error}`);
    })
    return res.render('index.ejs', {session: req.session, message: 'Pomyślnie zalogowano!'});
}

exports.showRegisterForm = (req, res) => {
    if (typeof req.session.idToken != 'undefined') {
        return res.render('index.ejs', { session: req.session, error: 'Jesteś już zalogowany! Nie możesz utworzyć konta.' })
    }
    return res.render('register.ejs', { session: req.session });
}

exports.handleRegisterForm = async (req, res) => {

    await body('email').isEmail().withMessage('Podany adres e-mail jest nieprawidłowy!').run(req);
    await body('name').trim().escape().run(req);

    const validationErrors = validationResult(req).array()
    if (validationErrors.length !== 0) {
        return res.render('register.ejs', { error: validationErrors[0].msg, session: req.session });
    }

    if (req.body.password !== req.body.repeatPassword) {
        return res.render('register.ejs', { error: 'Podane hasła się nie zgadzają!', session: req.session });
    }

    firebaseService.signUpWithEmailAndPassword(req.body.email, req.body.password).then(user => {
        firebaseService.firebase.firestore().doc(`users/${user.user.uid}`).set({ wordAmount: 0, name: req.body.name}).then(_ => {
            req.session.uid = user.user.uid;
            req.session.name = req.body.name;
            user.user.getIdToken(true).then(token => {
                req.session.idToken = token;
                user.user.updateProfile({displayName: req.body.name}).then(_ => {
                    return res.render('index.ejs', { message: 'Pomyślnie zarejestrowano! Zostałeś automatycznie zalogowany.', session: req.session });
                })
            }).catch(error => {
                console.log(`TOKEN ERRROR (REGISTER) ${error}`);
            })
        }).catch(error => {
            console.log(`FIRESTORE ERROR: ${error}`);
        })
    }).catch(error => {
        switch (error.code) {
            case 'auth/email-already-in-use':
                return res.render('register.ejs', { error: 'Konto o danym adresie e-mail już istnieje!', session: req.session });
            case 'auth/weak-password':
                return res.render('register.ejs', { error: 'Hasło musi zawierać co najmniej 6 znaków!', session: req.session });
            default:
                console.log(`UNKNOWN ERROR: ${error}`);
        }
    });
}

exports.logout = async (req, res) => {
    await firebaseService.deleteSession(req.session.uid).catch(error => {
        console.log(`ERROR WHILE SIGNING OUT: ${error}`);
    });
    await firebaseService.firebase.auth().signOut().then(_ => {
        req.session.uid = undefined;
        req.session.idToken = undefined;
        req.session.name = undefined;
        req.session.photoURL = undefined;
        return res.render('index.ejs', { message: 'Pomyślnie wylogowano.', session: req.session });
    })
    
}
