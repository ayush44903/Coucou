// Firebase client configuration
const firebaseConfig = {
    apiKey: "AIzaSyCtdd5NKT5qkEg4o3xayWB2IigPpZZNwd0",
    authDomain: "coucou-91d2b.firebaseapp.com",
    projectId: "coucou-91d2b",
    storageBucket: "coucou-91d2b.firebasestorage.app",
    messagingSenderId: "744963442569",
    appId: "1:744963442569:web:a384d80787ad3f95628358",
    measurementId: "G-WNDTLBBEY7"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Add error display function
  function showError(message, element = null) {
    // Check if error element exists, if not create one
    let errorDisplay = document.querySelector('.error-message');
    if (!errorDisplay) {
      errorDisplay = document.createElement('div');
      errorDisplay.className = 'error-message';
      errorDisplay.style.color = '#e53e3e';
      errorDisplay.style.textAlign = 'center';
      errorDisplay.style.marginBottom = '1rem';
      
      // Insert before the form or at the top of the auth container
      const container = document.querySelector('.auth-container');
      const insertBefore = element || container.firstChild;
      container.insertBefore(errorDisplay, insertBefore);
    }
    
    errorDisplay.textContent = message;
    errorDisplay.style.display = 'block';
    
    // Log to console for debugging
    console.error('Auth error:', message);
  }

  // Handle anonymous login
  const handleAnonymousLogin = async (e) => {
    if (e) e.preventDefault();
    
    // Get the guest username if we're submitting the guest form
    let guestUsername = '';
    const guestUsernameField = document.getElementById('guest-username');
    if (guestUsernameField) {
      guestUsername = guestUsernameField.value.trim();
      if (!guestUsername) {
        showError('Please enter a username to continue as guest');
        return;
      }
    }
    
    try {
      const userCredential = await firebase.auth().signInAnonymously();
      
      // Set the display name to the provided guest username or generate a random one
      await userCredential.user.updateProfile({
        displayName: guestUsername || "Guest-" + Math.floor(Math.random() * 10000)
      });
      
      const idToken = await userCredential.user.getIdToken();
      
      // Send token to your server
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ idToken })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        window.location.href = '/index.html';
      } else {
        showError('Anonymous login failed: ' + (data.error || 'Server error'));
      }
    } catch (error) {
      console.error('Anonymous login error:', error);
      showError(error.message || 'An error occurred during anonymous login');
    }
  };

  // Attach anonymous login handlers
  const anonymousLoginBtn = document.getElementById('anonymous-login');
  const anonymousLoginSignupBtn = document.getElementById('anonymous-login-signup');
  const guestForm = document.getElementById('guest-form');
  
  if (guestForm) {
    guestForm.addEventListener('submit', handleAnonymousLogin);
  }
  
  if (anonymousLoginSignupBtn) {
    anonymousLoginSignupBtn.addEventListener('click', handleAnonymousLogin);
  }

  // Check if login form exists
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      
      try {
        // Sign in with Firebase
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        const idToken = await userCredential.user.getIdToken();
        
        // Send token to your server
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ idToken })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          window.location.href = '/index.html'; // Changed from /chat.html to /index.html
        } else {
          showError('Login failed: ' + (data.error || 'Server error'), loginForm);
        }
      } catch (error) {
        console.error('Login error details:', error);
        
        // Handle Firebase specific errors
        let errorMessage;
        switch (error.code) {
          case 'auth/user-not-found':
            errorMessage = 'No account found with this email address';
            break;
          case 'auth/wrong-password':
            errorMessage = 'Incorrect password';
            break;
          case 'auth/invalid-credential':
            errorMessage = 'Invalid login credentials';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Too many failed login attempts. Please try again later';
            break;
          default:
            errorMessage = error.message || 'An error occurred during login';
        }
        
        showError(errorMessage, loginForm);
      }
    });
  } else {
    console.error('Login form not found in the document');
  }

  // Check if signup form exists
  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('signup-username').value.trim();
      const email = document.getElementById('signup-email').value;
      const password = document.getElementById('signup-password').value;
      
      if (!username) {
        showError('Please enter a username', signupForm);
        return;
      }
      
      try {
        // Create user with email and password
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        
        // Set the display name to the provided username
        await userCredential.user.updateProfile({
          displayName: username
        });
        
        // Get the token after setting display name
        const idToken = await userCredential.user.getIdToken(true);
        
        // Send token to server
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ idToken })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          window.location.href = '/index.html';
        } else {
          showError('Account created but login failed: ' + (data.error || 'Server error'), signupForm);
        }
      } catch (error) {
        console.error('Signup error details:', error);
        
        // Handle Firebase specific errors
        let errorMessage;
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'Email address is already in use';
            break;
          case 'auth/weak-password':
            errorMessage = 'Password is too weak. Please use a stronger password';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Invalid email address format';
            break;
          default:
            errorMessage = error.message || 'An error occurred during signup';
        }
        
        showError(errorMessage, signupForm);
      }
    });
  } else {
    console.error('Signup form not found in the document');
  }
  
  // Check if user is already logged in
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      console.log('User is already signed in');
      // Redirect to chat page if they're already logged in
      window.location.href = '/index.html';
    } else {
      console.log('No user is signed in');
    }
  });
});