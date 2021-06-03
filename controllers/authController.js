var session = require('express-session');

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

/*
    Renders the login page
*/
const login_get = (req, res) => {
    res.render("auth/login", {session : req.session});
}

/*
    Renders the signup page
*/
const signup_get = (req, res) => {
    res.render("auth/signup", {session : req.session});
}

/*
    Accepts user login credentials and returns the login token
    References : [7]
 */
const login_post = (req, res) => {
    
    const email = req.fields.email;
    const password = req.fields.password;

    var params = {    
        TableName: 'login',
        ProjectionExpression: 'email, password, username',    // Equivalent to select clause
        KeyConditionExpression: 'email = :e',                 // Equivalent to where clause

        
        ExpressionAttributeValues: {
          ':e': {S: email}
        }
      };

      dynamodb_client.query(params, (err, data) => {
        
        // Validating matching records count
        if(data != null && data.Items.length == 1){
            
            const record = data.Items[0];

            // Validating Password
            if(password == record.password.S){
                req.session.email = record.email.S;
                req.session.username = record.username.S;

                res.json({"status" : "success"});
            }else{
                res.json({"status" : "failed"});
            }
            
        }else{
            console.log(err);
            res.json({"status" : "failed"});
        }

      });
}

/*
    [7]
    Accepts user credentials and create a new account.
    It also create a login token which will be sent back to the client
*/
const signup_post = (req, res) => {

    const email = req.fields.email;
    const username = req.fields.username;
    const password = req.fields.password;

    // [7] - Querying and Scanning DynamoDB table
    var params = {    
        TableName: 'login',
        ProjectionExpression: 'email',           // Equivalent to select clause
        KeyConditionExpression: 'email = :e',    // Equivalent to where clause
        ExpressionAttributeValues: {
          ':e': {S: email}
        }
      };

      dynamodb_client.query(params, (err, data) => {
        
        console.log("data --> ", data);
        
        // There is no record with given email
        if(data.Items.length == 0){
            
            var create_user_login = () => {

                var params = {
                    TableName: 'login',
                    Item: {
                        'email': { S: email },
                        'password': { S: password },
                        'username': { S: username }
                    }
                };

                // Call DynamoDB to add the item to the table
                dynamodb_client.putItem(params, (err, data) => {
                    if (err) {
                        console.error("Error", err);
                        res.json({"status": "failed", "err_msg" : "Unknown error occured. Please try again."});
                    } else {
                        res.json({"status": "success"});
                    }
                });
            }

            create_user_login();

        }else{
            console.log(err);
            res.json({"status" : "failed", "err_msg" : "The email already exists."});
        }

      });
}
// End of signup post

/**
 * Logout Function - Destroys the session and then redirects to the home page.
 */
const logout_get = (req, res) => {

    req.session.destroy(function(err) {
        res.redirect("/login");
    })
}


module.exports = {
    login_get, signup_get, login_post, signup_post, logout_get
}