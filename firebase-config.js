const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // You'll need to download this from Firebase console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;