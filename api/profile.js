/**
 * @file api/profile.js is an API controller used to receive user profile's data from the server
 * @author Tangri Michał
 */


const { firebase, getStats, getUserById } = require('../database')
const { nanoid } = require('nanoid');


/** Handles '/profile' (API) GET request to receive user profile's data with basic statistics. 
 * 
 *  It requires UID to be provided in request's body.
 *  
 *  @async
 *  @param {Request} req - Request received from client.
 *  @param {Response} res - Response to be sent to client.
 */
exports.getProfile = async (req, res) => {
    
    const uid = req.params.uid;
    if (typeof uid == 'undefined') {
        return res.status(400).send({ error: 'UID not specified' });
    }
    let status = 200;
    let errors = [];
    let stats = {};

    const userData = await getUserById(uid).catch(error => {
        status = 404;
        errors.push('Provided UID is invalid.');
    });

    stats['uid'] = uid;
    stats['name'] = typeof userData == 'undefined' ? '' : userData.displayName;
    stats['photoURL'] = typeof userData == 'undefined' ? '' : userData.photoURL;
    
    stats = {...stats, ...await getStats(uid)};
    
    return res.status(status).send({ errors: errors, stats: stats })
}
