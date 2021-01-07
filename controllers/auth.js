exports.showLoginForm = (req, res) => {
    return res.render('login.ejs');
}

exports.handleEmailLogin = (req, res) => {
    let user;
    await firebase.auth().signInWithEmailAndPassword(req.body.email, req.body.password)
        .then(object => {
            user = object;
        })
        .catch(error => {
            // Handle Errors here.
            var errorCode = error.code;
            var errorMessage = error.message;
            if (errorCode === 'auth/wrong-password') {
                console.log('Wrong password.');
            } else {
                console.log(errorMessage);
            }
            console.log(error);
        })
    return user //todo
}

exports.handleGoogleLogin = (req, res) => {

}

exports.handleFacebookLogin = (req, res) => {

}

exports.showRegisterForm = (req, res) => {
    return res.render('register.ejs');
}

exports.handleRegisterForm = (req, res) => {
    let user;
    await firebase.auth().createUserWithEmailAndPassword(req.body.email, req.body.password).then(user => {
        firebase.firestore().doc(`users/${user.user.uid}`).set({ wordAmount: 0 }).
            then(result => {
                user = result;
            })
            .catch(error => {
                // Handle Errors here.
                var errorCode = error.code;
                var errorMessage = error.message;
                if (errorCode == 'auth/weak-password') {
                    console.log('The password is too weak.');
                } else {
                    console.log(errorMessage);
                }
                console.log(error);
            });

    })
    return user //todo
}
