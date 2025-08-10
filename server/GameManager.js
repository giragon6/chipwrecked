const Player = require('./Player');
const SlotMachine = require('./SlotMachine');

class GameManager {
    constructor() {
        this.players = new Map();
        this.slotMachines = this.initializeSlotMachines();
        this.slotMachineUsers = new Map(); // Track which player is using which slot machine
    }

    initializeSlotMachines() {
        const machines = [];
        const machinePositions = [];
        
        // Casino dimensions: 1600x1200 (much larger than 800x600 viewport)
        const casinoWidth = 1600;
        const casinoHeight = 1200;
        const machineSize = 50;
        const spacing = 80;
        
        // Top wall slot machines
        for (let x = 150; x < casinoWidth - 150; x += spacing) {
            machinePositions.push({ x: x, y: 120 });
        }
        
        // Bottom wall slot machines
        for (let x = 150; x < casinoWidth - 150; x += spacing) {
            machinePositions.push({ x: x, y: casinoHeight - 120 });
        }
        
        // Left wall slot machines
        for (let y = 200; y < casinoHeight - 200; y += spacing) {
            machinePositions.push({ x: 120, y: y });
        }
        
        // Right wall slot machines
        for (let y = 200; y < casinoHeight - 200; y += spacing) {
            machinePositions.push({ x: casinoWidth - 120, y: y });
        }
        
        // Interior clusters of slot machines
        const clusterPositions = [
            // Top-left cluster
            { centerX: 300, centerY: 300, rows: 2, cols: 3 },
            // Top-right cluster
            { centerX: casinoWidth - 300, centerY: 300, rows: 2, cols: 3 },
            // Bottom-left cluster
            { centerX: 300, centerY: casinoHeight - 300, rows: 2, cols: 3 },
            // Bottom-right cluster
            { centerX: casinoWidth - 300, centerY: casinoHeight - 300, rows: 2, cols: 3 },
            // Center clusters
            { centerX: casinoWidth / 2 - 200, centerY: casinoHeight / 2, rows: 3, cols: 2 },
            { centerX: casinoWidth / 2 + 200, centerY: casinoHeight / 2, rows: 3, cols: 2 },
        ];
        
        // Add cluster machines
        clusterPositions.forEach(cluster => {
            for (let row = 0; row < cluster.rows; row++) {
                for (let col = 0; col < cluster.cols; col++) {
                    const x = cluster.centerX + (col - (cluster.cols - 1) / 2) * spacing;
                    const y = cluster.centerY + (row - (cluster.rows - 1) / 2) * spacing;
                    machinePositions.push({ x: x, y: y });
                }
            }
        });

        machinePositions.forEach((pos, index) => {
            const machine = new SlotMachine(index, pos.x, pos.y);
            // Set up the callback for when this machine completes spinning
            machine.setSpinCompleteCallback((slotMachineId, result) => {
                this.onSpinComplete(slotMachineId, result);
            });
            machines.push(machine);
        });

        return machines;
    }

    addPlayer(socketId, playerData = {}) {
        // Spawn player in the center of the larger casino
        const player = new Player(socketId, 800, 600, playerData);
        this.players.set(socketId, player);
        return player;
    }

    updatePlayerData(socketId, playerData) {
        const player = this.players.get(socketId);
        if (player) {
            player.updatePlayerData(playerData);
        }
        return player;
    }

    removePlayer(socketId) {
        this.players.delete(socketId);
    }

    updatePlayerPosition(socketId, x, y) {
        const player = this.players.get(socketId);
        if (player) {
            player.updatePosition(x, y);
        }
    }

    getAllPlayers() {
        return Array.from(this.players.values()).map(player => player.toJSON());
    }

    getSlotMachines() {
        return this.slotMachines.map(machine => machine.getState());
    }

