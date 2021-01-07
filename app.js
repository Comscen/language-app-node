/*jshint globalstrict: true, devel: true, node: true*/
'use strict';

require('dotenv').config();
var express = require('express');
var app = express();
var path = require('path');
var bodyParser = require('body-parser');
var favicon = require('serve-favicon');
const session = require('express-session');
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

app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

/* Routing */

const learningRoutes = require('./routes/learning');
const testsRoutes = require('./routes/tests');
const uploadRoutes = require('./routes/upload');
const profileRoutes = require('./routes/profile');
const authRoutes = require('./routes/auth')

app.use("/learning", learningRoutes);
app.use("/tests", testsRoutes);
app.use("/upload", uploadRoutes);
app.use("/profile", profileRoutes);
app.use("/auth", authRoutes);

app.get("/", (req, res) => res.render('index.ejs'));
app.get("/license", (req, res) => res.render('license.ejs'));
app.get("*", (req, res) => res.render('notfound.ejs'));

/* !Routing */

app.listen(process.env.PORT || 3000, function () {
    console.log(`Application started on PORT: ${process.env.PORT || 3000}`);
});

process.on('SIGINT', function () {
    console.log("Application shutting down...");
    process.exit();
});