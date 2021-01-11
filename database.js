const database = require('firebase');
const firebaseConfig = require('./firebaseConfig');
const nanoid = require('nanoid')
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
                        await updateWord(uid, key, { priority: priority + object[key].priority }).then(
                            console.log(`Priority of word ${key} has been increased`)
                        )
                    })
                    console.log('Word already exists')
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
    let questionData = {};
    let indexes = [];
    let error = false;
    await getAllNonLearntWordsReference(uid).then(async words => {
        await words.where('appeared', '==', true).get().then(documents => {
            if (documents.size < 24) {
                error = true;
                return;
            }
            do {
                let random = getRandomInt(1, documents.size)
                if (!indexes.includes(random)) {
                    indexes.push(random);
                    questionData[documents.docs[random].id] = documents.docs[random].data()['translation']
                }
            } while (indexes.length < 24);
            questionData['dateCreated'] = new Date();
        }).catch(error => {
            console.log(error)
        })
    }).catch(error => {
        console.log(error)
    })
    return !error ? questionData : error;
}

async function generateWordsForLearning(uid) {
    let wordsData = {}
    let indexes
    let error = false
    await getAllNonLearntWordsReference(uid).then(async words => {
        await words.where('appeared', '==', false).get().then(documents => {
            if (documents.size < 15) {
                error = true;
                return;
            }
            do {
                let random = getRandomInt(1, documents.size)
                if (!indexes.includes(random)) {
                    indexes.push(random);
                    wordData[documents.docs[random].id] = documents.docs[random].data()['translation']
                }
            } while (indexes.length < 24);
        }).catch(error => {
            console.log(error)
        })
    }).catch(error => {
        console.log(error)
    })
    return !error ? wordsData : error;
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

async function getStats(uid) {
    let statsData = {};
    await getUserTestsReference(uid).then(async testsQuery => {
        statsData['testsAmount'] = (await testsQuery.get()).docs.length
        await testsQuery.orderBy('dateFinished', 'desc').limit(10).get().then(tests => {
            statsData['tests'] = {}
            tests.forEach(test => {
                statsData['tests'][test.id] = {
                    points: test.data()['points'],
                    maxpoints: test.data()['maxPoints'],
                    dateFinished: test.data()['dateFinished']
                }
            })
        }).catch(error => {
            console.log(error)
        })
    }).catch(error => {
        console.log(error)
    })
    await getAllWordsReference(uid).then(async wordsQuery => {
        statsData['wordsAmount'] = (await wordsQuery.get()).docs.length
        await (wordsQuery.orderBy('dateLearnt', 'desc').limit(10).get()).then(words => {
            statsData['words']= {}
            words.forEach(word => {
                console.log(word.id)
                statsData['words'][word.id] = word.data()['translation']
            })
        }).catch(error => {
            console.log(error)
        })
    }).catch(error => {
        console.log(error)
    })
    return statsData
}

async function getUserTestsReference(uid) {
    return firebase.firestore().collection(`users/${uid}/tests`)
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
    return (await getAllWordsReference(uid)).where('learnt', '==', true)
}

async function getUserById(uid){
    return await admin.auth().getUser(uid)
}

module.exports = {
    firebase, admin, checkIfWordExists, updateWordAmount, getWordAmount, getWordByText: getWordByTextReference, updateWord, saveWords,
    getAllLearntWords: getAllLearntWordsReference, getAllNonLearntWords: getAllNonLearntWordsReference, getAllWords: getAllWordsReference, getWordByIndex, getWordByText: getWordByTextReference, signInWithEmailAndPassword,
    signUpWithEmailAndPassword, deleteSession, generateTestQuestions, generateWordsForLearning, getUserById
}