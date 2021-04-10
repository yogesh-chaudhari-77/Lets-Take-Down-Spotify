# Cloud Based Music Subscription Application

Created simple music subscription application as part of Cloud Computing assignment to demonstrate the understanding of -
* AWS EC2 
* AWS S3
* AWS DynamoDB

# Key Learnings

* Creating and Managing AWS IAM accounts, Billing, Budgets and Notifications
* Creating configuring AWS services such as EC2 instances, S3 buckets and DynamoDB
* Deploying and serving application using EC2
* Basic CRUD operations with DynamoDB
* Uploading objects to S3, managing bucket policies, making objects publically available.
* Using tools like SSH, WinSCP to access EC2 instance

# Application features

User can create an account using a unique email address.
Once registered, user has access to entire music library in the application. They can search for the music using title, year and artist name (Anything that matches). 
If there is any matching music records, user can then subscribe to it as well unsubscribe the already subscribed music.

# Tech-stack for application development

* NodeJS with Express
* Javascript and JQuery 3.x.x
* Bootstarp 5.x.x

# Challenges Faced

* Managing IAM credentials to manage app access to the cloud platform.
* Reading & understanding the AWS documentation


# Deployment Guide

1. Clone the repository
2. Download the AWS admin credentials for progamatic access
3. Create S3 bucket in preferred region
4. Create file /application_folder/config/aws_admin_credentials_for_programmatic_access.js and put following code.
    ```
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
            "bucket_name" : "",
            "bucket_region" : ""
        }
    };

    module.exports = aws_config;
    ```
    (Update appropriate fields with your admin credentials and bucket information)

5. Install dependancies (Using cmd in application root folder)
   ```
   npm install
   ```
6. Run application using 
  ```
  node app
  ```
