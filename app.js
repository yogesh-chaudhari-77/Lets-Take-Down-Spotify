const express = require('express');

// Routes Require
const authRoutes = require("./routes/authRoutes");

// System requires
const os = require("os");
const path = require('path');
const fs = require('fs');
const http = require('http');

// Third part requires
const formidableMiddleware = require('express-formidable');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');
var session = require('express-session');

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
app.use(session({
    secret: 'This is my session secret key. How Creative am I',
    resave: false,
    saveUninitialized: true
}));

// Setting view engine
app.set('view engine', 'ejs');

// Registering other routes with the application - Similar to blueprints in python

app.use(authRoutes);

app.get("/", (req, res) => {
    res.render("index");
});

app.get("/main", (req, res) => {
    res.render("main");
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

app.post("/music/subscribe", (req, res) => {

    console.log(req.fields);

    var music_id = req.fields.music_id;
    var email = req.session.email;

    var params = {
        TableName: 'music_subscription',
        Item: {
            'subscription_id': { S: uuidv4() },
            'music_id': { S: music_id },
            'email': { S: email },
        }
    };

    // Call DynamoDB to add the item to the table
    dynamodb_client.putItem(params, (err, data) => {
        if (err) {
            console.error("Error", err);
            res.json({ "status": "failed", "err_msg": "Unknown error occured. Please try again." });
        } else {
            console.log(data);
            res.json({ "status": "success" });
        }
    });

});

app.post("/music/unsubscribe", (req, res) => {

    console.log(req.fields);

    var subscription_id = req.fields.subscription_id;

    var params = {
        TableName: 'music_subscription',
        Key: { 
            "subscription_id" : {S : subscription_id}
        }
        // ConditionExpression: 'subscription_id = :s',
        // ExpressionAttributeValues: {
        //     ":s": { "S": subscription_id }
        // }
    };

    // Call DynamoDB to add the item to the table
    dynamodb_client.deleteItem(params, (err, data) => {
        if (err) {
            console.error("Error", err);
            res.json({ "status": "failed", "err_msg": "Unknown error occured. Please try again." });
        } else {
            console.log("Delete Item Success", data);
            res.json({ "status": "success" });
        }
    });

});

app.post("/music/subscribed", (req, res) => {

    var email = req.session.email;

    console.log("email", req.session.email);
    console.log("username", req.session.username);

    var params = {
        TableName: 'music_subscription',
        ProjectionExpression: 'subscription_id, music_id',
        FilterExpression: 'contains(email, :e)',
        ExpressionAttributeValues: {
            ':e': { S: email }
        }
    };

    dynamodb_client.scan(params, function (err, data) {

        if (err) {
            console.log("Error", err);
        } else {

            if(data.Items.length <= 0){
                res.json({ "status": "success", "music": {}});
                return;
            }

            console.log("Success", data);
            var titleObject = {};
            var music = {};

            data.Items.forEach(function (element, index, array) {
                var musicIdKey = ":titlevalue" + index;
                titleObject[musicIdKey.toString()] = { "S": element.music_id.S };
                music[element.music_id.S] = {
                    "subscription_id": element.subscription_id.S
                }
            });

            var params = {
                TableName: 'music',
                ProjectionExpression: 'id, title, artist, #year, img_url',
                FilterExpression: "id IN (" + Object.keys(titleObject).toString() + ")",
                ExpressionAttributeValues: titleObject,
                ExpressionAttributeNames: {
                    "#year": "year"
                }
            };

            console.log("Object.keys(titleObject).toString()", Object.keys(titleObject).toString());
            console.log("titleObject", titleObject);

            dynamodb_client.scan(params, function (err, data) {

                if (err) {
                    console.log("Error", err);
                } else {
                    console.log("Second Query", data);

                    data.Items.forEach(function (element, index, array) {
                        music[element.id.S]["id"] = element.id.S;
                        music[element.id.S]["title"] = element.title.S;
                        music[element.id.S]["artist"] = element.artist.S;
                        music[element.id.S]["year"] = element.year.S;
                        music[element.id.S]["img_url"] = element.img_url.S;
                    });

                    res.json({ "status": "success", "music": music });

                }
            });
        }
    });

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
                res.send("File uploaded successfully. " + data.Location);
            });
        }
    });


});


// 404 page 
app.use((req, res) => {
    res.render("pages/404.ejs");
});

module.exports = app;