/*jshint globalstrict: true, devel: true, node: true*/
'use strict';

require('dotenv').config()
var express = require('express')
var app = express()
var path = require('path')
var bodyParser = require('body-parser')
var favicon = require('serve-favicon')
const session = require('express-session');
const { signInWithGoogle } = require('./controllers/database');
// const MongoStore = require('connect-mongo')(session)

app.use(session({
    secret: process.env.SESSION_SECRET, 
    resave: false, 
    saveUninitialized: false,
    cookie: { maxAge: 60 * 60 * 1000 }
    // store: new MongoStore({
    //     mongooseConnection: mongodb.getConnection(),
    //     clear_interval: 3600
    // })
}))

app.use(favicon(__dirname + '/public/favicon.ico'))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static(path.join(__dirname, 'public')))
app.set('view engine', 'ejs')



app.get("/", (req, res) => res.render('tmp.ejs'))
app.post("/", (req, res) => signInWithGoogle())
app.get("*", (req, res) => res.render('notfound.ejs', {session: req.session}))



app.listen(process.env.PORT || 3000, function () {
    console.log(`Application started on PORT: ${process.env.PORT || 3000}`);
});

process.on('SIGINT', function () {
    console.log("Application shutting down...");
    process.exit();
});