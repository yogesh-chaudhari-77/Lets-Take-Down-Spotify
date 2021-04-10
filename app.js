const express = require('express');

// Routes Require
const authRoutes = require("./routes/authRoutes");
const subscriptionRoutes = require("./routes/subscriptionRoutes");

// System requires
const os = require("os");
const path = require('path');
const fs = require('fs');
const http = require('http');

// Third part requires
const formidableMiddleware = require('express-formidable');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
const session = require('express-session');
var downloadFileSync = require('download-file-sync');

//AWS Requires
var AWS = require("aws-sdk");

// Config Requires
var aws_config = require("./config/aws_admin_credentials_for_programmatic_access.js");
const { resolve } = require('path');
const { CallTracker, rejects } = require('assert');

AWS.config.update({
    region: "ap-southeast-2",
    accessKeyId: aws_config.acess_key_id,
    secretAccessKey: aws_config.secret_access_key
});

// The region is seeting is updated globally
var dynamodb_client = new AWS.DynamoDB();
var s3_client = new AWS.S3();

// Init the express app
const app = express();

// Listening to requests on 3000 port number
app.listen(3000);

// Using public and node_modules as static server renders
app.use(express.static("public"));
app.use(express.static("node_modules"));

// For accesing post variables - formiable middleware
app.use(formidableMiddleware());
app.use(session({
    secret: 'This is my session secret key. How Creative am I',
    resave: false,
    saveUninitialized: true
}));

// Setting view engine
app.set('view engine', 'ejs');

// Registering other routes with the application - Similar to blueprints in python

app.use(authRoutes);
app.use(subscriptionRoutes);

app.get("/", (req, res) => {
    res.render("index", {session : req.session});
});

app.get("/main", (req, res) => {
    res.render("main", {session : req.session});
});

app.post("/music/query", (req, res) => {

    console.log(req.fields);

    var title = req.fields.title;
    var year = req.fields.year;
    var artist = req.fields.artist;

    var params = {
        TableName: 'music',
        ProjectionExpression: 'id, artist, img_url, web_url, title, #year',
        FilterExpression: 'contains(artist, :a) or contains(title, :t) or contains(#year,:y)',
        ExpressionAttributeValues: {
            ':a': { S: artist },
            ':t': { S: title },
            ':y': { S: year }
        },
        ExpressionAttributeNames: {
            "#year": "year"
        },
    };

    dynamodb_client.scan(params, function (err, data) {

        if (err) {
            console.log("Error", err);
        } else {
            console.log("Success", data);
            var music = [];
            data.Items.forEach(function (element, index, array) {
                music.push({
                    "id": element.id.S,
                    "year": element.year.S,
                    "artist": element.artist.S,
                    "title": element.title.S,
                    "img_url": element.img_url.S
                });
            });

            res.json({ "status": "success", "music": music });
        }
    });
});


/**
 * Creates a music table programatically
 * Id is the primaru key. There is no sorting key
 * Doubts : Documentation says that there is no need to provide other attributes beforehand it being schemaless. Is my understanding correct?
 * [9]
 */
app.get("/create_music_table", (req, res) => {
    var params = {
        TableName: "music",
        KeySchema: [
            { AttributeName: "id", KeyType: "HASH" }  //Partition key
            // No sorting key provided
        ],

        // Datatypes of the KeySchema attributes only. No need to provide other attributes before hand.
        AttributeDefinitions: [
            { AttributeName: "id", AttributeType: "S" }
            // { AttributeName: "title", AttributeType: "S" },
            // { AttributeName: "artist", AttributeType: "S" },
            // { AttributeName: "year", AttributeType: "S" },          // Keeping it as a number for safer use
            // { AttributeName: "web_url", AttributeType: "S" },
            // { AttributeName: "image_url", AttributeType: "S" }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 1,
            WriteCapacityUnits: 1
        }
    };

    dynamodb_client.createTable(params, function (err, data) {
        if (err) {
            console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
        } else {
            console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
        }
    });

    res.send({status : "success"});

});
// End of create music table


/**
 * Loads the sample data from the a2.json file into the DynamoDB
 * Need to improvise and change pitItem request from callback to sync
 * [10]
 */
app.get("/populate_music_table", (req, res) => {

    var music_objects = JSON.parse(fs.readFileSync('a2.json', 'utf8'));

    for (let i = 0, music_objetcts_len = music_objects["songs"].length; i < music_objetcts_len; i++) {

        const img_url = music_objects["songs"][i].img_url;
        const url_tokens = img_url.split("/");
        const object_name = url_tokens[(url_tokens.length - 1)];

        // [10] Forming a item for the put request
        const params = {
            TableName: "music",
            Item: {
                id: { S: "" + uuidv4() },                      //=> '1a1ghf4d-3z7d-4bad-10ss-2b9f5b3dfb6d'
                title: { S: "" + music_objects["songs"][i].title },
                artist: { S: "" + music_objects["songs"][i].artist },
                year: { S: "" + music_objects["songs"][i].year },
                web_url: { S: "" + music_objects["songs"][i].web_url },
                img_url: { S: "" + "https://"+aws_config.s3_config.bucket_name+".s3-"+aws_config.s3_config.bucket_region+".amazonaws.com/"+object_name }
            }
        };

        dynamodb_client.putItem(params, function (err, data) {
            if (err) {
                console.log("err", err);
            }
            else {
                console.log("data", data)
            }
        });
    }

    res.send({status : "success"});
});
// End of populate_music_table

/**
 * [3] This function downloads images from the img_url attribute and saves it locally.
 */
app.get("/download_images_from_url", (req, res) => {

    var music_objects = JSON.parse(fs.readFileSync('a2.json', 'utf8'));

    for (let i = 0, music_objetcts_len = music_objects["songs"].length; i < music_objetcts_len; i++) {

        const img_url = music_objects["songs"][i].img_url;
        const url_tokens = img_url.split("/");
        // [3] 
        const download_file_ref = fs.createWriteStream("public/downloaded_images/" + url_tokens[(url_tokens.length - 1)]);      // Extract the file name from target url

        http.get(img_url, function (response) {
            response.pipe(download_file_ref);
        });
    }

    res.send({status : "success"});

});


/**
 * [4] [5] 
 * The downloaded images will be uploaded to the s3 bucket
 */
app.get("/upload_images_to_s3", (req, res) => {

    fs.readdir("public/downloaded_images/", function (err, files) {

        try { 
            for (let f = 0; f < files.length; f++) {

                const fileContent = fs.readFileSync("public/downloaded_images/" + files[f]);
    
                // [4] [5] Setting up S3 upload parameters
                const params = {
                    Bucket: aws_config.s3_config.bucket_name,
                    Key: files[f],                             // File name you want to save as in S3
                    Body: fileContent,
                    ACL:'public-read'                           // Make object public
                };
    
    
                s3_client.upload(params, function (err, data) {
                    if (err) {
                        throw err;
                    }
                    console.log('File uploaded successfully', data.Location);
                });
            }
    
            res.send({status : "success"});

        }catch(e){
            res.send({status : "failed", "error" : String(e)});
        }
        
    });


});


// 404 page 
app.use((req, res) => {
    res.render("pages/404.ejs");
});

module.exports = app;