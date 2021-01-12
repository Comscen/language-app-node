/**
 * @file upload.js is a controller used to process files and URLs submited by users in order to add new words to database.
 * @author Tangri Michał
 */

global.XMLHttpRequest = require('xhr2')
require('firebase/storage');
const { nanoid } = require('nanoid');
const { Translate } = require('@google-cloud/translate').v2;
const vision = require('@google-cloud/vision');
const firebaseConfig = require('../firebaseConfig');
const database = require('../database.js')
const htmlToPDF = require('html-pdf-node');
const https = require('https')

/** WebSocket object for emitting messages received by upload page to display current status of file processing.
 *  @type {object}
 *  @requires module:socket.io
 */
const io = require('socket.io')(3001, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  });


/** Object containing basic Firebase functions and properties.
 *  @const {object} 
 */
const firebase = database.firebase;


/** Object containing extensions such as ".png" for later use to check if provided file's mimetype is
 *  supported and append said extension to a filename used to save submitted document to Firestore. It also stores
 *  names of functions designed to handle specific mimetypes to call them easily.
 * 
 *  This object's structure looks as follows: 
 *  {
 *      {string} mimetype : {
 *          'extenstion': {string} extension,
 *          'handler': {function} functionName
 *      }
 *  }
 *  @const {object}
 */
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


/** This function provides simple way to receive data from GET requests.
 *  It this module it is mainly used to get HTML from web pages and JSONs from Firestore.
 * 
 *  @param {string} url - URL of a web page or a resource from which we want to get data.
 *  @returns {Promise<string>} Promise containing Buffer converted to a string.
 */
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


/** This function removes all numbers, words containing numbers, empty words, one letter words and punctuation from processed data.
 *  It also trims unnecessary whitespaces. After sanitization all recuring words are removed and their number is saved as a priority
 *  of a given word.
 * 
 *  IMPORTANT NOTE: The first step of sanitization is to remove the very first element in the passed array. It is done to delete unwanted
 *  data received from Vision API.
 * 
 *  @param {object[]} data - Array of objects with 'description' property containing all the detected words.
 *  @returns {object[]} Object with sanitized words nad their priority based on how often they appeared in submitted file/URL.
 */
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


/** Sends a request to VisionAPI to detect all words in a given image file and return them as a sanitized object. When it's done, it deletes
 *  said file from Firestore to reduce taken storage space.
 * 
 *  To read more about detecting text in image files and it's output go to [Google VisionAPI Documentation]{@link https://cloud.google.com/vision/docs/ocr}
 *  
 *  @async
 *  @see {@link sanitizeData} to learn about data sanitization.
 *  @param {string} filename - Name of an image file, saved in 'processing/' directory in the Firestore, to be processed by OCR.
 *  @returns {object} Data object with all detections received from Vision API.
 */
async function detectTextFromImage(filename) {
    let fileURL = `gs://${firebaseConfig.storageBucket}/processing/${filename}`;
    let [result] = await new vision.ImageAnnotatorClient().textDetection(fileURL);
    await firebase.storage().refFromURL(fileURL).delete().then(_ => {});
    return sanitizeData(result.textAnnotations);
}


/** Sends a request to VisionAPI to detect all sentences in a given PDF file. After processing, it saves the output as a JSON file in
 *  a directory named exactly the same as the PDF file. 
 * 
 *  This data is later accessed by a [GET request]{@link getURLContents} and 
 *  broadly transformed to reduce it's size, remove unnecessary content and separate individual words from each sentence. 
 * 
 *  When it's done, the created JSON files and directories are deleted before
 *  returning sanitized data to reduce taken storage space in Firestore.
 * 
 *  For every 20 pages of a PDF document, one JSON file is created.
 * 
 *  To read more about detecting text in PDF files and it's output go to [Google VisionAPI Documentation]{@link https://cloud.google.com/vision/docs/pdf}
 *  
 *  @async
 *  @see {@link sanitizeData} to learn about data sanitization
 *  @param {string} filename - Name of a PDF file, saved in 'processing/' directory in the Firestore, to be processed by OCR.
 *  @returns {object} Transformed data object with detections received from Vision API.
 */
