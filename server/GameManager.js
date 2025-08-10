const Player = require('./Player');
const SlotMachine = require('./SlotMachine');

class GameManager {
    constructor() {
        this.players = new Map();
        this.slotMachines = this.initializeSlotMachines();
    }

    initializeSlotMachines() {
        const machines = [];
        const machinePositions = [
            // Top wall
            { x: 150, y: 100 },
            { x: 250, y: 100 },
            { x: 350, y: 100 },
            { x: 450, y: 100 },
            { x: 550, y: 100 },
            { x: 650, y: 100 },
            
            // Bottom wall
            { x: 150, y: 500 },
            { x: 250, y: 500 },
            { x: 350, y: 500 },
            { x: 450, y: 500 },
            { x: 550, y: 500 },
            { x: 650, y: 500 },
            
            // Left wall
            { x: 100, y: 200 },
            { x: 100, y: 300 },
            { x: 100, y: 400 },
            
            // Right wall
            { x: 700, y: 200 },
            { x: 700, y: 300 },
            { x: 700, y: 400 }
        ];

        machinePositions.forEach((pos, index) => {
            machines.push(new SlotMachine(index, pos.x, pos.y));
        });

        return machines;
    }

    addPlayer(socketId, playerData = {}) {
        // Spawn player in the center of the casino
        const player = new Player(socketId, 400, 300, playerData);
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
        return this.slotMachines.map(machine => ({
            id: machine.id,
            x: machine.x,
            y: machine.y,
            inUse: machine.inUse
        }));
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

        // Deduct bet amount
        player.balance -= 10;

        // Spin the machine
        const result = machine.spin();
        
        // Check for win
        if (result.win) {
            player.balance += result.winAmount;
        }

        return {
            success: true,
            symbols: result.symbols,
            win: result.win,
            winAmount: result.winAmount,
            newBalance: player.balance
        };
    }
}

module.exports = GameManager;
