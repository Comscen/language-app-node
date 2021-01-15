/**
 * @file database.js is a file responsible for direct operations on firebase
 * @author Czajkowski Sebastian
 * @author Tangri Michał
 */

const database = require('firebase');
const firebaseConfig = require('./firebaseConfig');
const { nanoid } = require('nanoid')
const admin = require('firebase-admin');

// Initializing necessary applications for firebase connection
var firebase = database.default.initializeApp(firebaseConfig);
var firebaseAdmin = admin.initializeApp(firebaseConfig)

/** 
 * Deletes user's session in firebase authentication
 * 
 * @author Czajkowski Sebastian
 * @async
 * @param {string} uid User's id 
 */
async function deleteSession(uid) {
    await firebaseAdmin.auth().revokeRefreshTokens(uid)
}

/**
 * Generates a random int between a minimum and a maximum.
 * Used for random queries.
 * 
 * @link https://stackoverflow.com/a/1527820
 * @param {number} min Minimal value for generated number.
 * @param {number} max Maximum value for generated number.
 * @returns {number} Random number between min and max.
 */
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * Adds words to the specified user's words collection.
 * 
 * @author Czajkowski Sebastian
 * @author Michał Tangri
 * @param {string} uid User's id.
 * @param {object} words Object containing objects which contain word data which will be parsed and added to database.
 */
async function saveWords(uid, words) {

    // Gets the total amount of words a user has.
    await getWordAmount(uid).then(async (wordAmount) => {

        // Iterates through all words of the object received
        for (let key of Object.keys(words)) {

            // Checks whether if given word exists in user's collection.
            await checkIfWordExists(uid, key).then(async (exists) => {

                // If the word does not exist, word amount is incremented and the object is saved.
                if (!exists) {
                    wordAmount++;

                    // Word metadata is passed to firestore.set() function in order to add it to the database.
                    // After the word is saved, the incremented amount of words is then saved to database.
                    await firebase.firestore().doc(`users/${uid}/words/${key}`).set({
                        id: wordAmount,
                        translation: words[key].translation,
                        priority: words[key].priority,
                        learnt: false,
                        appeared: false,
                        dateAdded: new Date(),
                        dateLearnt: null,
                        timesInTest: 0
                    }).then(async function () { await updateWordAmount(uid, wordAmount) })
                } else {

                    // If the word exists, it is loaded from database and it's priority is increased by how many times
                    // the word has been detected in a file.
                    await getWordByTextReference(uid, key).then(async (result) => {
                        let priority = (await result.get()).data()['priority']
                        await updateWord(uid, key, { priority: priority + words[key].priority }).then()
                    })
                }
            })
        }
    })
}

/**
 * Saves a test to database.
 * A test contains of points earned, maximum amount of points and both the date of start and finish.
 * In addition, words and their translation is also saved.
 * 
 * @author Czajkowski Sebastian
 * @author Michał Tangri
 * @param {string} uid - User's id.
 * @param {object} testResults - object with data about the test.
 */
async function saveTest(uid, testResults) {

    // Generates a random string with length of 24
    let id = nanoid(24);

    // Saves a test in a user's tests collection in the database.
    await firebase.firestore().doc(`users/${uid}/tests/${id}`).set({
        points: testResults.points,
        maxPoints: testResults.maxPoints,
        dateCreated: new Date(testResults.dateStarted),
        dateFinished: new Date(testResults.dateFinished)
    });

    // Iterates through all the words in testResults and saves each word and it's translation to the test above.
    for (let key of Object.keys(testResults.words)) {
        await firebase.firestore().doc(`users/${uid}/tests/${id}/words/${key}`).set({
            translation: testResults.words[key].translation,
            userInput: testResults.words[key].answer
        });
    }
}

/**
 * Generates a set of words for a test.
 * The words are picked at random using a random number generator function and the id field of a word.
 * 
 * @author Czajkowski Sebastian
 * @param {string} uid - User's id.
 * @param {number} amount - Amount of words to be loaded from the database.
 * @returns {string|object} - Returns an error if it is set to true, or question data, if error is false.
 */
