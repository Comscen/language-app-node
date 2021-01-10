global.XMLHttpRequest = require('xhr2')
require('firebase/storage');

const { Translate } = require('@google-cloud/translate').v2;
const { nanoid } = require('nanoid');
const vision = require('@google-cloud/vision');
const firebaseConfig = require('../firebaseConfig');
const database = require('../database.js')
const https = require('https')
const htmlToPDF = require('html-pdf-node');
const io = require('socket.io')(3001, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  });

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

const getURLContents = url => new Promise((resolve, reject) => {
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
    await firebase.storage().refFromURL(fileURL).delete().then(_ => {});
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

    let listRef = firebase.storage().ref().child(`/${filename}/`)

    let data = []
    await listRef.listAll().then(async function (res) {

        for (let item of res.items) {
            await item.getDownloadURL().then(async url => {
                await getURLContents(url).then(json => {
                    for (let object of JSON.parse(json).responses) {
                        object.fullTextAnnotation.text.split(/\s+/g).forEach(part => {
                            data.push({ description: part });
                        })
                    }
                })
                await firebase.storage().refFromURL(url).delete().then(_ => {});
            });
        }
    }).catch(function (error) {
        console.log(`Something went wrong when loading output files: ${error}`)
    });

    await firebase.storage().refFromURL(gcsSourceUri).delete().then(_ => {});
    return sanitizeData(data);
}

async function detectTextFromTextFile(buffer) {
    let contents = buffer.toString('utf8').replace(/\r?\n|\r/g, ' ').split(' ');
    let data = [];
    for (let word of contents)
        data.push({ description: word });
    return sanitizeData(data)
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
    await firebase.storage().ref(`processing/${filename}`).put(buffer).then(_ => {});
}

exports.showUploadForm = (req, res) => {
    if (typeof req.session.uid == 'undefined') {
        return res.render('index.ejs', { session: req.session, error: 'Nie możesz dodać słów bez zalogowania!'});
    }
    const uid = req.session.uid
    return res.render('upload.ejs', { uid: uid });
}

exports.handleUploadForm = async (req, res) => {
    
    let data;
    let errors = [];
    const uid = req.session.uid
    
    for (let file of req.files) {
        io.emit(uid, { msg: `Analizowanie pliku: ${file.originalname}` });
        let mimetype = file.mimetype;

        if (!filetypes.hasOwnProperty(mimetype)) {
            errors.push(`Niepoprawny format pliku: ${file.originalname}`);
            continue;
        }

        let extension = filetypes[mimetype].extension;
        
        if (extension !== 'txt') {

            let filename = `${nanoid(32)}.${extension}`;
            
            await saveFileToBucket(filename, file.buffer);

            io.emit(uid, { msg: 'Wykrywanie słów...' });
            var singleData = await filetypes[mimetype].handler(filename);

        } else {
            var singleData = await filetypes[mimetype].handler(file.buffer);
        }
        io.emit(uid, { msg: `Tłumaczenie ${Object.keys(singleData).length} słów...` });
        singleData = await translateWords(singleData);

        io.emit(uid, { msg: 'Zapisywanie słów...'});
        await database.saveWords(uid, singleData);

        data = { ...data, ...singleData };
    }
    return res.render('wordList.ejs', { words: data, errors: errors });
}

exports.handleURLForm = async (req, res) => {
    const uid = req.session.uid;
    let filename = `${nanoid(32)}.pdf`;
    let html = { url: req.body.url };

    io.emit(uid, { msg: `Analizowanie adresu: ${html.url}` });
    
    let data;
    await htmlToPDF.generatePdf(html, { format: 'A4' }).then(async buffer => {

        await saveFileToBucket(filename, buffer);

        io.emit(uid, { msg: 'Wykrywanie słów...' });
        singleData = await detectTextFromPDF(filename);

        io.emit(uid, { msg: `Tłumaczenie ${Object.keys(singleData).length} słów...` });
        singleData = await translateWords(singleData);

        io.emit(uid, { msg: 'Zapisywanie słów...'});
        await database.saveWords(uid, singleData);
        
        data = { ...data, ...singleData };
    })

    return res.render('wordList.ejs', { words: data });
}