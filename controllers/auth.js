/**
 * @file auth.js is a controller responsible for signin in, signin up and signin out users
 * @author Czajkowski Sebastian
 * @author Tangri Michał
 */

const { body, validationResult } = require('express-validator');
const firebaseService = require('../database')


/** Handles '/auth/login' GET request to render login form.
 *  
 *  It checks if user's idToken is saved in session to decide whether said user is not already logged in 
 *  or he is and should be denided access to login form.
 * 
 *  @author Tangri Michał
 *  @param {Request} req - Request received from client.
 *  @param {Response} res - Response to be sent to client.
 */
exports.showLoginForm = (req, res) => {
    if (typeof req.session.idToken != 'undefined') {
        return res.render('index.ejs', { session: req.session, error: 'Jesteś już zalogowany!' })
    }
    return res.render('login.ejs', { session: req.session });
}


/** Handles '/auth/login' POST request to sing user in using his e-mail address
 *  and save his credentials to his session.
 * 
 *  After a successful sign in, UID, idToken, name and profile picture URL are saved.
 *  Then, user is redirected to the main page.
 * 
 *  @author Czajkowski Sebastian 
 *  @author Tangri Michał 
 *  @async
 *  @param {Request} req - Request received from client.
 *  @param {Response} res - Response to be sent to client.
 */
exports.handleEmailLogin = async (req, res) => {
    /* Sign user in */
    firebaseService.signInWithEmailAndPassword(req.body.email, req.body.password).then(user => {

        /* Save necessary data to user's session */
        req.session.uid = user.user.uid;
        req.session.name = user.user.displayName;
        req.session.photoURL = user.user.photoURL == null ? undefined : user.user.photoURL;

        /* Retrieve idToken asynchronously */
        user.user.getIdToken(true).then(token => {
            req.session.idToken = token
            return res.render('index.ejs', { message: 'Pomyślnie zalogowano!', session: req.session })
        }).catch(error => {
            console.log(`TOKEN ERROR (LOGIN) ${error}`)
        })
    }).catch(error => {
        /* Catch errors and display proper messages based on error code */
        switch (error.code) {
            case 'auth/wrong-email':
                return res.render('login.ejs', { error: 'Niepoprawny e-mail lub hasło.', session: req.session })
            case 'auth/wrong-password':
                return res.render('login.ejs', { error: 'Niepoprawny e-mail lub hasło.', session: req.session })
            case 'auth/user-not-found':
                return res.render('login.ejs', { error: 'Niepoprawny e-mail lub hasło.', session: req.session })
            default:
                console.log(`UNKNOWN ERROR: ${error} (${error.code})`);
        }
    })
}


/** Handles '/auth/oauth' POST request to sing user in using Google, Facebook or Twitter
 *  and save his credentials to his session.
 * 
 *  IdToken must be received from the client.
 * 
 *  After a successful sign in, UID, idToken, name and profile picture URL are saved.
 *  We also mark the fact that user has signed in using OAuth.
 *
 * 
 *  @author Tangri Michał
 *  @async
 *  @param {Request} req - Request received from client.
 *  @param {Response} res - Response to be sent to client.
 */
exports.handleOAuthLogin = async (req, res) => {
    /* Retrieve idToken from the client */
    const idToken = req.body.idToken;

    /* Decode idToken and get data associated with it*/
    await firebaseService.admin.auth().verifyIdToken(idToken).then(decodedToken => {

        /* Save all the necessary data to session */
        req.session.name = decodedToken.name;
        req.session.uid = decodedToken.uid;
        req.session.photoURL = decodedToken.picture;
        req.session.oauth = true;
        req.session.idToken = idToken;
    }).catch(error => {
        console.log(`Error while saving data from OAuth login: ${error}`);
    })

    await firebaseService.firebase.auth().signInWithCustomToken(idToken).then(() => {

    }).catch(failure => {
        console.log(failure);
    });

    await firebaseService.firebase


    /* Check if user has ever signed in with this e-mail address before to decide if
    *  wordAmount field should be created in database
    */
    try {
        /* If wordAmount does not exist, this query will throw an error */
        await (await firebaseService.firebase.firestore().doc(`users/${req.session.uid}`).get()).data()['wordAmount'];
    } catch (error) {
        /* If error is thrown, wordAmount field with initial value 0 shall be created */
        await firebaseService.firebase.firestore().doc(`users/${req.session.uid}`).set({ wordAmount: 0, name: req.session.name }).then(_ => {

        }).catch(error => {
            console.log(`FIRESTORE ERROR: ${error}`);
        })
    }
    return res.render('index.ejs', { session: req.session, message: 'Pomyślnie zalogowano!' });
}


