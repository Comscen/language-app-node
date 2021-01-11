const database = require('firebase');
const firebaseConfig = require('./firebaseConfig');
const { nanoid } = require('nanoid')
const admin = require('firebase-admin');
const { addConsoleHandler } = require('selenium-webdriver/lib/logging');

var firebase = database.default.initializeApp(firebaseConfig);
var firebaseAdmin = admin.initializeApp(firebaseConfig)

async function deleteSession(uid) {
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
                    await getWordByTextReference(uid, key).then(async (result) => {
                        let priority = (await result.get()).data()['priority']
                        await updateWord(uid, key, { priority: priority + object[key].priority }).then()
                    })
                }
            })
        }
    })
}

async function saveTest(uid, testResults) {
    let id = nanoid(24);
    await firebase.firestore().doc(`users/${uid}/tests/${id}`).set({
        points: testResults.points,
        maxPoints: testResults.maxPoints,
        dateCreated: new Date(testResults.dateStarted),
        dateFinished: new Date(testResults.dateFinished)
    });
    for (let key of Object.keys(testResults.words)) {
        await firebase.firestore().doc(`users/${uid}/tests/${id}/words/${key}`).set({
            translation: testResults.words[key].translation,
            userInput: testResults.words[key].answer
        });
    }
}

async function generateTestQuestions(uid, amount=24) {
    let questionData = {};
    let indexes = [];
    let error = false;
    await getAllNonLearntWordsReference(uid).then(async words => {
        await words.where('appeared', '==', true).get().then(documents => {
            if (documents.size < amount) {
                error = true;
                return;
            }
            do {
                let random = getRandomInt(1, documents.size)
                if (!indexes.includes(random)) {
                    indexes.push(random);
                    questionData[documents.docs[random].id] = documents.docs[random].data()['translation']
                }
            } while (indexes.length < amount);
            questionData['dateCreated'] = new Date();
        }).catch(error => {
            console.log(error)
        })
    }).catch(error => {
        console.log(error)
    })
    return error ? null : questionData;
}

async function signInWithEmailAndPassword(email, password) {
    return await firebase.auth().signInWithEmailAndPassword(email, password)
}

async function signUpWithEmailAndPassword(email, password) {
    return await firebase.auth().createUserWithEmailAndPassword(email, password)
}

async function updateWord(uid, text, metadata) {
    (await getWordByTextReference(uid, text)).update(metadata)
}

async function updateWords(uid, metadata) {
    Object.keys(metadata).forEach(async object => {
        let updateData = {}
        Object.keys(metadata[object]).forEach(key =>{
            updateData[key] = metadata[object][key]
        })
        await updateWord(uid, object, updateData)
    })
} 

async function getWordAmount(uid) {
    return await (await firebase.firestore().doc(`users/${uid}`).get()).data()['wordAmount']
}

async function updateWordAmount(uid, amount) {
    await firebase.firestore().doc(`users/${uid}`).set({ wordAmount: amount });
}

async function checkIfWordExists(uid, text) {
    return await firebase.firestore().doc(`users/${uid}/words/${text}`).get().exists
}

async function getWordByTextReference(uid, text) {
    return firebase.firestore().doc(`users/${uid}/words/${text}`)
}

async function getWordByIndex(uid, index) {
    return await firebase.firestore().collection(`users/${uid}/words`).where('id', '==', index).limit(1).get().docs[0]
}

async function getAllWordsReference(uid) {
    return firebase.firestore().collection(`users/${uid}/words`)
}

async function getAllNonLearntWordsReference(uid) {
    return (await getAllWordsReference(uid)).where('learnt', '==', false)
}

async function getAllLearntWordsReference(uid) {
    return await getAllWordsReference(uid).where('learnt', '==', true)
}

module.exports = {
    firebase, 
    admin,
    checkIfWordExists, 
    updateWordAmount, 
    getWordAmount,
    getWordByText: getWordByTextReference, 
    updateWord, 
    saveWords,
    getAllLearntWords: getAllLearntWordsReference, 
    getAllNonLearntWords: 
    getAllNonLearntWordsReference, 
    getAllWords: getAllWordsReference, 
    getWordByIndex, 
    getWordByText: getWordByTextReference, 
    signInWithEmailAndPassword,
    signUpWithEmailAndPassword, 
    deleteSession, 
    generateTestQuestions,
    saveTest
}