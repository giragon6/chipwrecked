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

// Set up spin completion callback
gameManager.setSpinCompleteCallback((slotMachineId, result) => {
    // Get the slot machine position for spatial audio
    const machine = gameManager.slotMachines.find(m => m.id === slotMachineId);
    const machinePosition = machine ? { x: machine.x, y: machine.y } : { x: 0, y: 0 };
    
    // Broadcast spin completion to all players
    io.emit('slotMachineSpinComplete', {
        slotMachineId: slotMachineId,
        result: result
    });
    
    // Broadcast appropriate audio event based on result
    if (result.win) {
        io.emit('playSpatialAudio', {
            sound: 'winning', // Will need to add this audio file
            position: machinePosition,
            source: 'slotMachine'
        });
    } else {
        io.emit('playSpatialAudio', {
            sound: 'awdangit',
            position: machinePosition,
            source: 'slotMachine'
        });
    }
});

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
            if (result.spinning) {
                // Get slot machine position for spatial audio
                const machine = gameManager.slotMachines.find(m => m.id === data.slotMachineId);
                const machinePosition = machine ? { x: machine.x, y: machine.y } : { x: 0, y: 0 };
                
                // Machine started spinning
                socket.emit('slotMachineSpinStarted', {
                    slotMachineId: data.slotMachineId,
                    newBalance: result.newBalance
                });

                // Broadcast to other players that machine is spinning and update player balance
                socket.broadcast.emit('slotMachineStateChanged', {
                    slotMachineId: data.slotMachineId,
                    state: 'spinning'
                });
                
                // Broadcast balance update to all players
                io.emit('playerBalanceUpdate', {
                    playerId: socket.id,
                    newBalance: result.newBalance
                });
                
                // Play "letsgo" sound for everyone
                io.emit('playSpatialAudio', {
                    sound: 'letsgo',
                    position: machinePosition,
                    source: 'slotMachine'
                });
            } else if (result.claimed) {
                // Player claimed a result
                socket.emit('slotMachineResult', {
                    slotMachineId: data.slotMachineId,
                    symbols: result.symbols,
                    win: result.win,
                    winAmount: result.winAmount,
                    newBalance: result.newBalance,
                    claimed: true
                });

                // Broadcast that machine is now available
                socket.broadcast.emit('slotMachineStateChanged', {
                    slotMachineId: data.slotMachineId,
                    state: 'available'
                });
                
                // Broadcast balance update to all players
                io.emit('playerBalanceUpdate', {
                    playerId: socket.id,
                    newBalance: result.newBalance
                });
            }
        } else {
            // Send error to player
            socket.emit('slotMachineError', {
                slotMachineId: data.slotMachineId,
                error: result.error
            });
        }
    });

    // Handle player leaving slot machine
    socket.on('playerLeftSlotMachine', (data) => {
        gameManager.setSlotMachineInUse(data.slotMachineId, false);
        
        // Broadcast that slot machine is now available
        socket.broadcast.emit('slotMachineInUse', {
            slotMachineId: data.slotMachineId,
            playerId: socket.id,
            inUse: false
        });
    });

    // Handle player shove
    socket.on('playerShove', (data) => {
        const result = gameManager.shovePlayer(socket.id, data.targetPlayerId, data.shoveDirection.x, data.shoveDirection.y);
        
        if (result.success) {
            // Broadcast shove to all players
            io.emit('playerShoved', {
                shoverPlayerId: result.shoverPlayerId,
                shovedPlayerId: result.shovedPlayerId,
                shoveDirection: result.shoveDirection,
                newBalance: result.newBalance,
                targetNewX: result.targetNewX,
                targetNewY: result.targetNewY
            });
        } else {
            // Send error to player
            socket.emit('shoveError', {
                error: result.error
            });
        }
    });

    // Handle player disconnect
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        
        // Clear any slot machines this player was using
        gameManager.clearPlayerSlotMachines(socket.id);
        
        // Remove player and broadcast
        gameManager.removePlayer(socket.id);
        socket.broadcast.emit('playerLeft', socket.id);
        
        // Broadcast that all slot machines are now available (in case player was using one)
        const slotMachines = gameManager.getSlotMachines();
        socket.broadcast.emit('slotMachinesUpdate', slotMachines);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