/** Handles '/auth/register' GET request to render register form.
 *  
 *  It checks if user's idToken is saved in session to decide whether said user is not already logged in 
 *  or he is and should be denided access to login form.
 * 
 *  @author Tangri Michał
 *  @param {Request} req - Request received from client.
 *  @param {Response} res - Response to be sent to client.
 */
exports.showRegisterForm = (req, res) => {
    if (typeof req.session.idToken != 'undefined') {
        return res.render('index.ejs', { session: req.session, error: 'Jesteś już zalogowany! Nie możesz utworzyć konta.' })
    }
    return res.render('register.ejs', { session: req.session });
}


/** Handles '/auth/register' POST request to sing user up and save his credentials to his session.
 * 
 *  After a successful sign up, UID, idToken and name are saved.
 *  We also mark the fact that user has signed in using OAuth.
 * 
 *  Then, user is automatically signed in and redirected to the main page.
 * 
 *  @author Czajkowski Sebasian
 *  @async
 *  @param {Request} req - Request received from client.
 *  @param {Response} res - Response to be sent to client.
 */
exports.handleRegisterForm = async (req, res) => {

    /* Check if provided e-mail address is a valid one */
    await body('email').isEmail().withMessage('Podany adres e-mail jest nieprawidłowy!').run(req);

    /* Trim whitespaces and remove HTML characters from user's name */
    await body('name').trim().escape().run(req);

    /* Check for errors that might have appeared during validation.
     * If there are any, display them to user.
     */
    const validationErrors = validationResult(req).array()
    if (validationErrors.length !== 0) {
        return res.render('register.ejs', { error: validationErrors[0].msg, session: req.session });
    }

    /* Check if passwords match and if they do not, display an eror message to user */
    if (req.body.password !== req.body.repeatPassword) {
        return res.render('register.ejs', { error: 'Podane hasła się nie zgadzają!', session: req.session });
    }

    /* Create a new account with submitted credentials */
    firebaseService.signUpWithEmailAndPassword(req.body.email, req.body.password).then(user => {

        /* Save newly created account to database and add 'wordAmount' field to it */
        firebaseService.firebase.firestore().doc(`users/${user.user.uid}`).set({ wordAmount: 0, name: req.body.name }).then(_ => {

            /* Save necessary data to user's session */
            req.session.uid = user.user.uid;
            req.session.name = req.body.name;

            /* Retrieve idToken asynchronously */
            user.user.getIdToken(true).then(token => {
                req.session.idToken = token;

                /* Save user's name to database and redirect him to index page to display a success message */
                user.user.updateProfile({ displayName: req.body.name }).then(_ => {
                    return res.render('index.ejs', { message: 'Pomyślnie zarejestrowano! Zostałeś automatycznie zalogowany.', session: req.session });
                })
            }).catch(error => {
                console.log(`TOKEN ERROR (REGISTER) ${error}`);
            })
        }).catch(error => {
            console.log(`FIRESTORE ERROR: ${error}`);
        })
    }).catch(error => {
        /* Catch errors and display proper messages based on error code */
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


/** Handles '/auth/logout' POST request to sing user out and remove his credentials from his session.
 * 
 *  After a successful sign out user is to the main page and a message is displayed.
 * 
 *  @author Czajkowski Sebasian
 *  @author Tangri Michał
 *  @async
 *  @param {Request} req - Request received from client.
 *  @param {Response} res - Response to be sent to client.
 */
exports.logout = async (req, res) => {

    /* Delete user's session from Firestore */
    await firebaseService.deleteSession(req.session.uid).catch(error => {
        console.log(`ERROR WHILE SIGNING OUT: ${error}`);
    });

    /* Sign out a user from Firebase Auth and remove all credentials stored in current session */
    await firebaseService.firebase.auth().signOut().then(_ => {
        req.session.uid = undefined;
        req.session.idToken = undefined;
        req.session.name = undefined;
        req.session.photoURL = undefined;
        req.session.oauth = undefined;
        delete req.session.wordData;
        delete req.session.testData;
        return res.render('index.ejs', { message: 'Pomyślnie wylogowano.', session: req.session });
    });

}
