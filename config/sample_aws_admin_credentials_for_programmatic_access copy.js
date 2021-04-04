
/**
 * AWS config object
 * The credentials in this file will be passed before making call to the AWS services
 * Make sure that these credentials are not shared with any body
 */
const aws_config = {
    "username" : "",
    "password" : "",
    "acess_key_id" : "",
    "secret_access_key" : "",
    "region" : "",
    "console_login_link" : "",

    // S3 Bucket configuration
    "s3_config" : {
        "bucket_name" : "music-subscription-app-bucket",
        "bucket_region" : "ap-southeast-2"
    }
};


module.exports = aws_config;