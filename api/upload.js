/**
 * @file api/upload.js is an API controller used to process files and URLs sent in requests in order to add new words to database.
 * @author Tangri Michał
 */


global.XMLHttpRequest = require('xhr2')
require('firebase/storage');

const { nanoid } = require('nanoid');
const firebaseConfig = require('../firebaseConfig');
const database = require('../database.js')
const controller = require('../controllers/upload')

const firebase = database.firebase;


/** Handles '/upload' (API) GET request to receive basic information about this API. 
 * 
 *  @param {Request} req - Request received from client.
 *  @param {Response} res - Response to be sent to client.
 */
exports.getUploadInfo = (req, res) => {
    return res.status(200).send({
        'description': 'Endpoint used to add words to database for a specific user using their UID',
        'info': {
            'supportedFileTypes': 'png, jpeg, pdf, txt',
            'formDataType': 'multipart/form-data for files or x-www-form-urlencoded for URLs',
            'requiredData': 'UID sent in request body and a file or URL string',
            'returns': 'List of detected, translated, analyzed and saved words'
        }
    });
}


/** Handles '/upload' (API) POST request to add words by analyzing and processing file or files sent in a request.
 *  
 *  It requires UID to be provided in request's body.
 * 
 *  @async
 *  @param {Request} req - Request received from client.
 *  @param {Response} res - Response to be sent to client.
 */
exports.handleFileUploadRequest = async (req, res) => {
    
    /* Data object with results to be sent as a response */
    let data;

    /* Array for error messages in the form of strings to be sent to client */
    let errors = [];

    let status = 200;
    const uid = req.body.uid;
    const filetypes = controller.filetypes;

    if (typeof uid == 'undefined')
        return res.status(400).send({ error: 'UID not specified' });

    /* Main loop to iterate over all submitted files */
    for (let file of req.files) {
        let mimetype = file.mimetype;

        /* Check if this file format is supported. If it is not, append an error message to be sent in a response */
        if (!filetypes.hasOwnProperty(mimetype)) {
            errors.push(`Invalid file type: ${file.originalname}`);
            continue;
        }

        let extension = filetypes[mimetype].extension;

        /* Check if given file is a TXT one. If it is not, it should be saved to the Firestore */
        if (extension !== 'txt') {

            /* Generate new name for a file to reduce risk of overwritting someone's data */
            let filename = `${nanoid(32)}.${extension}`;

            /* Save file to the Firestore using it's new name */
            await controller.saveFileToBucket(filename, file.buffer);

            /* Detect words using a proper handler (depending on file's mimetype) */
            var singleData = await filetypes[mimetype].handler(filename);

        } else {
            /* Detect words using 'detectTextFromTextFile' function */
            var singleData = await filetypes[mimetype].handler(file.buffer);
        }

        /* Translate all words */
        singleData = await controller.translateWords(singleData);

        /* Save all the words to database or append an error if UID is invalid */
        io.emit(uid, { msg: 'Zapisywanie słów...' });
        await database.saveWords(uid, singleData).catch(error => {
            status = 404;
            errors.push('Could not save words to database. User with given UID does not exits');
        });

        /* Append words from current file to words from previous files */
        data = { ...data, ...singleData };
    }

    /* Send a summary object with a list of all detected, processed and translated words */
    return res.status(status).send({ 'uid': uid, 'errors': errors, 'responseData': data });
}


/** Handles '/upload/url' (API) POST request to add words by analyzing and processing a web page from URL sent in a request.
 *  
 *  It requires UID to be provided in request's body.
 * 
 *  @async
 *  @param {Request} req - Request received from client.
 *  @param {Response} res - Response to be sent to client.
 */
exports.handleURLUploadRequest = async (req, res) => {
    const uid = req.body.uid

    if (typeof uid == 'undefined')
        return res.status(400).send({ error: 'UID not specified' });

    /* Generate new name for a file to reduce risk of overwritting someone's data */
    let filename = `${nanoid(32)}.pdf`;
    let html = { url: req.body.url };

    /* Data object with results to be sent to client */
    let data;

    /* Generate a PDF file based on URL given by user */
    await controller.htmlToPDF.generatePdf(html, { format: 'A4' }).then(async buffer => {

        /* Save the newly created file in the Firestore */
        await controller.saveFileToBucket(filename, buffer);

        /* Detect words using 'detectTextFromPDF' function */
        singleData = await controller.detectTextFromPDF(filename);

        /* Translate all words */
        singleData = await controller.translateWords(singleData);

        /* Save all the words to database or append an error if UID is invalid */
        await database.saveWords(uid, singleData).catch(error => {
            status = 404;
            errors.push('Could not save words to database. User with given UID does not exits');
        });;

        /* Append words from current file to words from previous files */
        data = { ...data, ...singleData };
    })

    /* Send a summary object with a list of all detected, processed and translated words */
    return res.status(status).send({ 'uid': uid, 'errors': errors, 'responseData': data });
}
