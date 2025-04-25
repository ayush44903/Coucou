const admin = require('firebase-admin');

// Check if the app is already initialized to prevent multiple initializations
let firebaseApp;
try {
  firebaseApp = admin.app();
} catch (e) {
  // Initialize Firebase Admin with service account
  // You should have a serviceAccount.json file with your Firebase credentials
  const serviceAccount = require('./serviceAccount.json');
  
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // If you're using Firebase database, uncomment and add your database URL
    // databaseURL: "https://your-project-id.firebaseio.com"
  });
}

module.exports = admin;