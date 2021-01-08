const database = require('firebase');
const app = require('firebase/app'); // for provider handling
const firebaseConfig = require('./firebaseConfig');

var firebase = database.default.initializeApp(firebaseConfig);

async function saveWords(uid, object) {
    await getWordAmount(uid).then(async (wordAmount) => {
        for(let key of Object.keys(object)) {
            await checkIfWordExists(uid, key).then(async (exists) => {
                if (!exists) {
                    wordAmount++;
                    await firebase.firestore().doc(`users/${uid}/words/${key}`).set({
                        id: wordAmount,
                        translation: object[key].translation,
                        priority: object[key].priority,
                        learnt: false,
                        tries: 0,
                        dateAdded: new Date(),
                        dateLearnt: null,
                        timesInTest: 0
                    }).then(async function() {await updateWordAmount(uid, wordAmount)})
                } else {
                    await getWordByText(uid, key).then(async (result) => {
                        let priority = (await result.get()).data()['priority']
                        await updateWord(uid, key, {priority: priority+object[key].priority}).then(
                            console.log(`Priority of word ${key} has been increased`)
                        )
                    })
                    console.log('Word already exists')
                }
            })
        }
    })
}

async function updateWord(uid, text, metadata) {
    let keys = Object.keys(metadata)
    let updateData = {};
    for (key of keys) {
        updateData[key] = metadata[key];
    }
    (await getWordByText(uid, text)).update(metadata)
}

async function getWordByText(uid, text) {
    return await firebase.firestore().doc(`users/${uid}/words/${text}`)
}

async function getWordByIndex(uid, index){
    await (await firebase.firestore().collection(`users/${uid}/words`).where('id', '==', index).limit(1).get()).docs[0]
}

async function getWordAmount(uid) {
    return await (await firebase.firestore().doc(`users/${uid}`).get()).data()['wordAmount']
}

async function updateWordAmount(uid, amount) {
    await firebase.firestore().doc(`users/${uid}`).set({ wordAmount: amount});
}

async function checkIfWordExists(uid, text) {
    return await (await firebase.firestore().doc(`users/${uid}/words/${text}`).get()).exists
}

module.exports = {checkIfWordExists, updateWordAmount, getWordAmount, getWordByText, updateWord, saveWords, firebase}