var session = require('express-session');
const { v4: uuidv4 } = require('uuid');

//AWS Requires
var AWS = require("aws-sdk");

// Config Requires
var aws_config = require("../config/aws_admin_credentials_for_programmatic_access.js");

AWS.config.update({
    region: "ap-southeast-2",
    accessKeyId: aws_config.acess_key_id,
    secretAccessKey: aws_config.secret_access_key
});

// The region is seeting is updated globally
var dynamodb_client = new AWS.DynamoDB();


/**
 * User can subscribe to the music
 * @param {*} req - music_id to subscribe to, email of the user 
 * @param {*} res 
 */
const subscribe_post = (req, res) => {
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
}


/**
 * User can unsubscribe the music, he has subscribed already.
 * @param {*} req - Subscription ID
 * @param {*} res - Json status response - success or failed
 */
const unsubscribe_post = (req, res) => {
    
    console.log(req.fields);

    var subscription_id = req.fields.subscription_id;

    var params = {
        TableName: 'music_subscription',
        Key: { 
            "subscription_id" : {S : subscription_id}
        }
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
}


/**
 * Retrives all the subscribed posts of this user
 * @param {*} req - email address of the user
 * @param {*} res - List of subcribed music containing title, year, artitst, image of the album
 */
const subscribed_post = (req, res) => {
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
            var music_id_in_obj = {};
            var music = {};

            // [8]
            data.Items.forEach(function (element, index) {
                var musicIdKey = ":musicIdValue" + index;
                music_id_in_obj[musicIdKey.toString()] = { "S": element.music_id.S };
                music[element.music_id.S] = {
                    "subscription_id": element.subscription_id.S
                }
            });

            console.log("This is the format : "+Object.keys(music_id_in_obj).toString());
            // [8]
            var params = {
                TableName: 'music',
                ProjectionExpression: 'id, title, artist, #year, img_url',
                FilterExpression: "id IN (" + Object.keys(music_id_in_obj).toString() + ")",
                ExpressionAttributeValues: music_id_in_obj,
                ExpressionAttributeNames: {
                    "#year": "year"
                }
            };

            console.log(params);

            //console.log("Object.keys(titleObject).toString()", Object.keys(music_id_in_obj).toString());
            //console.log("titleObject", music_id_in_obj);

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
}

module.exports = {subscribe_post, unsubscribe_post, subscribed_post};