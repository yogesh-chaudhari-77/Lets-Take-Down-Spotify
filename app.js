const express = require('express');

// System requires
const os = require("os");
const path = require('path');
const fs = require('fs');
const http = require('http');

// Third part requires
const formidableMiddleware = require('express-formidable');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid')

//AWS Requires
var AWS = require("aws-sdk");

// Config Requires
var aws_config = require("./config/aws_admin_credentials_for_programmatic_access.js");

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

// Setting view engine
app.set('view engine', 'ejs');

// Registering other routes with the application - Similar to blueprints in python


app.get("/", (req, res) => {
    res.render("index");
});

/**
 * Creates a music table programatically
 * Id is the primaru key. There is no sorting key
 * Doubts : Documentation says that there is no need to provide other attributes beforehand it being schemaless. Is my understanding correct?
 */
app.get("create_music_table", (req, res) => {
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
            ReadCapacityUnits: 10,
            WriteCapacityUnits: 10
        }
    };

    dynamodb_client.createTable(params, function (err, data) {
        if (err) {
            console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
        } else {
            console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
        }
    });

});
// End of create music table

/**
 * Loads the sample data from the a2.json file into the DynamoDB
 * Need to improvise and change pitItem request from callback to sync
 */
app.get("/populate_music_table", (req, res) => {

    var music_objects = JSON.parse(fs.readFileSync('a2.json', 'utf8'));

    for (let i = 0, music_objetcts_len = music_objects["songs"].length; i < music_objetcts_len; i++) {

        // Forming a item for the put request
        const params = {
            TableName: "music",
            Item: {
                id: { S: "" + uuidv4() },                      //=> '1a1ghf4d-3z7d-4bad-10ss-2b9f5b3dfb6d'
                title: { S: "" + music_objects["songs"][i].title },
                artist: { S: "" + music_objects["songs"][i].artist },
                year: { S: "" + music_objects["songs"][i].year },
                web_url: { S: "" + music_objects["songs"][i].web_url },
                img_url: { S: "" + music_objects["songs"][i].img_url }
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

    res.send("<pre>Database loaded</pre>");
});
// End of populate_music_table

/**
 * [3]
 * This function downloads images from the img_url attribute and saves it locally.
 */
app.get("/download_images_from_url", (req, res) => {

    var music_objects = JSON.parse(fs.readFileSync('a2.json', 'utf8'));

    for (let i = 0, music_objetcts_len = music_objects["songs"].length; i < music_objetcts_len; i++) {

        const img_url = music_objects["songs"][i].img_url;
        const url_tokens = img_url.split("/");
        const download_file_ref = fs.createWriteStream("public/downloaded_images/" + url_tokens[(url_tokens.length - 1)]);      // Extract the file name from target url

        http.get(img_url, function (response) {
            response.pipe(download_file_ref);
        });
    }

    res.send("All Images have been downloaded successfully.");
});


/**
 * [4] [5] 
 * The downloaded images will be uploaded to the s3 bucket
 */
app.get("/upload_images_to_s3", (req, res) => {

    fs.readdir("public/downloaded_images/", function (err, files) {

        for (let f = 0; f < files.length; f++) {

            const fileContent = fs.readFileSync("public/downloaded_images/" + files[f]);

            // Setting up S3 upload parameters
            const params = {
                Bucket: aws_config.s3_config.bucket_name,
                Key: files[f],                             // File name you want to save as in S3
                Body: fileContent
            };

            
            s3_client.upload(params, function (err, data) {
                if (err) {
                    throw err;
                }
                console.log('File uploaded successfully', data.Location);
                res.send("File uploaded successfully. "+data.Location);
            });
        }
    });

    
});


// User auth routes
app.get("/login", (req, res) => {
    res.render("auth/login");
});

app.get("/signup", (req, res) => {
    res.render("auth/signup");
});

// 404 page 
app.use((req, res) => {
    res.render("pages/404.ejs");
});

module.exports = app;