async function generateTestQuestions(uid, amount = 24) {
    let questionData = {};
    let indexes = [];
    let error = false;

    // Gets all words from a user's collection, where the words learn field is set to false.
    await getAllNonLearntWordsReference(uid).then(async words => {

        // From the query above, it further nests the query to only load the words where appeared field is true.
        await words.where('appeared', '==', true).get().then(documents => {

            /**
             * If query result size is smaller than the amount of questions to be generated for a test it sets error to true
             * and function ends. 
             * Otherwise it generates a random number and gets a document with given, randomly generated id
             * and saves it to an object as a key-value field. The preceding operation is repeated until
             * the amount of questions is exactly as given in the function parameter. After that the date
             * of test creation is saved to the object.
             */
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

/**
 * @author Czajkowski Sebastian
 * @param {*} uid - User's id.
 * @param {*} amount - Amount of words to be loaded from the database.
 * @returns {string|object} Returns an error if it is set to true, or word data, if error is false. 
 */
async function generateWordsForLearning(uid, amount=20) {
    let wordsData = {};
    let indexes = [];
    let error = false;

    // Gets all words from a user's collection, where the words learn field is set to false.
    await getAllNonLearntWordsReference(uid).then(async words => {
        
        // From the query above, it further nests the query to only load the words where appeared field is false.
        await words.where('appeared', '==', false).get().then(documents => {

            /**
             * If query result size is smaller than the amount of words to be generated for a test it sets error to true
             * and function ends. 
             * Otherwise it generates a random number and gets a document with given, randomly generated id
             * and saves it to an object as a key-value field. The preceding operation is repeated until
             * the amount of words is exactly as given in the function parameter. A
             */
            if (documents.size < 20) {
                error = true;
                return;
            }
            do {
                let random = getRandomInt(1, documents.size)
                if (!indexes.includes(random)) {
                    indexes.push(random);
                    wordsData[documents.docs[random].id] = documents.docs[random].data()['translation'];
                }
            } while (indexes.length < amount);
        }).catch(error => {
            console.log(error)
        })
    }).catch(error => {
        console.log(error)
    })
    return !error ? wordsData : error;
}

/**
 * Signs in the user using the firebase email & password authentication method.
 * 
 * @author Czajkowski Sebastian
 * @param {string} email - User's email.
 * @param {string} password - User's password.
 * @returns {Promise<firebase.default.auth.UserCredential>} Promise with user's credentials
 */
async function signInWithEmailAndPassword(email, password) {
    return await firebase.auth().signInWithEmailAndPassword(email, password)
}

/**
 * Creates a user using the firebase email & password authentication method.
 * It automatically signs in the user.
 * 
 * @author Czajkowski Sebastian
 * @param {string} email - User email.
 * @param {string} password - User's password.
 * @returns {Promise<firebase.default.auth.UserCredential>} Promise with user's credentials
 */
async function signUpWithEmailAndPassword(email, password) {
    return await firebase.auth().createUserWithEmailAndPassword(email, password)
}

/**
 * Updates the given user's word given in function paramater with given metadata.
 * 
 * @author Czajkowski Sebastian
 * @param {string} uid - User id.
 * @param {string} text - Word id.
 * @param {object} metadata - Word data.
 */
async function updateWord(uid, text, metadata) {
    (await getWordByTextReference(uid, text)).update(metadata).catch(error => console.log(`ERROR WHILE UPDATING WORD "${text}": ${error}`))
}

/**
 * Iterates through the array and calls updateWord() method to update an array of words.
 * 
 * IMPORTANT: Currently only used in the learning module, so the metadata is preset.
 * 
 * @author Czajkowski Sebastian
 * @param {string} uid - User's id.
 * @param {array} wordArray - Array of word ids.
 */
async function updateWords(uid, wordArray) {
    for(let word of wordArray){
        await updateWord(uid, word, {appeared: true})
    }
}

/**
 * Gets the word amount of given user.
 * 
 * @author Czajkowski Sebastian
 * @param {string} uid - User's id.
 */
async function getWordAmount(uid) {
    return await (await firebase.firestore().doc(`users/${uid}`).get()).data()['wordAmount']
}

/**
 * Updates the word amount of given user.
 * 
 * @author Czajkowski Sebastian
 * @param {string} uid - User's id.
 * @param {number} amount - Number to be inserted into wordAmount field.
 */
async function updateWordAmount(uid, amount) {
    await firebase.firestore().doc(`users/${uid}`).set({ wordAmount: amount });
}
/**
 * Checks if a given word exists in the user's collection.
 * 
 * @author Czajkowski Sebastian
 * @param {string} uid - User's id
 * @param {string} text - Word id
 * @returns {boolean} True if the word exist.
 */
async function checkIfWordExists(uid, text) {
    return await firebase.firestore().doc(`users/${uid}/words/${text}`).get().exists
}

/**
 * Gets all statistics for the given user.
 * 
 * @author Czajkowski Sebastian
 * @param {string} uid - User's id
 * @returns {object} Object with all of the statistics.
 */
async function getStats(uid) {
    let statsData = {};

    // Gets CollectionReference to the tests collection.
    await getUserTestsReference(uid).then(async testsQuery => {

        // Gets the total amount of tests
        statsData['testsAmount'] = (await testsQuery.get()).docs.length

        // Gets 10 latest tests and save them and their data to the statsData object.
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

    //Gets CollectionReference to the words collection.
    await getAllWordsReference(uid).then(async wordsQuery => {

        // Gets the total amount of words.
        statsData['wordsAmount'] = (await wordsQuery.get()).docs.length

        // Gets 10 latest learnt words and save them and their data to the statsData object.
        await (wordsQuery.orderBy('dateLearnt', 'desc').limit(10).get()).then(words => {
            statsData['words'] = {}
            words.forEach(word => {
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

/**
 * Gets all tests of the given user.
 * 
 * @author Czajkowski Sebastian
 * @param {string} uid - User's id.
 * @returns {CollectionReference} CollectionReference to all of the user's tests.
 */
async function getUserTestsReference(uid) {
    return firebase.firestore().collection(`users/${uid}/tests`)
}

/**
 * Get a single word of a given user by it's name. 
 * 
 * @author Czajkowski Sebastian
 * @param {string} uid - User's id.
 * @returns {DocumentnReference} DocumentReference to the word document.
 */
async function getWordByTextReference(uid, text) {
    return firebase.firestore().doc(`users/${uid}/words/${text}`)
}

/**
 * Get a single word of a given user by it's id field. 
 * 
 * @author Czajkowski Sebastian
 * @param {string} uid - User's id.
 * @returns {DocumentnReference} DocumentReference to the word document.
 */
async function getWordByIndex(uid, index) {
    return await firebase.firestore().collection(`users/${uid}/words`).where('id', '==', index).limit(1).get().docs[0]
}

/**
 * Gets all words of the given user.
 * 
 * @author Czajkowski Sebastian
 * @param {string} uid - User's id.
 * @returns {CollectionReference} CollectionReference with all words of the user.
 */
async function getAllWordsReference(uid) {
    return firebase.firestore().collection(`users/${uid}/words`)
}

/**
 * Gets all words of the given user with their learnt fields set to false.
 * 
 * @author Czajkowski Sebastian
 * @param {string} uid  - User's id.
 * @returns {CollectionReference} CollectionReference to all non-learnt words.
 */
async function getAllNonLearntWordsReference(uid) {
    return (await getAllWordsReference(uid)).where('learnt', '==', false)
}

/**
 * Gets all words of the given user with their learnt firelds set to true.
 * 
 * @author Czajkowski Sebastian
 * @param {string} uid  - User's id.
 * @returns {CollectionReference} CollectionReference to all learnt words.
 */
async function getAllLearntWordsReference(uid) {
    return (await getAllWordsReference(uid)).where('learnt', '==', true)
}

/**
 * Gets a user with given uid.
 * 
 * @param {string} uid - User's id.
 * @returns {Promise<admin.auth.UserRecord>} Promise with the UserRecord.
 */
async function getUserById(uid) {
    return await admin.auth().getUser(uid)
}

module.exports = {
    firebase,
    admin,
    checkIfWordExists,
    updateWordAmount,
    getWordAmount,
    getWordByText: getWordByTextReference,
    updateWord,
    updateWords,
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
    generateWordsForLearning,
    saveTest,
    getStats,
    getUserById
}