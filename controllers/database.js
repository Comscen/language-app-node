const database = require('firebase');
const auth = require('firebase/app'); // for provider handling

var firebaseConfig = {
    apiKey: process.env.apiKey,
    authDomain: process.env.authDomain,
    databaseURL: process.env.databaseURL,
    projectId: process.env.projectId,
    storageBucket: process.env.storageBucket,
    messagingSenderId: process.env.messagingSenderId,
    appId: process.env.appId,
    measurementId: process.env.measurementId
};

var firebase = database.default.initializeApp(firebaseConfig);

async function signUpWithEmailAndPassword(email, password) {
    let user;
    await firebase.auth().createUserWithEmailAndPassword(email, password).then(user => {
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
    return user
}

async function signInWithEmailAndPassword(email, password) {
    let user;
    await firebase.auth().signInWithEmailAndPassword(email, password)
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
    return user
}

async function saveWord(uid, text, translation, priority, learnt = false, tries = 0, dateLearnt = null, timesinTest = 0) {
    let exists;
    await checkIfWordExists(uid, text).then(result => {
        exists = result;
    })
    if (!exists) {
        let wordAmount;
        await getWordAmount(uid).then(amount => { wordAmount = amount.data()['wordAmount'] });
        await firebase.firestore().doc(`users/${uid}/words/${text}`).set({
            id: wordAmount,
            translation: translation,
            priority: priority,
            learnt: learnt,
            tries: tries,
            dateAdded: new Date().toDateString(),
            dateLearnt: dateLearnt,
            timesInTest: timesinTest
        }).then(function () {
            incrementWordAmount(uid);
        });
    } else {
        console.log('Word already exists')
    }
}

async function updateWord(uid, text, metadata){
    let keys = Object.keys(metadata)
    let updateData = {};
    for (key of keys){
        updateData[key] = metadata[key];
    }
    let word = getWordByText(uid, text);
    (await word).update(metadata)
}

async function getWordByText(uid, text){
    return firebase.firestore().doc(`users/${uid}/words/${text}`)
}

async function getWordAmount(uid) {
    let wordAmount
    await firebase.firestore().doc(`users/${uid}`).get('wordAmount').then(result => {
        wordAmount = result
    })
    return wordAmount
}

async function incrementWordAmount(uid) {
    await firebase.firestore().doc(`users/${uid}`).get('wordAmount').then(object => {
        firebase.firestore().doc(`users/${uid}`).set({ wordAmount: object.data()['wordAmount'] + 1 });
    });
}

async function checkIfWordExists(uid, text) {
    let exists;
    await firebase.firestore().doc(`users/${uid}`).collection('words').where('text', 'in', [text]).get().then(result => {
        if (result.size === 0) {
            exists = false;
        } else {
            exists = true;
        }
    });
    return exists;
}