global.XMLHttpRequest = require('xhr2')
require('firebase/storage');

const { nanoid } = require('nanoid');
const firebaseConfig = require('../firebaseConfig');
const database = require('../database.js')
const controller = require('../controllers/upload')

const firebase = database.firebase;

exports.getUploadInfo = (req, res) => {
    return res.status(200).send( {
        'description': 'Endpoint used to add words to database for a specific user using their UID',
        'info': {
            'supportedFileTypes': 'png, jpeg, pdf, txt',
            'formDataType': 'multipart/form-data for files or x-www-form-urlencoded for URLs',
            'requiredData': 'UID sent in request body and a file or URL string',
            'returns': 'List of detected, translated, analyzed and saved words'
        }
    });
}

exports.handleFileUploadRequest = async (req, res) => {
    let status = 200;
    let data;
    let errors = [];
    const uid = req.body.uid
    const filetypes = controller.filetypes;

    if (typeof uid == 'undefined')
        return res.status(400).send({error: 'UID not specified'});
    
    for (let file of req.files) {
        let mimetype = file.mimetype;

        if (!filetypes.hasOwnProperty(mimetype)) {
            errors.push(`Invalid file type: ${file.originalname}`);
            continue;
        }

        let extension = filetypes[mimetype].extension;
        
        if (extension !== 'txt') {

            let filename = `${nanoid(32)}.${extension}`;
            
            await controller.saveFileToBucket(filename, file.buffer);

            var singleData = await filetypes[mimetype].handler(filename);

        } else {
            var singleData = await filetypes[mimetype].handler(file.buffer);
        }
        singleData = await controller.translateWords(singleData);

        await database.saveWords(uid, singleData).catch(error => {
            status = 404;
            errors.push('Could not save words to database. User with given UID does not exits');
        });

        data = { ...data, ...singleData };
    }
    return res.status(status).send( {'uid': uid, 'errors': errors, 'responseData': data });
}

exports.handleURLUploadRequest = async (req, res) => {
    const uid = req.body.uid

    if (typeof uid == 'undefined')
        return res.status(400).send({error: 'UID not specified'});

    let filename = `${nanoid(32)}.pdf`;
    let html = { url: req.body.url };

    let data;
    await controller.htmlToPDF.generatePdf(html, { format: 'A4' }).then(async buffer => {

        await controller.saveFileToBucket(filename, buffer);

        singleData = await controller.detectTextFromPDF(filename);

        singleData = await controller.translateWords(singleData);

        await database.saveWords(uid, singleData).catch(error => {
            status = 404;
            errors.push('Could not save words to database. User with given UID does not exits');
        });;
        
        data = { ...data, ...singleData };
    })

    return res.status(status).send( {'uid': uid, 'errors': errors, 'responseData': data });
}
