This is a simple web application made using Google Cloud APIs and Firebase. It's main goal is to allow polish users to learn english language.

## Requirements

- Node.js
- npm
- Firebase
- Access to Vision and Translate Google Cloud APIs

## Setup

### Getting started

Assuming you have already installed required software, download the source code from our repository and navigate to project's root folder (the one with package.json file inside).

Run ```npm install``` command in your terminal to install necessary dependencies. Your output should look something like this:

```less
Thank you for installing EJS: built with the Jake JavaScript build tool (https://jakejs.com/)

added 149 packages from 157 contributors and audited 149 packages in 9.448s

3 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

### Application's port

The default port for this application's server is ```3000```. You can change it by creating an environment variable named ```PORT``` and setting it's value to any valid port number you want.

To learn how to create an environment variable 
on windows go <a href= "https://docs.oracle.com/en/database/oracle/r-enterprise/1.5.1/oread/creating-and-modifying-environment-variables-on-windows.html#GUID-DD6F9982-60D5-48F6-8270-A27EC53807D0">here</a>,
on linux go <a href= "https://www.serverlab.ca/tutorials/linux/administration-linux/how-to-set-environment-variables-in-linux/">here</a> and
on macOS go <a href= "https://medium.com/@youngstone89/setting-up-environment-variables-in-mac-os-28e5941c771c">here</a>.

In case you don't want to create an environment variable, you can change the default port number in the source code. To do that, you have to open ```app.js``` file and modify the following part:

```javascript
//change '3000' to any valid port number you want
app.listen(process.env.PORT || 3000, function () { 
    console.log(`Application started on PORT: ${process.env.PORT || 3000}`);
});
```

### Firebase

You need to provide following environmental variables for this application to work properly. All of these can be found in project settings at https://console.firebase.google.com/

```API_KEY, AUTH_DOMAIN, DATABASE_URL, PROJECT_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID, APP_ID, MEASUREMENT_ID```

You must also navigate to ```/views/login.ejs``` and change the config there.

```
const firebaseConfig = {
    apiKey: your-api-key,
    authDomain: your-auth-domain,
    databaseURL: your-database-url,
    storageBucket: your-storage-bucket
};
```

### Running the application

Application's server can be started using either ```node app``` or ```npm start```. If everything was configured correctly you should see a message like this:

```
$ node app
Application started on PORT: 3000
```

Now you can open your browser and go to ```http://localhost:3000/``` or ```http://localhost:<PORT_NUMBER>/``` if you have changed the default port number.

To turn off the server use ```CTRL + C```.

- Michał Tangri - mt.michaltangri@gmail.com
- Sebastian Czajkowski - czaj.sebastian@gmail.com