async function detectTextFromPDF(filename) {
    
    /* OCR client */
    const client = new vision.ImageAnnotatorClient();

    /* URI pointing to a PDF file saved in 'processing/' directory in the Firestore */
    const gcsSourceUri = `gs://${firebaseConfig.storageBucket}/processing/${filename}`;

    /* URI where the output will be saved. It is a directory with the same name as the PDF file which will be processed. */
    const gcsDestinationUri = `gs://${firebaseConfig.storageBucket}/${filename}/`;

    /* OCR configs */
    const inputConfig = { mimeType: 'application/pdf', gcsSource: { uri: gcsSourceUri, }, };
    const outputConfig = { gcsDestination: { uri: gcsDestinationUri, }, };
    const features = [{ type: 'DOCUMENT_TEXT_DETECTION' }];
    const request = { requests: [{ inputConfig: inputConfig, features: features, outputConfig: outputConfig, },], };

    /* Sending a request to OCR and saving output in the Firestore */
    const [operation] = await client.asyncBatchAnnotateFiles(request);
    const [filesResponse] = await operation.promise();
    const destinationUri = filesResponse.responses[0].outputConfig.gcsDestination.uri;

    /* Reference to a directory containing JSON outputs. */
    let listRef = firebase.storage().ref().child(`/${filename}/`)

    /*  First we get the list of all JSON files in the destination directory specified earlier.
     *  Then, for each file, we call a HTTP GET request using file's download link.
     *  Everything beside detected sentences is removed, and individual words are taken out of these sentences/
     *  At the end of every file iteration, current file is removed from the Firestore
     */
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

    /* A call to remove saved PDF file */
    await firebase.storage().refFromURL(gcsSourceUri).delete().then(_ => {});
    return sanitizeData(data);
}


/** Splits sentences from TXT file into indiviual words and then returns them in a sanitized data object.
 *  
 *  @see {@link sanitizeData} to learn about data sanitization.
 *  @param {Buffer} buffer - Buffer containing data from the uploaded TXT file.
 *  @returns {object} Sanitized data object with words from the uploaded TXT file.
 */
 function detectTextFromTextFile(buffer) {
    let contents = buffer.toString('utf8').replace(/\r?\n|\r/g, ' ').split(' ');
    let data = [];
    for (let word of contents)
        data.push({ description: word });
    return sanitizeData(data)
}


/** Sends a request to TranslateAPI for each word to be translated. Results of this operation are saved in passed data object, which is
 *  later returned.
 * 
 *  To read more about translating words and sentences go to [Google TranslateAPI Documentation]{@link https://cloud.google.com/translate/docs/basic/translating-text}
 *  
 *  @async
 *  @param {object} words - Data object containing words to be translated
 *  @returns {object} Data object with words and their translations.
 */
async function translateWords(words) {
    const translate = new Translate()
    const targetLang = 'pl'
    for (let word of Object.keys(words)) {
        let [translations] = await translate.translate(word, targetLang);
        words[word].translation = translations;
    }
    return words;
}


/** Saves a file in 'processing/' directory in the Firestore using passed file name.
 * 
 *  To read more about saving files to Firestore go to [Firestore Documentation]{@link https://firebase.google.com/docs/storage/web/upload-files}
 *  
 *  @async
 *  @param {string} filename - Name used to save the file
 *  @param {Buffer} buffer - Buffer containing data from the uploaded file.
 */

async function saveFileToBucket(filename, buffer) {
    await firebase.storage().ref(`processing/${filename}`).put(buffer).then(_ => {});
}


/** Handles '/upload' GET request to render an upload form to a user. 
 * 
 *  It checks if user's uid is saved in session to decide whether said user is logged in or he's not and should be denided access.
 * 
 *  @async
 *  @param {Request} req - Request received from client.
 *  @param {Response} res - Response to be sent to client.
 */
async function showUploadForm (req, res) {
    if (typeof req.session.uid == 'undefined') {
        return res.render('index.ejs', { session: req.session, error: 'Nie możesz dodać słów bez zalogowania!'});
    }
    return res.render('upload.ejs', {session: req.session});
}


/** Handles '/upload' POST request to add words by analyzing and processing file or files submitted by users.
 *  
 *  This function uses [sockets]{@link io} to communitate with client in order to inform users about the progress.
 * 
 *  It checks if user's uid is saved in session to decide whether said user is logged in or he's not and should be denided access.
 * 
 *  @see {@link filetypes} to learn about choosing handlers and validating mimetypes 
 *  @see {@link saveFileToBucket} to learn about saving files in Firestore 
 *  @see {@link translateWords} to learn about word translation 
 * 
 *  @async
 *  @param {Request} req - Request received from client.
 *  @param {Response} res - Response to be sent to client.
 */
