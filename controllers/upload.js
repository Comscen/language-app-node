global.XMLHttpRequest = require('xhr2')
require('firebase/storage');

const { Translate } = require('@google-cloud/translate').v2;
const { nanoid } = require('nanoid');
const vision = require('@google-cloud/vision');
const firebaseConfig = require('../firebaseConfig');
const database = require('../database.js')
const https = require('https')

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
        if (entry === '' || entry.length === 1 || /\d/.test(entry)) {
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
    let fileURL = `gs://${firebaseConfig.storageBucket}/processing/${filename}`;
    let [result] = await new vision.ImageAnnotatorClient().textDetection(fileURL);
    await firebase.storage().refFromURL(fileURL).delete().then(_ => console.log(`Automatically deleted file: ${filename}`));
    return sanitizeData(result.textAnnotations);
}

async function detectTextFromPDF(filename) {
    const client = new vision.ImageAnnotatorClient();
    const gcsSourceUri = `gs://${firebaseConfig.storageBucket}/processing/${filename}`;
    const gcsDestinationUri = `gs://${firebaseConfig.storageBucket}/${filename}/`;

    const inputConfig = { mimeType: 'application/pdf', gcsSource: { uri: gcsSourceUri, }, };
    const outputConfig = { gcsDestination: { uri: gcsDestinationUri, }, };
    const features = [{ type: 'DOCUMENT_TEXT_DETECTION' }];
    const request = { requests: [{ inputConfig: inputConfig, features: features, outputConfig: outputConfig, },], };

    const [operation] = await client.asyncBatchAnnotateFiles(request);
    const [filesResponse] = await operation.promise();
    const destinationUri = filesResponse.responses[0].outputConfig.gcsDestination.uri;
    console.log('JSON saved to: ' + destinationUri);

    let listRef = firebase.storage().ref().child(`/${filename}/`)

    let data = []
    await listRef.listAll().then(async function (res) {

        for (let item of res.items) {
            await item.getDownloadURL().then(async url => {
                let getJSON = new Promise((resolve, reject) => {
                    https.get(url, (response) => {
                        let chunks_of_data = [];

                        response.on('data', (fragments) => { chunks_of_data.push(fragments); });

                        response.on('error', (error) => { reject(error); });

                        response.on('end', () => {
                            let response_body = Buffer.concat(chunks_of_data);
                            resolve(response_body.toString());
                        });

                    });
                });

                await getJSON.then(json => {
                    for (let object of JSON.parse(json).responses) {
                        object.fullTextAnnotation.text.split(/\s+/g).forEach(part => {
                            data.push({ description: part });
                        })
                    }
                })
            });
        }
    }).catch(function (error) {
        console.log(`Something went wrong when loading output files: ${error}`)
    });

    await firebase.storage().refFromURL(gcsSourceUri).delete().then(_ => console.log(`Automatically deleted file: ${filename}`));
    // await firebase.storage().refFromURL(destinationUri).delete().then(_ => console.log(`Automatically deleted directory: ${filename}/`));
    return sanitizeData(data);
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
    let data;
    let errors = [];
    for (let file of req.files) {
        console.log("---------------------------------------------")
        console.log(`Processing file: ${file.originalname}`);
        let mimetype = file.mimetype;

        if (!filetypes.hasOwnProperty(mimetype)) {
            errors.push(`Niepoprawny format pliku: ${file.originalname}`)
            continue;
        }

        let filename = `${nanoid(32)}.${filetypes[mimetype].extension}`;

        console.log(`Saving file to bucket as: ${filename}`);
        await saveFileToBucket(filename, file.buffer);

        console.log('Detecting words...')
        let singleData = await filetypes[mimetype].handler(filename);
        console.log(`Translating ${Object.keys(singleData).length} words...`)
        singleData = await translateWords(singleData);

        console.log('Saving to database...')
        database.saveWords("Jw9JjfO4dqcRCVYodVBCv4erJck2", singleData);

        data = { ...data, ...singleData };
    }
    console.log("---------------------------------------------")
    console.log(`Processed ${req.files.length} file(s).`)
    return res.render('wordList.ejs', { words: data, errors: errors });
}
