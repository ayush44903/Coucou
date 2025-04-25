const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*",  // Allow all origins in development. In production, specify your domain
        methods: ["GET", "POST"],
        credentials: true
    }
});
const admin = require('./firebase-config');
const cookieParser = require('cookie-parser');
const session = require('express-session');

// Middleware setup
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: 'your-session-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Serve static files from public directory
app.use(express.static('public'));

// Track connected users with their names
const connectedUsers = new Map();
// Track rooms with their secret codes
const rooms = new Map(); // roomId -> {code, creator, name, members: [socketIds]}

// Authentication middleware for API endpoints
const authenticateUser = async (req, res, next) => {
  try {
    const idToken = req.headers.authorization?.split('Bearer ')[1];
    if (!idToken) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }
};

// Authentication endpoints
app.post('/api/login', async (req, res) => {
  // The actual Firebase authentication happens client-side
  // This endpoint is for setting up the session after client-side auth
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'ID token is required' });
    }
    
    // Add more detailed error logging
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      
      // Check if decodedToken contains necessary user information
      if (!decodedToken.uid) {
        console.error('Firebase returned token without user ID');
        return res.status(400).json({ error: 'Invalid user information' });
      }
      
      const user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email || decodedToken.displayName || 'User'
      };
      
      // Ensure session is correctly initialized before updating
      if (!req.session) {
        console.error('Session object not available');
        return res.status(500).json({ error: 'Session initialization failed' });
      }
      
      req.session.user = user;
      
      // Ensure session is properly saved before responding
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.status(500).json({ error: 'Failed to save session data' });
        }
        res.status(200).json({ message: 'Login successful', user });
      });
    } catch (authError) {
      console.error('Firebase auth error:', authError);
      if (authError.code === 'auth/id-token-expired') {
        return res.status(401).json({ error: 'Token expired. Please login again.' });
      } else if (authError.code === 'auth/argument-error') {
        return res.status(400).json({ error: 'Invalid token format' });
      } else {
        return res.status(401).json({ error: 'Authentication failed: ' + authError.message });
      }
    }
  } catch (error) {
    console.error('Login error details:', error.stack || error);
    res.status(500).json({ error: 'Server error during authentication: ' + (error.message || 'Unknown error') });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.status(200).json({ message: 'Logout successful' });
});

app.get('/api/user', authenticateUser, (req, res) => {
  res.json({ user: req.user });
});

