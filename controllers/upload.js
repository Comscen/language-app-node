global.XMLHttpRequest = require('xhr2')
require('firebase/storage');

const { Translate } = require('@google-cloud/translate').v2;
const { nanoid } = require('nanoid');
const vision = require('@google-cloud/vision');
const firebaseConfig = require('../firebaseConfig');
const database = require('../database.js')

const firebase = database.firebase;

const filetypes = {
    'image/jpeg': {
        'extension': 'jpg',
        'handler': detectTextFromImage
    },
    'image/png': {
        'extension': 'png',
        'handler': detectTextFromImage
    },
    'application/pdf': {
        'extension': 'pdf',
        'handler': detectTextFromPDF
    },
    'text/plain': {
        'extension': 'txt',
        'handler': detectTextFromTextFile
    }
}

const sanitizeData = data => {
    data.shift()

    let sanitizedData = data.map(entry => {
        return entry.description.replace(/[^\w\s]|_/g, "").replace(/\s+/g, " ").toLowerCase();
    }).sort(function (a, b) {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
    })

    let uniques = [];
    let result = {};
    for (let entry of sanitizedData) {
        if (entry === '' || entry.length === 1 || !isNaN(entry)) {
            continue;
        } else if (!uniques.includes(entry)) {
            uniques.push(entry);
            result[entry] = { priority: 1 };
        } else {
            result[entry].priority++;
        }
    }

    return result;
}

async function detectTextFromImage(filename) {
    let [result] = await new vision.ImageAnnotatorClient().textDetection(`gs://${firebaseConfig.storageBucket}/processing/${filename}`);
    return sanitizeData(result.textAnnotations);
}

async function detectTextFromPDF() {

}

async function detectTextFromTextFile() {

}

async function translateWords(words) {
    const translate = new Translate()
    const targetLang = 'pl'
    for (let word of Object.keys(words)) {
        let [translations] = await translate.translate(word, targetLang);
        words[word].translation = translations;
    }
    return words;
}

async function saveFileToBucket(filename, buffer) {
    await firebase.storage().ref(`processing/${filename}`).put(buffer).then(_ => {
        console.log(`Uploaded new file: ${filename}`);
    });
}

exports.showUploadForm = (req, res) => {
    return res.render('upload.ejs');
}

exports.handleUploadForm = async (req, res) => {
    let mimetype = req.file.mimetype
    let filename = `${nanoid(32)}.${filetypes[mimetype].extension}`;

    if (!filetypes.hasOwnProperty(mimetype))
        return res.render('upload.ejs', { errors: ['Ten format plików nie jest wspierany!'] })

    console.log('Saving file...')
    await saveFileToBucket(filename, req.file.buffer);

    console.log('Detecting words...')
    let data = await filetypes[mimetype].handler(filename);

    console.log('Translating words...')
    data = await translateWords(data);

    console.log('Saving to database...')
    // for (let key of Object.keys(data))
    //     await saveWord(key, data[key].translation, data[key].priority);
    database.saveWords("Jw9JjfO4dqcRCVYodVBCv4erJck2", data);

    console.log('Completed!')
    return res.render('wordList.ejs', { words: data });
}