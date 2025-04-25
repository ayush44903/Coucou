// Connect with authentication token
async function connectSocket() {
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) {
    window.location.href = '/login.html';
    return;
  }
  
  const token = await currentUser.getIdToken();
  
  // Initialize socket with auth token
  const socket = io({
    auth: {
      token: token
    }
  });
  
  // Handle connection error (auth failed)
  socket.on('connect_error', (err) => {
    console.error('Connection error:', err.message);
    if (err.message.includes('Authentication error')) {
      alert('Authentication failed. Please log in again.');
      window.location.href = '/login.html';
    }
  });
  
  // Handle successful connection
  socket.on('connect', () => {
    console.log('Connected to server');
    socket.emit('join'); // No need to send username as it comes from Firebase
    
    // Rest of your socket event handlers...
  });
  
  return socket;
}

// Initialize everything
document.addEventListener('DOMContentLoaded', () => {
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      const socket = connectSocket();
      // Initialize UI with authenticated socket
    } else {
      window.location.href = '/login.html';
    }
  });
});