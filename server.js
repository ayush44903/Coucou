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

// Serve static files from public directory
app.use(express.static('public'));

// Track connected users with their names
const connectedUsers = new Map();

// Socket.IO connection handling
io.on('connection', (socket) => {
    try {
        // Handle user joining with name
        socket.on('join', (username) => {
            const sanitizedUsername = username?.trim().slice(0, 30) || `User-${socket.id.slice(0, 6)}`;
            connectedUsers.set(socket.id, sanitizedUsername);
            
            // Broadcast user joined message
            io.emit('user joined', {
                userId: socket.id,
                username: sanitizedUsername,
                timestamp: new Date().toISOString(),
                onlineUsers: Array.from(connectedUsers.values())
            });
        });

        // Handle chat message event
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
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});