async function handleUploadForm (req, res) {

    const uid = req.session.uid
    if (typeof uid == 'undefined') {
        return res.render('index.ejs', { session: req.session, error: 'Nie możesz dodać słów bez zalogowania!'});
    }

    /* Data object with results to be sent to client */
    let data;

    /* Array for error messages in the form of strings to be sent to client */
    let errors = [];
    
    /* Main loop to iterate over all submitted files */
    for (let file of req.files) {

        /* Emit a message to be displayed on the client*/
        io.emit(uid, { msg: `Analizowanie pliku: ${file.originalname}` });
        let mimetype = file.mimetype;

        /* Check if this file format is supported. If it is not, append an error message to be sent to the client */
        if (!filetypes.hasOwnProperty(mimetype)) {
            errors.push(`Niepoprawny format pliku: ${file.originalname}`);
            continue;
        }

        let extension = filetypes[mimetype].extension;
        
        /* Check if given file is a TXT one. If it is not, it should be saved to the Firestore */
        if (extension !== 'txt') {

            /* Generate new name for a file to reduce risk of overwritting someone's data */
            let filename = `${nanoid(32)}.${extension}`;
            
            /* Save file to the Firestore using it's new name */
            await saveFileToBucket(filename, file.buffer);

            /* Emit a message to be displayed on the client and detect words using a proper handler (depending on file's mimetype) */
            io.emit(uid, { msg: 'Wykrywanie słów...' });
            var singleData = await filetypes[mimetype].handler(filename);

        } else {

            /* Emit a message to be displayed on the client and detect words using 'detectTextFromTextFile' function */
            io.emit(uid, { msg: 'Wykrywanie słów...' });
            var singleData = filetypes[mimetype].handler(file.buffer);
        }

        /* Emit a message to be displayed on the client and translate all words */
        io.emit(uid, { msg: `Tłumaczenie ${Object.keys(singleData).length} słów...` });
        singleData = await translateWords(singleData);

        /* Emit a message to be displayed on the client and save all the words to database */
        io.emit(uid, { msg: 'Zapisywanie słów...'});
        await database.saveWords(uid, singleData);

        /* Append words from current file to words from previous files */
        data = { ...data, ...singleData };
    }

    /* Render a summary page with a list of all detected, processed and translated words */
    return res.render('wordList.ejs', { words: data, errors: errors, session: req.session});
}


/** Handles '/upload/url' POST request to add words by analyzing and processing a web page.
 *  
 *  This function uses [sockets]{@link io} to communitate with client in order to inform users about the progress.
 * 
 *  It checks if user's uid is saved in session to decide whether said user is logged in or he's not and should be denided access.
 * 
 *  @see {@link filetypes} to learn about choosing handlers and validating mimetypes 
 *  @see {@link saveFileToBucket} to learn about saving files in Firestore 
 *  @see {@link translateWords} to learn about word translation 
 * 
 *  @async
 *  @param {Request} req - Request received from client.
 *  @param {Response} res - Response to be sent to client.
 */
async function handleURLForm (req, res) {
    
    const uid = req.session.uid;
    if (typeof uid == 'undefined') {
        return res.render('index.ejs', { session: req.session, error: 'Nie możesz dodać słów bez zalogowania!'});
    }

    /* Generate new name for a file to reduce risk of overwritting someone's data */
    let filename = `${nanoid(32)}.pdf`;

    let html = { url: req.body.url };

    /* Emit a message to be displayed on the client */
    io.emit(uid, { msg: `Analizowanie adresu: ${html.url}` });
    
    /* Data object with results to be sent to client */
    let data;

    /* Generate a PDF file based on URL given by user */
    await htmlToPDF.generatePdf(html, { format: 'A4' }).then(async buffer => {

        /* Save the newly created file in the Firestore */
        await saveFileToBucket(filename, buffer);

        /* Emit a message to be displayed on the client and detect words using 'detectTextFromPDF' function */
        io.emit(uid, { msg: 'Wykrywanie słów...' });
        singleData = await detectTextFromPDF(filename);

        /* Emit a message to be displayed on the client and translate all words */
        io.emit(uid, { msg: `Tłumaczenie ${Object.keys(singleData).length} słów...` });
        singleData = await translateWords(singleData);

        /* Emit a message to be displayed on the client and save all the words to database */
        io.emit(uid, { msg: 'Zapisywanie słów...'});
        await database.saveWords(uid, singleData);
        
        /* Append words from current file to words from previous files */
        data = { ...data, ...singleData };
    })

    /* Render a summary page with a list of all detected, processed and translated words */
    return res.render('wordList.ejs', { words: data, session: req.session});
}

/* Functions and variables to be used in upload API controller */
module.exports = { 
    filetypes,
    htmlToPDF,
    getURLContents,
    sanitizeData,
    detectTextFromImage,
    detectTextFromPDF,
    detectTextFromTextFile,
    saveFileToBucket,
    translateWords,
    handleURLForm,
    handleUploadForm,
    showUploadForm
}