    spinSlotMachine(playerId, slotMachineId) {
        const player = this.players.get(playerId);
        const machine = this.slotMachines.find(m => m.id === slotMachineId);

        if (!player || !machine) {
            return { success: false, error: 'Player or machine not found' };
        }

        if (player.balance < 10) {
            return { success: false, error: 'Insufficient balance' };
        }

        // Check if machine can be spun
        if (!machine.canInteract()) {
            return { success: false, error: 'Machine is not available for spinning' };
        }

        // If machine is showing result, player is claiming it
        if (machine.state === 'showingResult') {
            const result = machine.claimResult(playerId);
            if (result && result.success) {
                // Don't deduct bet amount since it was already deducted
                if (result.win) {
                    player.balance += result.winAmount;
                }
                return {
                    success: true,
                    symbols: result.symbols,
                    win: result.win,
                    winAmount: result.winAmount,
                    newBalance: player.balance,
                    claimed: true
                };
            }
        }

        // Deduct bet amount for new spin
        player.balance -= 10;

        // Start spinning
        const spinResult = machine.startSpin(playerId);
        
        if (spinResult && spinResult.success) {
            return {
                success: true,
                spinning: true,
                newBalance: player.balance
            };
        }

        return { success: false, error: 'Could not start spinning' };
    }

    onSpinComplete(slotMachineId, result) {
        // This will be called by the server to broadcast spin completion
        // The server.js will handle the actual broadcasting
        if (this.spinCompleteCallback) {
            this.spinCompleteCallback(slotMachineId, result);
        }
    }

    setSpinCompleteCallback(callback) {
        this.spinCompleteCallback = callback;
    }

    setSlotMachineInUse(slotMachineId, inUse, playerId = null) {
        const machine = this.slotMachines.find(m => m.id === slotMachineId);
        if (machine) {
            machine.setInUse(inUse);
            
            if (inUse && playerId) {
                this.slotMachineUsers.set(slotMachineId, playerId);
            } else {
                this.slotMachineUsers.delete(slotMachineId);
            }
        }
    }

    clearPlayerSlotMachines(playerId) {
        // Find all slot machines this player was using and mark them as available
        for (const [slotMachineId, userId] of this.slotMachineUsers.entries()) {
            if (userId === playerId) {
                const machine = this.slotMachines.find(m => m.id === slotMachineId);
                if (machine) {
                    machine.setInUse(false);
                }
                this.slotMachineUsers.delete(slotMachineId);
            }
        }
    }

    shovePlayer(shoverPlayerId, targetPlayerId, forceX, forceY) {
        const shover = this.players.get(shoverPlayerId);
        const target = this.players.get(targetPlayerId);

        if (!shover || !target) {
            return { success: false, error: 'Player not found' };
        }

        // Check if shover can afford it
        if (!shover.canAffordBet(5)) {
            return { success: false, error: 'Insufficient balance' };
        }

        // Check cooldown
        if (!shover.canShove()) {
            return { success: false, error: 'Shove on cooldown' };
        }

        // Check distance
        const distance = Math.sqrt(
            Math.pow(target.x - shover.x, 2) + 
            Math.pow(target.y - shover.y, 2)
        );

        if (distance > 80) {
            return { success: false, error: 'Target too far away' };
        }

        // Deduct cost and set cooldown
        shover.deductBalance(5);
        shover.setShoveTime();

        // Calculate new position for shoved player
        const newX = Math.max(70, Math.min(1530, target.x + forceX * 0.3)); // Keep within bounds
        const newY = Math.max(70, Math.min(1130, target.y + forceY * 0.3)); // Keep within bounds
        
        // Update target position
        target.updatePosition(newX, newY);

        // Check if target was near any slot machines and remove them
        for (const [slotMachineId, userId] of this.slotMachineUsers.entries()) {
            if (userId === targetPlayerId) {
                const machine = this.slotMachines.find(m => m.id === slotMachineId);
                if (machine) {
                    // Only remove if machine is not spinning or showing result
                    if (machine.state === 'inUse') {
                        machine.setInUse(false);
                        this.slotMachineUsers.delete(slotMachineId);
                    }
                }
            }
        }

        return {
            success: true,
            shoverPlayerId: shoverPlayerId,
            shovedPlayerId: targetPlayerId,
            forceX: forceX,
            forceY: forceY,
            newBalance: shover.balance,
            targetNewX: newX,
            targetNewY: newY
        };
    }
}

module.exports = GameManager;
