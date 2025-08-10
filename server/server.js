const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const GameManager = require('./GameManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Create game manager instance
const gameManager = new GameManager();

// Handle client connections
io.on('connection', (socket) => {
    console.log('New player connected:', socket.id);

    // Handle player customization
    socket.on('playerCustomization', (playerData) => {
        console.log('Received player customization:', playerData);
        
        // Initialize player with custom data
        const player = gameManager.addPlayer(socket.id, playerData);
        
        console.log('Player customized:', player.name, player.color);
        
        // Send initial game state to the new player
        socket.emit('gameInit', {
            playerId: socket.id,
            player: player.toJSON(),
            slotMachines: gameManager.getSlotMachines(),
            players: gameManager.getAllPlayers().filter(p => p.id !== socket.id)
        });

        // Broadcast new player to all other players
        socket.broadcast.emit('playerJoined', player.toJSON());
    });

    // Handle player movement
    socket.on('playerMove', (data) => {
        gameManager.updatePlayerPosition(socket.id, data.x, data.y);
        socket.broadcast.emit('playerMoved', {
            playerId: socket.id,
            x: data.x,
            y: data.y
        });
    });

    // Handle slot machine interaction
    socket.on('slotMachineSpin', (data) => {
        const result = gameManager.spinSlotMachine(socket.id, data.slotMachineId);
        
        if (result.success) {
            // Send result to the player
            socket.emit('slotMachineResult', {
                slotMachineId: data.slotMachineId,
                symbols: result.symbols,
                win: result.win,
                winAmount: result.winAmount,
                newBalance: result.newBalance
            });

            // Broadcast to other players that someone is using this slot machine
            socket.broadcast.emit('slotMachineInUse', {
                slotMachineId: data.slotMachineId,
                playerId: socket.id
            });
        }
    });

    // Handle player disconnect
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        gameManager.removePlayer(socket.id);
        socket.broadcast.emit('playerLeft', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
