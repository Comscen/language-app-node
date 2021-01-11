const database = require('firebase');
const firebaseConfig = require('./firebaseConfig');
const nanoid = require('nanoid')
const admin = require('firebase-admin')

var firebase = database.default.initializeApp(firebaseConfig);
var firebaseAdmin = admin.initializeApp(firebaseConfig)

async function deleteSession(uid){
    await firebaseAdmin.auth().revokeRefreshTokens(uid)
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}

async function saveWords(uid, object) {
    await getWordAmount(uid).then(async (wordAmount) => {
        for (let key of Object.keys(object)) {
            await checkIfWordExists(uid, key).then(async (exists) => {
                if (!exists) {
                    wordAmount++;
                    await firebase.firestore().doc(`users/${uid}/words/${key}`).set({
                        id: wordAmount,
                        translation: object[key].translation,
                        priority: object[key].priority,
                        learnt: false,
                        appeared: false,
                        dateAdded: new Date(),
                        dateLearnt: null,
                        timesInTest: 0
                    }).then(async function () { await updateWordAmount(uid, wordAmount) })
                } else {
                    await getWordByText(uid, key).then(async (result) => {
                        let priority = (await result.get()).data()['priority']
                        await updateWord(uid, key, { priority: priority + object[key].priority }).then()
                    })
                }
            })
        }
    })
}

async function saveTest(uid, testResult) {
    let id = nanoid(24)
    await firebase.firestore().doc(`users/${uid}/tests/${id}`).set({
        points: 0,
        maxPoints: Object.keys(testResult).length,
        dateCreated: testResult['dateCreated'],
        dateFinished: new Date()
    })
    for (let key of Object.keys(testResult)) {
        await firebase.firestore().doc(`users/${uid}/tests/${id}/words/${key}`).set({
            translation: testResult[key].translation,
            userInput: testResult[key].input
        })
    }
}

async function generateTestQuestions(uid) {
    let questionData;
    let indexes;
    let error = false;
    (await (await getAllNonLearntWords(uid)).where('appeared', '==', true).get().then(documents => {
        if(documents.size < 25){
            error = true;
            return;
        }
        do {
            let random = getRandomInt(1, documents.size)
            if(!indexes.includes(random)){
                indexes.push(random);
                questionData[documents.docs[random]]['translation'] = documents.docs[random].data()['translation'];
            }
        } while (indexes.length < 15);
        questionData['dateCreated'] = new Date();
    }));
    return !error ? questionData : error;
}

async function signInWithEmailAndPassword(email, password) {
    return await firebase.auth().signInWithEmailAndPassword(email, password)
}

async function signUpWithEmailAndPassword(email, password) {
    return await firebase.auth().createUserWithEmailAndPassword(email, password)
}

async function updateWord(uid, text, metadata) {
    let keys = Object.keys(metadata)
    let updateData = {};
    for (key of keys) {
        updateData[key] = metadata[key];
    }
    (await getWordByText(uid, text)).update(metadata)
}

async function getWordAmount(uid) {
    return await (await firebase.firestore().doc(`users/${uid}`).get()).data()['wordAmount']
}

async function updateWordAmount(uid, amount) {
    await firebase.firestore().doc(`users/${uid}`).set({ wordAmount: amount });
}

async function checkIfWordExists(uid, text) {
    return await (await firebase.firestore().doc(`users/${uid}/words/${text}`).get()).exists
}

async function getAppearedWords(uid) {
    return await (await getAllWords(uid)).where('appeared', '==', true)
}

async function getWordByText(uid, text) {
    return await firebase.firestore().doc(`users/${uid}/words/${text}`)
}

async function getWordByIndex(uid, index) {
    return await (await firebase.firestore().collection(`users/${uid}/words`).where('id', '==', index).limit(1).get()).docs[0]
}

async function getAllWords(uid) {
    return await firebase.firestore().collection(`users/${uid}/words`)
}

async function getAllNonLearntWords(uid) {
    return await (await getAllWords(uid)).where('learnt', '==', false)
}

async function getAllLearntWords(uid) {
    return await (await getAllWords(uid)).where('learnt', '==', true)
}

async function getWordsByPriority(uid) {
    return await (await getAllWords(uid)).orderBy('priority')
}

async function getWordsByLearningTries(uid) {
    return await (await getAllWords(uid)).orderBy('tries')
}

async function getWordsByTimesInTest(uid) {
    return await (await getAllWords(uid)).orderBy('timesInTest')
}

async function getWordsByDateAdded(uid) {
    return await (await getAllWords(uid)).orderBy('dateAdded')
}

async function getWordsByDateLearnt(uid) {
    return await (await getAllWords(uid)).orderBy('dateLearnt')
}


module.exports = {
    firebase,
    admin, 
    checkIfWordExists,
    updateWordAmount,
    getWordAmount,
    getWordByText,
    updateWord,
    saveWords,
    getAllLearntWords,
    getAllNonLearntWords,
    getAllWords,
    getWordByIndex,
    getWordByText,
    getWordsByDateAdded,
    getWordsByDateLearnt,
    getWordsByLearningTries,
    getWordsByPriority,
    getWordsByTimesInTest,
    signInWithEmailAndPassword,
    signUpWithEmailAndPassword,
    deleteSession
}