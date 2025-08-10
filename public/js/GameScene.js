class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.players = new Map();
        this.slotMachines = new Map();
        this.currentPlayer = null;
        this.cursors = null;
        this.socket = null;
        this.balance = 1000;
        this.nearbySlotMachine = null;
        this.currentSlotMachineId = null;
        this.isReady = false;
    }

    initialize(socket) {
        this.socket = socket;
        this.setupSocketListeners();
    }

    preload() {
        // No assets to preload since we're using graphics
    }

    create() {
        console.log('GameScene create() called');
        
        // Set up world bounds
        this.cameras.main.setBounds(0, 0, 800, 600);
        
        // Draw casino background
        this.drawCasino();
        
        // Set up input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        
        // Set up UI elements
        this.balanceDisplay = document.getElementById('balance-display');
        this.slotMenu = document.getElementById('slot-menu');
        this.spinButton = document.getElementById('spin-button');
        this.closeMenuButton = document.getElementById('close-menu-button');
        this.slotResult = document.getElementById('slot-result');
        
        // Set up slot menu event listeners
        this.spinButton.addEventListener('click', () => {
            this.spinSlotMachine();
        });
        
        this.closeMenuButton.addEventListener('click', () => {
            this.hideSlotMenu();
        });
        
        // Mark scene as ready
        this.isReady = true;
        console.log('GameScene is ready');
    }

    drawCasino() {
        // Draw casino floor
        const floor = this.add.graphics();
        floor.fillStyle(0x8b4513); // Brown floor
        floor.fillRect(50, 50, 700, 500);
        
        // Draw walls
        const walls = this.add.graphics();
        walls.lineStyle(8, 0x654321);
        walls.strokeRect(50, 50, 700, 500);
        
        // Draw carpet patterns
        const carpet = this.add.graphics();
        carpet.lineStyle(2, 0x722f37);
        for (let i = 100; i < 700; i += 50) {
            carpet.moveTo(i, 70);
            carpet.lineTo(i, 530);
        }
        for (let i = 100; i < 500; i += 50) {
            carpet.moveTo(70, i);
            carpet.lineTo(730, i);
        }
        carpet.strokePath();
    }

    setupSocketListeners() {
        this.socket.on('gameInit', (data) => {
            console.log('Game initialized:', data);
            this.balance = data.player.balance;
            this.updateBalanceDisplay();
            
            // Get player data from pending customization
            const playerData = window.pendingPlayerData || { name: 'Player', color: 0x3498db };
            
            // Create current player with custom data
            this.currentPlayer = new PlayerSprite(this, data.player.x, data.player.y, data.playerId, true, playerData);
            this.players.set(data.playerId, this.currentPlayer);
            
            // Create other players
            data.players.forEach(otherPlayerData => {
                if (otherPlayerData.id !== data.playerId) {
                    const player = new PlayerSprite(this, otherPlayerData.x, otherPlayerData.y, otherPlayerData.id, false, otherPlayerData);
                    this.players.set(otherPlayerData.id, player);
                }
            });
            
            // Create slot machines
            data.slotMachines.forEach(machineData => {
                const machine = new SlotMachineSprite(this, machineData.x, machineData.y, machineData.id);
                this.slotMachines.set(machineData.id, machine);
            });
            
            console.log('All game objects created, showing game UI');
            // Now show the game UI
            window.showGame();
        });

        this.socket.on('playerJoined', (playerData) => {
            console.log('Player joined:', playerData);
            const playerSprite = new PlayerSprite(this, playerData.x, playerData.y, playerData.id, false, playerData);
            this.players.set(playerData.id, playerSprite);
        });

        this.socket.on('playerMoved', (data) => {
            const player = this.players.get(data.playerId);
            if (player) {
                player.updatePosition(data.x, data.y);
            }
        });

        this.socket.on('playerLeft', (playerId) => {
            console.log('Player left:', playerId);
            const player = this.players.get(playerId);
            if (player) {
                player.destroy();
                this.players.delete(playerId);
            }
        });

        this.socket.on('slotMachineResult', (data) => {
            console.log('Slot machine result:', data);
            this.balance = data.newBalance;
            this.updateBalanceDisplay();
            
            // Show result in slot menu
            this.slotResult.innerHTML = `
                <div>${data.symbols.join(' ')}</div>
                ${data.win ? `<div style="color: #27ae60;">WIN! +$${data.winAmount}</div>` : '<div style="color: #e74c3c;">No win</div>'}
            `;
            
            // Re-enable spin button
            this.spinButton.disabled = false;
            this.spinButton.textContent = 'Spin!';
        });

        this.socket.on('slotMachineInUse', (data) => {
            const machine = this.slotMachines.get(data.slotMachineId);
            if (machine) {
                machine.setInUse(true);
            }
        });
    }

    update() {
        if (!this.currentPlayer || !this.isReady) return;
        
        // Handle player movement
        let moveX = 0;
        let moveY = 0;
        
        if (this.cursors.left.isDown || this.wasd.A.isDown) {
            moveX = -200;
        }
        if (this.cursors.right.isDown || this.wasd.D.isDown) {
            moveX = 200;
        }
        if (this.cursors.up.isDown || this.wasd.W.isDown) {
            moveY = -200;
        }
        if (this.cursors.down.isDown || this.wasd.S.isDown) {
            moveY = 200;
        }
        
        if (moveX !== 0 || moveY !== 0) {
            // Calculate new position
            const deltaTime = this.game.loop.delta / 1000;
            const newX = this.currentPlayer.x + (moveX * deltaTime);
            const newY = this.currentPlayer.y + (moveY * deltaTime);
            
            // Boundary checking
            const boundedX = Phaser.Math.Clamp(newX, 65, 735);
            const boundedY = Phaser.Math.Clamp(newY, 65, 535);
            
            this.currentPlayer.updatePosition(boundedX, boundedY);
            
            // Send position update to server
            if (this.socket) {
                this.socket.emit('playerMove', {
                    x: boundedX,
                    y: boundedY
                });
            }
        }
        
        // Check for nearby slot machines
        this.checkNearbySlotMachines();
    }

    checkNearbySlotMachines() {
        if (!this.currentPlayer) return;
        
        let foundNearby = false;
        
        this.slotMachines.forEach((machine, id) => {
            if (machine.isNearPlayer(this.currentPlayer.x, this.currentPlayer.y)) {
                if (this.nearbySlotMachine !== id) {
                    this.nearbySlotMachine = id;
                    this.showSlotMenu(id);
                    foundNearby = true;
                }
                foundNearby = true;
            }
        });
        
        if (!foundNearby && this.nearbySlotMachine !== null) {
            this.nearbySlotMachine = null;
            this.hideSlotMenu();
        }
    }

    showSlotMenu(slotMachineId) {
        this.currentSlotMachineId = slotMachineId;
        this.slotMenu.style.display = 'block';
        this.slotResult.innerHTML = '';
        this.spinButton.disabled = false;
        this.spinButton.textContent = 'Spin!';
    }

    hideSlotMenu() {
        this.slotMenu.style.display = 'none';
        this.currentSlotMachineId = null;
    }

    spinSlotMachine() {
        if (this.currentSlotMachineId === null || this.balance < 10) {
            return;
        }
        
        // Disable spin button and show spinning animation
        this.spinButton.disabled = true;
        this.spinButton.textContent = 'Spinning...';
        this.slotResult.innerHTML = '<div>🎰 🎰 🎰</div>';
        
        // Send spin request to server
        this.socket.emit('slotMachineSpin', {
            slotMachineId: this.currentSlotMachineId
        });
    }

    updateBalanceDisplay() {
        this.balanceDisplay.textContent = `Balance: $${this.balance}`;
    }
}
