const express = require('express');

// System requires
const os = require("os");
const path = require('path');

// Third part requires
const formidableMiddleware = require('express-formidable');
const cookieParser = require('cookie-parser');

// Init the express app
const app = express();

// Listening to requests on 3000 port number
app.listen(3000);

// Using public and node_modules as static server renders
app.use(express.static("public"));
app.use(express.static("node_modules"));

// For accesing post variables - formiable middleware
app.use(formidableMiddleware());

// Setting view engine
app.set('view engine', 'ejs');

// Registering other routes with the application - Similar to blueprints in python


app.get("/", (req, res) => {
    res.render("index");
});

// User auth routes
app.get("/login", (req, res) => {
    res.render("auth/login");
});

app.get("/signup", (req, res) => {
    res.render("auth/signup");
});

// 404 page 
// app.use( (req, res) => {
//   res.render("templates/404.ejs");
// } );

module.exports = app;