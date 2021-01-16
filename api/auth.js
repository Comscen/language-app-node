/**
 * @file api/auth.js is an API controller responsible for retrieving UIDs and creating accounts
 * @author Czajkowski Sebastian
 */

const { body, validationResult } = require('express-validator');
const firebaseService = require('../database')


/** Handles '/auth/login' (API) POST request to get UID using user's e-mail address and password
 * 
 *  UID, name and profile picture URL are sent in a response.
 * 
 *  @async
 *  @param {Request} req - Request received from client.
 *  @param {Response} res - Response to be sent to client.
 */
exports.getUIDByEmail = async (req, res) => {
    
    const email = req.params.email;
    const password = req.params.password;

    if (typeof email == 'undefined' || typeof password == 'undefined') {
        return res.status(406).send({ error: 'Both e-mail address and password are required.'})
    }

    let status = 200;
    /* Response data to be sent back */
    let response = {}

    /* Array of string representing errors to be sent in a response */
    let errors = []
    await firebaseService.signInWithEmailAndPassword(email, password).then(user => {

        /* Save data to response data object */
        response['uid'] = user.user.uid;
        response['name'] = user.user.displayName;
        response['photoURL'] = user.user.photoURL == null ? '' : user.user.photoURL;

    }).catch(error => {
        /* Catch errors and display proper messages based on error code */
        status = 409
        switch (error.code) {
            case 'auth/wrong-email':
                errors.push('Invalid e-mail or password');
                break;
            case 'auth/wrong-password':
                errors.push('Invalid e-mail or password');
                break;
            case 'auth/user-not-found':
                errors.push('Invalid e-mail or password');
                break;
            default:
                console.log(`UNKNOWN ERROR: ${error} (${error.code})`);
        }
    })
    return res.status(status).send({ errors: errors, response: response})
}


/** Handles '/auth/oauth' (API) POST request to get UID using user's idToken from OAuth and
 *  registers an account in database if necessary.
 * 
 *  UID, name and profile picture URL are sent in a response.
 * 
 *  @async
 *  @param {Request} req - Request received from client.
 *  @param {Response} res - Response to be sent to client.
 */
exports.getUIDByToken = async (req, res) => {
    /* Retrieve idToken from the client */
    const idToken = req.body.idToken;
    if (typeof idToken == 'undefined') {
        return res.status(406).send({ error: 'idToken is required.'})
    }

    let status = 200;
    /* Response data to be sent back */
    let response = {}

    /* Array of string representing errors to be sent in a response */
    let errors = []

    /* Decode idToken and get data associated with it*/
    await firebaseService.admin.auth().verifyIdToken(idToken).then(decodedToken => {

        /* Save all the necessary data to response data object */
        response['uid'] = decodedToken.uid;
        response['name'] = decodedToken.name;
        response['photoURL'] = decodedToken.picture;

    }).catch(error => {
        console.log(`Error while saving data from OAuth login: ${error}`);
    })

    /* Check if user has ever signed in with this e-mail address before to decide if
    *  wordAmount field should be created in database
    */
    try {
        /* If wordAmount does not exist, this query will throw an error */
        await (await firebaseService.firebase.firestore().doc(`users/${response['uid']}`).get()).data()['wordAmount'];
    } catch (error) {
        /* If error is thrown, wordAmount field with initial value 0 shall be created */
        await firebaseService.firebase.firestore().doc(`users/${response['uid']}`).set({ wordAmount: 0, name: req.session.name }).then(_ => {

        }).catch(error => {
            errors.push(error);
        })
    }
    return res.status(status).send({ errors: errors, response: response });
}

/** Handles '/auth/oauth' (API) POST request to get UID using user's idToken from OAuth and
 *  registers an account in database.
 * 
 *  UID is sent in a response.
 * 
 *  @async
 *  @param {Request} req - Request received from client.
 *  @param {Response} res - Response to be sent to client.
 */
exports.createAccount = async (req, res) => {

    const email = req.body.email;
    const password = req.body.password;
    const name = req.body.name;

    if (typeof email == 'undefined' || typeof password == 'undefined' || typeof name == 'undefined') {
        return res.status(406).send({ error: 'E-mail address, password and name are required.'})
    }

    let status = 200;
    /* Response data to be sent back */
    let response = {}

    /* Array of string representing errors to be sent in a response */
    let errors = []

    /* Check if provided e-mail address is a valid one */
    await body('email').isEmail().withMessage('Podany adres e-mail jest nieprawidłowy!').run(req);

    /* Trim whitespaces and remove HTML characters from user's name */
    await body('name').trim().escape().run(req);

    /* Check for errors that might have appeared during validation.
     * If there are any, append them to errors array.
     */
    const validationErrors = validationResult(req).array()
    if (validationErrors.length !== 0) {
        status = 400;
        errors.push(validationErrors[0].msg)
    }

    /* Create a new account with submitted credentials */
    await firebaseService.signUpWithEmailAndPassword(req.body.email, req.body.password).then(async user => {

        /* Save newly created account to database and add 'wordAmount' field to it */
        await firebaseService.firebase.firestore().doc(`users/${user.user.uid}`).set({ wordAmount: 0, name: req.body.name }).then(async _ => {

            /* Save necessary data to user's session */
            response['uid'] = user.user.uid;

            /* Save user's name to database */
            await user.user.updateProfile({ displayName: req.body.name }).then(_ => {})

        }).catch(error => {
            console.log(`FIRESTORE ERROR: ${error}`);
        })

    }).catch(error => {
        /* Catch errors and display proper messages based on error code */
        status = 409;
        switch (error.code) {
            case 'auth/email-already-in-use':
                errors.push('E-mail already taken!');
                break;
            case 'auth/weak-password':
                errors.push('Password must be at least 6 characters long');
                break;
            default:
                console.log(`UNKNOWN ERROR: ${error}`);
        }
    });

    return res.status(status).send({ errors: errors, response: response });
}

