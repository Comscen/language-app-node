const firebaseService = require('../database')

exports.showLoginForm = (req, res) => {
    if(typeof req.session.idToken != 'undefined'){
        return res.render('index.ejs', {session:req.session, error: 'Jesteś już zalogowany!'})
    }
    return res.render('login.ejs', {session: req.session});
}

exports.handleEmailLogin = async (req, res) => {
    firebaseService.signInWithEmailAndPassword(req.body.email, req.body.password).then(user => {
        req.session.uid = user.user.uid;
        user.user.getIdToken(true).then(token => {
            req.session.idToken = token
            return res.render('index.ejs', {message: 'Pomyślnie zalogowano!', session: req.session })
        }).catch(error => {
            console.log(`BLAD TOKENU ${error}`)
        })
    }).catch(error => {
        switch (error.code) {
            case 'auth/wrong-email':
                return res.render('register.ejs', { error: 'Niepoprawny e-mail lub hasło.', session: req.session })
            case 'auth/wrong-password':
                return res.render('register.ejs', { error: 'Niepoprawny e-mail lub hasło.', session: req.session })
            default:
                console.log(`UNKNOWN ERROR: ${error}`);
        }
    })
}

exports.handleGoogleLogin = (req, res) => {

}

exports.handleFacebookLogin = (req, res) => {

}

exports.showRegisterForm = (req, res) => {
    if(typeof req.session.idToken != 'undefined'){
        return res.render('index.ejs', {session:req.session, error: 'Jesteś już zalogowany! Nie możesz utworzyć konta.'})
    }
    return res.render('register.ejs', {session: req.session});
}

exports.handleRegisterForm = async (req, res) => {
    

    if (req.body.password !== req.body.repeatPassword) {
        return res.render('register.ejs', { error: 'Podane hasła się nie zgadzają!', session: req.session });
    }
    firebaseService.signUpWithEmailAndPassword(req.body.email, req.body.password).then(user => {
        firebaseService.firebase.firestore().doc(`users/${user.user.uid}`).set({ wordAmount: 0 }).then(_ => {
            req.session.uid = user.user.uid;
            user.user.getIdToken(true).then(token => {
                req.session.idToken = token;
                return res.render('index.ejs', {message: 'Pomyślnie zarejestrowano! Zostałeś automatycznie zalogowany.', session: req.session })
            }).catch(error => {
                console.log(`BLAD TOKENU ${error}`)
            })
        }).catch(error => {
            console.log(`BLAD FIRESTORE ${error}`)
        })
    }).catch(error => {
        switch (error.code) {
            case 'auth/email-already-in-use':
                return res.render('register.ejs', { error: 'Konto o danym adresie e-mail już istnieje!', session: req.session })
            case 'auth/weak-password':
                console.log(error.message)
                return res.render('register.ejs', { error: 'Hasło musi zawierać co najmniej 6 znaków!', session: req.session })
            default:
                console.log(`UNKNOWN ERROR: ${error}`);
        }
    });
}

exports.logout = async (req, res) => {
    await firebaseService.deleteSession(req.session.uid);
    req.session.uid = undefined;
    req.session.idToken = undefined;
    return res.render('index.ejs', { message: 'Pomyślnie wylogowano.', session: req.session });
}
