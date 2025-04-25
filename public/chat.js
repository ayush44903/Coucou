// Connect with authentication token
async function connectSocket() {
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) {
    // Mandatory login - redirect to login page if no user
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
    // Display user type (anonymous or registered)
    const userType = currentUser.isAnonymous ? 'Guest' : 'Registered User';
    const displayName = currentUser.displayName || currentUser.email || 'User';
    console.log(`Connected as ${userType}: ${displayName}`);
    
    socket.emit('join'); // No need to send username as it comes from Firebase
    
    // Rest of your socket event handlers...
  });
  
  return socket;
}

// Function to create and add logout button
function addLogoutButton() {
  const currentUser = firebase.auth().currentUser;
  if (!currentUser) return;

  // Find or create a container for the logout button
  let headerContainer = document.querySelector('.header-container');
  if (!headerContainer) {
    headerContainer = document.createElement('div');
    headerContainer.className = 'header-container';
    headerContainer.style.display = 'flex';
    headerContainer.style.justifyContent = 'space-between';
    headerContainer.style.alignItems = 'center';
    headerContainer.style.padding = '10px';
    headerContainer.style.backgroundColor = '#f0f0f0';
    headerContainer.style.marginBottom = '10px';
    
    // Create user info section
    const userInfoContainer = document.createElement('div');
    userInfoContainer.id = 'user-info';
    userInfoContainer.className = 'user-info';
    userInfoContainer.style.display = 'flex';
    userInfoContainer.style.alignItems = 'center';
    
    // Add username display
    const usernameSpan = document.createElement('span');
    usernameSpan.textContent = `Welcome, ${currentUser.displayName || currentUser.email || 'User'}`;
    userInfoContainer.appendChild(usernameSpan);
    
    // Add anonymous badge if needed
    if (currentUser.isAnonymous) {
      const anonBadge = document.createElement('span');
      anonBadge.className = 'anonymous-badge';
      anonBadge.textContent = 'Guest';
      anonBadge.style.backgroundColor = '#a0aec0';
      anonBadge.style.color = 'white';
      anonBadge.style.padding = '2px 6px';
      anonBadge.style.borderRadius = '4px';
      anonBadge.style.fontSize = '12px';
      anonBadge.style.marginLeft = '5px';
      userInfoContainer.appendChild(anonBadge);
    }
    
    headerContainer.appendChild(userInfoContainer);
    
    // Add header to document body as first child
    document.body.insertBefore(headerContainer, document.body.firstChild);
  }
  
  // Create logout button if it doesn't exist
  if (!document.getElementById('logout-btn')) {
    const logoutBtn = document.createElement('button');
    logoutBtn.id = 'logout-btn';
    logoutBtn.textContent = 'Logout';
    logoutBtn.style.padding = '8px 16px';
    logoutBtn.style.backgroundColor = '#dc3545';
    logoutBtn.style.color = 'white';
    logoutBtn.style.border = 'none';
    logoutBtn.style.borderRadius = '4px';
    logoutBtn.style.cursor = 'pointer';
    
    // Add logout functionality
    logoutBtn.addEventListener('click', () => {
      // Server-side logout
      fetch('/api/logout', {
        method: 'POST'
      })
      .then(() => {
        // Client-side logout
        return firebase.auth().signOut();
      })
      .then(() => {
        // Redirect to login page
        window.location.href = '/login.html';
      })
      .catch(error => {
        console.error('Logout error:', error);
        // Force redirect if there's an error
        window.location.href = '/login.html';
      });
    });
    
    headerContainer.appendChild(logoutBtn);
  }
}

// Initialize everything
document.addEventListener('DOMContentLoaded', () => {
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      // Create a badge for anonymous users
      if (user.isAnonymous) {
        const userInfo = document.getElementById('user-info');
        if (userInfo) {
          const anonBadge = document.createElement('span');
          anonBadge.className = 'anonymous-badge';
          anonBadge.textContent = 'Guest';
          anonBadge.style.backgroundColor = '#a0aec0';
          anonBadge.style.color = 'white';
          anonBadge.style.padding = '2px 6px';
          anonBadge.style.borderRadius = '4px';
          anonBadge.style.fontSize = '12px';
          anonBadge.style.marginLeft = '5px';
          userInfo.appendChild(anonBadge);
        }
      }
      
      // Add logout button
      addLogoutButton();
      
      const socket = connectSocket();
      // Initialize UI with authenticated socket
      // Your existing UI initialization code here...
    } else {
      // Mandatory login - redirect to login page
      window.location.href = '/login.html';
    }
  });
});