// Socket.IO authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error - No token provided'));
    }
    
    const decodedToken = await admin.auth().verifyIdToken(token);
    socket.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      displayName: decodedToken.name || decodedToken.email
    };
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication error'));
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    try {
        // Handle user joining with name (now using Firebase user info)
        socket.on('join', () => {
            const username = socket.user.displayName || `User-${socket.id.slice(0, 6)}`;
            const userId = socket.user.uid;
            
            connectedUsers.set(socket.id, {
                username,
                uid: userId
            });
            
            // Add user to default room
            socket.join('lobby');
            
            // Broadcast user joined message
            io.emit('user joined', {
                userId: socket.id,
                username: username,
                firebaseUid: userId,
                timestamp: new Date().toISOString(),
                onlineUsers: Array.from(connectedUsers.values())
            });
        });

        // Create a new room
        socket.on('create room', ({ roomName, secretCode }) => {
            try {
                // Validate inputs
                if (!roomName || !secretCode || typeof roomName !== 'string' || typeof secretCode !== 'string') {
                    socket.emit('room error', 'Invalid room details');
                    return;
                }

                const sanitizedRoomName = roomName.trim().slice(0, 50);
                const sanitizedCode = secretCode.trim().slice(0, 20);
                
                if (!sanitizedRoomName || !sanitizedCode) {
                    socket.emit('room error', 'Room name and secret code are required');
                    return;
                }
                
                // Generate a unique room ID
                const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                
                // Store room details
                rooms.set(roomId, {
                    name: sanitizedRoomName,
                    code: sanitizedCode,
                    creator: socket.id,
                    members: [socket.id],
                    createdAt: new Date().toISOString()
                });
                
                // Join the socket to this room
                socket.join(roomId);
                
                // Notify user that room was created
                socket.emit('room created', {
                    roomId,
                    name: sanitizedRoomName,
                    isCreator: true,
                    memberCount: 1,
                    createdAt: rooms.get(roomId).createdAt
                });
                
                // Update available rooms to all users
                io.emit('rooms update', Array.from(rooms.entries()).map(([id, room]) => ({
                    id,
                    name: room.name,
                    memberCount: room.members.length,
                    createdAt: room.createdAt
                })));
                
                console.log(`Room created: ${sanitizedRoomName} (${roomId}) by ${connectedUsers.get(socket.id)}`);
            } catch (error) {
                console.error('Error creating room:', error);
                socket.emit('room error', 'Failed to create room');
            }
        });
        
        // Join an existing room
        socket.on('join room', ({ roomId, secretCode }) => {
            try {
                // Validate inputs
                if (!roomId || !secretCode || typeof roomId !== 'string' || typeof secretCode !== 'string') {
                    socket.emit('room error', 'Invalid room details');
                    return;
                }
                
                const room = rooms.get(roomId);
                
                // Check if room exists
                if (!room) {
                    socket.emit('room error', 'Room does not exist');
                    return;
                }
                
                // Verify secret code
                if (room.code !== secretCode.trim()) {
                    socket.emit('room error', 'Incorrect secret code');
                    return;
                }
                
                // Add user to room
                room.members.push(socket.id);
                socket.join(roomId);
                
                // Notify user they joined successfully
                socket.emit('room joined', {
                    roomId,
                    name: room.name,
                    isCreator: room.creator === socket.id,
                    memberCount: room.members.length,
                    createdAt: room.createdAt
                });
                
                // Notify room members about the new member
                socket.to(roomId).emit('user joined room', {
                    roomId,
                    userId: socket.id,
                    username: connectedUsers.get(socket.id),
                    memberCount: room.members.length,
                    timestamp: new Date().toISOString()
                });
                
                console.log(`User ${connectedUsers.get(socket.id)} joined room: ${room.name} (${roomId})`);
            } catch (error) {
                console.error('Error joining room:', error);
                socket.emit('room error', 'Failed to join room');
            }
        });
        
        // Leave a room
        socket.on('leave room', (roomId) => {
            try {
                const room = rooms.get(roomId);
                
                if (room) {
                    // Remove user from room members list
                    room.members = room.members.filter(id => id !== socket.id);
                    
                    // Leave the Socket.IO room
                    socket.leave(roomId);
                    
                    // If the room is empty, delete it
                    if (room.members.length === 0) {
                        rooms.delete(roomId);
                        // Update available rooms to all users
                        io.emit('rooms update', Array.from(rooms.entries()).map(([id, room]) => ({
                            id,
                            name: room.name,
                            memberCount: room.members.length,
                            createdAt: room.createdAt
                        })));
                    } else {
                        // Notify remaining members
                        io.to(roomId).emit('user left room', {
                            roomId,
                            userId: socket.id,
                            username: connectedUsers.get(socket.id),
                            memberCount: room.members.length,
                            timestamp: new Date().toISOString()
                        });
                    }
                    
                    // Notify the user they've left
                    socket.emit('room left', { roomId });
                    
                    console.log(`User ${connectedUsers.get(socket.id)} left room: ${room.name} (${roomId})`);
                }
            } catch (error) {
                console.error('Error leaving room:', error);
                socket.emit('room error', 'Failed to leave room');
            }
        });

        // Get list of available rooms
        socket.on('get rooms', () => {
            socket.emit('rooms list', Array.from(rooms.entries()).map(([id, room]) => ({
                id,
                name: room.name,
                memberCount: room.members.length,
                createdAt: room.createdAt
            })));
        });

        // Send message to specific room
        socket.on('room message', ({ roomId, message }) => {
            try {
                const room = rooms.get(roomId);
                
                if (!message || typeof message !== 'string' || !room || !room.members.includes(socket.id)) {
                    return;
                }
                
                const sanitizedMsg = message.trim().slice(0, 500); // Limit message length
                
                if (sanitizedMsg) {
                    const messageData = {
                        userId: socket.id,
                        username: connectedUsers.get(socket.id),
                        message: sanitizedMsg,
                        roomId: roomId,
                        roomName: room.name,
                        timestamp: new Date().toISOString()
                    };
                    
                    io.to(roomId).emit('room message', messageData);
                    console.log(`Room message in ${room.name}: ${sanitizedMsg}`);
                }
            } catch (error) {
                console.error('Error handling room message:', error);
                socket.emit('error', 'Failed to send message to room');
            }
        });

        // Handle chat message event (for public messages)
        socket.on('chat message', (msg) => {
            try {
                if (!msg || typeof msg !== 'string') {
                    return;
                }

                const sanitizedMsg = msg.trim().slice(0, 500); // Limit message length
                
                if (sanitizedMsg) {
                    const messageData = {
                        userId: socket.id,
                        username: connectedUsers.get(socket.id),
                        message: sanitizedMsg,
                        timestamp: new Date().toISOString()
                    };
                    
                    console.log('Message received:', messageData);
                    io.emit('chat message', messageData);
                }
            } catch (error) {
                console.error('Error handling chat message:', error);
                socket.emit('error', 'Failed to process message');
            }
        });

        // Handle disconnect
        socket.on('disconnect', () => {
            const username = connectedUsers.get(socket.id);
            connectedUsers.delete(socket.id);
            
            // Remove user from all rooms they were in
            rooms.forEach((room, roomId) => {
                if (room.members.includes(socket.id)) {
                    room.members = room.members.filter(id => id !== socket.id);
                    
                    // If user was the creator and room is empty, delete the room
                    if (room.members.length === 0) {
                        rooms.delete(roomId);
                    } else {
                        // Notify remaining room members
                        io.to(roomId).emit('user left room', {
                            roomId,
                            userId: socket.id,
                            username: username,
                            memberCount: room.members.length,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            });
            
            // Update room list if any changes occurred
            io.emit('rooms update', Array.from(rooms.entries()).map(([id, room]) => ({
                id,
                name: room.name,
                memberCount: room.members.length,
                createdAt: room.createdAt
            })));
            
            // Notify about general disconnect
            io.emit('user left', {
                userId: socket.id,
                username: username,
                timestamp: new Date().toISOString(),
                onlineUsers: Array.from(connectedUsers.values())
            });
            
            console.log(`User disconnected: ${username} (${socket.id})`);
        });

    } catch (error) {
        console.error('Error handling socket connection:', error);
    }
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';  // Allow connections from all network interfaces

http.listen(PORT, HOST, () => {
    console.log(`Server running on ${HOST}:${PORT}`);
});