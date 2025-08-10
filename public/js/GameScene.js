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
        this.shoveKey = null;
        this.lastShoveTime = 0;
        this.SHOVE_COOLDOWN = 3000; // 3 seconds cooldown
        this.SHOVE_COST = 5; // $5 to shove
        this.SHOVE_FORCE = 300; // Force applied to shoved player
        
        // Click-to-move properties
        this.targetPosition = null;
        this.moveSpeed = 200;
        this.clickIndicator = null;
        this.isMobile = window.innerWidth <= 768;
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
        
        // Set up larger world bounds (1600x1200 instead of 800x600)
        this.physics.world.setBounds(0, 0, 1600, 1200);
        this.cameras.main.setBounds(0, 0, 1600, 1200);
        
        // Draw larger casino background
        this.drawCasino();
        
        // Set up input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,S,A,D');
        this.shoveKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        
        // Set up UI elements
        this.balanceDisplay = document.getElementById('balance-display');
        this.slotMenu = document.getElementById('slot-menu');
        this.spinButton = document.getElementById('spin-button');
        this.claimButton = document.getElementById('claim-button');
        this.closeMenuButton = document.getElementById('close-menu-button');
        this.slotResult = document.getElementById('slot-result');
        this.shoveCooldownDisplay = document.getElementById('shove-cooldown');
        this.shoveTimerDisplay = document.getElementById('shove-timer');
        this.leaderboardList = document.getElementById('leaderboard-list');
        
        // Set up mini-map
        this.miniMapCanvas = document.getElementById('mini-map-canvas');
        this.miniMapContext = this.miniMapCanvas.getContext('2d');
        this.setupMiniMap();
        
        // Set up slot menu event listeners
        this.spinButton.addEventListener('click', () => {
            this.spinSlotMachine();
        });
        
        this.claimButton.addEventListener('click', () => {
            this.claimSlotMachine();
        });
        
        this.closeMenuButton.addEventListener('click', () => {
            this.hideSlotMenu();
        });
        
        // Set up click-to-move for mobile and desktop
        this.input.on('pointerdown', this.handlePointerDown, this);
        
        // Create click indicator
        this.clickIndicator = this.add.graphics();
        this.clickIndicator.setDepth(1000);
        this.clickIndicator.setVisible(false);
        
        // Mark scene as ready
        this.isReady = true;
        console.log('GameScene is ready');
    }

    drawCasino() {
        const casinoWidth = 1600;
        const casinoHeight = 1200;
        
        // Draw casino floor
        const floor = this.add.graphics();
        floor.fillStyle(0x8b4513); // Brown floor
        floor.fillRect(50, 50, casinoWidth - 100, casinoHeight - 100);
        
        // Draw walls
        const walls = this.add.graphics();
        walls.lineStyle(8, 0x654321);
        walls.strokeRect(50, 50, casinoWidth - 100, casinoHeight - 100);
        
        // Draw carpet patterns
        const carpet = this.add.graphics();
        carpet.lineStyle(2, 0x722f37, 0.6);
        
        // Vertical lines
        for (let x = 100; x < casinoWidth - 50; x += 50) {
            carpet.moveTo(x, 70);
            carpet.lineTo(x, casinoHeight - 70);
        }
        
        // Horizontal lines
        for (let y = 100; y < casinoHeight - 50; y += 50) {
            carpet.moveTo(70, y);
            carpet.lineTo(casinoWidth - 70, y);
        }
        
        carpet.strokePath();
        
        // Add some decorative elements
        this.addCasinoDecorations();
    }

    addCasinoDecorations() {
        const decorations = this.add.graphics();
        decorations.lineStyle(4, 0x34495e);
        
        // Add some pillars
        const pillarPositions = [
            { x: 400, y: 300 },
            { x: 1200, y: 300 },
            { x: 400, y: 900 },
            { x: 1200, y: 900 },
            { x: 800, y: 200 },
            { x: 800, y: 1000 }
        ];
        
        pillarPositions.forEach(pos => {
            decorations.fillStyle(0x34495e);
            decorations.fillCircle(pos.x, pos.y, 25);
            decorations.strokeCircle(pos.x, pos.y, 25);
        });
        
        // Add entrance marker
        decorations.fillStyle(0xf39c12);
        decorations.fillRect(780, 40, 40, 20);
        
        // Add some carpet patterns in the center
        decorations.lineStyle(3, 0xc0392b, 0.4);
        decorations.strokeRect(600, 450, 400, 300);
        decorations.strokeRect(620, 470, 360, 260);
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
            
            // Create player group for collisions
            this.playerGroup = this.physics.add.group();
            this.playerGroup.add(this.currentPlayer);
            
            // Set camera to follow current player
            this.cameras.main.startFollow(this.currentPlayer, true, 0.05, 0.05);
            this.cameras.main.setZoom(1);
            
            // Create other players
            data.players.forEach(otherPlayerData => {
                if (otherPlayerData.id !== data.playerId) {
                    const player = new PlayerSprite(this, otherPlayerData.x, otherPlayerData.y, otherPlayerData.id, false, otherPlayerData);
                    this.players.set(otherPlayerData.id, player);
                    this.playerGroup.add(player);
                }
            });
            
            // Initialize leaderboard
            this.updateLeaderboard();
            
            // Create slot machines and collision group
            this.slotMachineGroup = this.physics.add.staticGroup();
            data.slotMachines.forEach(machineData => {
                const machine = new SlotMachineSprite(this, machineData.x, machineData.y, machineData.id);
                
                if (machineData.state === 'showingResult' && machineData.pendingResult) {
                    machine.setState('showingResult', { result: machineData.pendingResult });
                } else {
                    machine.setState(machineData.state);
                }
                
                this.slotMachines.set(machineData.id, machine);
                this.slotMachineGroup.add(machine);
            });
            
            // Set up collision between current player and slot machines
            this.physics.add.collider(this.currentPlayer, this.slotMachineGroup);
            
            // Set up collisions between all players
            this.physics.add.collider(this.playerGroup, this.playerGroup);
            
            console.log('All game objects created, showing game UI');
            // Now show the game UI
            window.showGame();
        });

        this.socket.on('playerJoined', (playerData) => {
            console.log('Player joined:', playerData);
            const playerSprite = new PlayerSprite(this, playerData.x, playerData.y, playerData.id, false, playerData);
            this.players.set(playerData.id, playerSprite);
            if (this.playerGroup) {
                this.playerGroup.add(playerSprite);
            }
            // Update leaderboard when new player joins
            this.updateLeaderboard();
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
            // Update leaderboard when player leaves
            this.updateLeaderboard();
        });

        this.socket.on('slotMachineSpinStarted', (data) => {
            console.log('Slot machine spin started:', data);
            this.balance = data.newBalance;
            this.updateBalanceDisplay();
            
            const machine = this.slotMachines.get(data.slotMachineId);
            if (machine) {
                machine.setState('spinning');
            }
            
            // Update slot menu
            this.spinButton.disabled = true;
            this.spinButton.textContent = 'Spinning...';
            this.slotResult.innerHTML = '<div style="color: #f39c12;">🎰 Spinning... 🎰</div>';
        });

        this.socket.on('slotMachineSpinComplete', (data) => {
            console.log('Slot machine spin complete:', data);
            
            const machine = this.slotMachines.get(data.slotMachineId);
            if (machine) {
                machine.setState('showingResult', { result: data.result });
            }
            
            // Update slot menu if this is the machine the player is using
            if (this.currentSlotMachineId === data.slotMachineId) {
                this.spinButton.style.display = 'none';
                this.claimButton.style.display = 'block';
                this.claimButton.disabled = false;
                this.slotResult.innerHTML = `
                    <div>${data.result.symbols.join(' ')}</div>
                    ${data.result.win ? `<div style="color: #27ae60;">WIN! +$${data.result.winAmount}</div>` : '<div style="color: #e74c3c;">No win</div>'}
                    <div style="color: #f39c12; font-size: 12px;">Click claim to collect!</div>
                `;
            }
        });

        this.socket.on('slotMachineResult', (data) => {
            console.log('Slot machine result:', data);
            this.balance = data.newBalance;
            this.updateBalanceDisplay();
            
            if (data.claimed) {
                // Player claimed a result
                const machine = this.slotMachines.get(data.slotMachineId);
                if (machine) {
                    machine.setState('available');
                }
                
                // Show final result in slot menu
                this.slotResult.innerHTML = `
                    <div>${data.symbols.join(' ')}</div>
                    ${data.win ? `<div style="color: #27ae60;">YOU WON $${data.winAmount}!</div>` : '<div style="color: #e74c3c;">No win</div>'}
                `;
                
                // Re-enable spin button
                this.spinButton.disabled = false;
                this.spinButton.textContent = 'Spin!';
                this.spinButton.style.display = 'block';
                this.claimButton.style.display = 'none';
                
                // Auto-hide menu after showing result
                setTimeout(() => {
                    if (this.currentSlotMachineId === data.slotMachineId) {
                        this.hideSlotMenu();
                    }
                }, 5000);
            }
        });

        this.socket.on('slotMachineError', (data) => {
            console.log('Slot machine error:', data);
            this.slotResult.innerHTML = `<div style="color: #e74c3c;">Error: ${data.error}</div>`;
            this.spinButton.disabled = false;
            this.spinButton.textContent = 'Spin!';
            this.spinButton.style.display = 'block';
            this.claimButton.style.display = 'none';
        });

        this.socket.on('slotMachineStateChanged', (data) => {
            const machine = this.slotMachines.get(data.slotMachineId);
            if (machine) {
                machine.setState(data.state);
            }
        });

        this.socket.on('slotMachineInUse', (data) => {
            const machine = this.slotMachines.get(data.slotMachineId);
            if (machine) {
                machine.setInUse(data.inUse);
            }
        });

        this.socket.on('slotMachinesUpdate', (slotMachines) => {
            // Update all slot machine states
            slotMachines.forEach(machineData => {
                const machine = this.slotMachines.get(machineData.id);
                if (machine) {
                    machine.setInUse(machineData.inUse);
                }
            });
        });

        this.socket.on('playerShoved', (data) => {
            console.log('Player shoved:', data);
            const shovedPlayer = this.players.get(data.shovedPlayerId);
            if (shovedPlayer) {
                // Apply shove force
                shovedPlayer.body.setVelocity(data.forceX, data.forceY);
                
                // Update the player's position to match server
                shovedPlayer.setPosition(data.targetNewX, data.targetNewY);
                
                // Create shove effect
                this.createShoveEffect(shovedPlayer.x, shovedPlayer.y);
                
                // If this player got shoved, close any open slot menu
                if (data.shovedPlayerId === this.currentPlayer.playerId) {
                    this.hideSlotMenu();
                }
            }
            
            // Update balance if this player did the shoving
            if (data.shoverPlayerId === this.currentPlayer.playerId) {
                this.balance = data.newBalance;
                this.updateBalanceDisplay();
            }
        });

        this.socket.on('shoveError', (data) => {
            console.log('Shove error:', data.error);
            // Could show error message to player
        });

        this.socket.on('playerBalanceUpdate', (data) => {
            console.log('Player balance update:', data);
            const player = this.players.get(data.playerId);
            if (player) {
                player.updatePlayerData({ balance: data.newBalance });
            }
            
            // Update leaderboard
            this.updateLeaderboard();
        });
    }

    update() {
        if (!this.currentPlayer || !this.isReady) return;
        
        // Handle player movement
        let velocityX = 0;
        let velocityY = 0;
        const speed = this.moveSpeed;
        
        // Check if using touch controls
        const usingTouch = window.touchMovement && (
            window.touchMovement.up || window.touchMovement.down || 
            window.touchMovement.left || window.touchMovement.right
        );
        
        if (!usingTouch) {
            // Keyboard movement
            if (this.cursors.left.isDown || this.wasd.A.isDown) {
                velocityX = -speed;
            }
            if (this.cursors.right.isDown || this.wasd.D.isDown) {
                velocityX = speed;
            }
            if (this.cursors.up.isDown || this.wasd.W.isDown) {
                velocityY = -speed;
            }
            if (this.cursors.down.isDown || this.wasd.S.isDown) {
                velocityY = speed;
            }
            
            // Click-to-move behavior
            if (this.targetPosition && !this.isMobile) {
                const distance = Phaser.Math.Distance.Between(
                    this.currentPlayer.x, this.currentPlayer.y,
                    this.targetPosition.x, this.targetPosition.y
                );
                
                if (distance > 5) {
                    const angle = Phaser.Math.Angle.Between(
                        this.currentPlayer.x, this.currentPlayer.y,
                        this.targetPosition.x, this.targetPosition.y
                    );
                    
                    velocityX = Math.cos(angle) * speed;
                    velocityY = Math.sin(angle) * speed;
                } else {
                    this.targetPosition = null;
                    this.hideClickIndicator();
                }
            }
            
            // Set player velocity (physics will handle collision)
            this.currentPlayer.body.setVelocity(velocityX, velocityY);
            
            // Send position update to server if player moved
            if (velocityX !== 0 || velocityY !== 0) {
                if (this.socket) {
                    this.socket.emit('playerMove', {
                        x: this.currentPlayer.x,
                        y: this.currentPlayer.y
                    });
                }
            }
        }
        
        // Handle shove input
        if (Phaser.Input.Keyboard.JustDown(this.shoveKey)) {
            this.attemptShove();
        }
        
        // Check for nearby slot machines
        this.checkNearbySlotMachines();
        
        // Update shove cooldown display
        this.updateShoveCooldownDisplay();
        
        // Update mini-map
        this.updateMiniMap();
    }

    setupMiniMap() {
        // Draw the static casino layout on mini-map
        this.miniMapContext.fillStyle = '#8b4513';
        this.miniMapContext.fillRect(0, 0, 160, 120);
        
        // Draw walls
        this.miniMapContext.strokeStyle = '#654321';
        this.miniMapContext.lineWidth = 2;
        this.miniMapContext.strokeRect(5, 5, 150, 110);
    }

    updateMiniMap() {
        if (!this.currentPlayer) return;
        
        // Clear previous frame (but keep the static background)
        this.setupMiniMap();
        
        // Draw current player position
        const playerX = (this.currentPlayer.x / 1600) * 160;
        const playerY = (this.currentPlayer.y / 1200) * 120;
        
        // Draw player as a blue dot
        this.miniMapContext.fillStyle = '#3498db';
        this.miniMapContext.beginPath();
        this.miniMapContext.arc(playerX, playerY, 3, 0, 2 * Math.PI);
        this.miniMapContext.fill();
        
        // Draw other players as red dots
        this.players.forEach((player, playerId) => {
            if (playerId !== this.currentPlayer.playerId) {
                const otherX = (player.x / 1600) * 160;
                const otherY = (player.y / 1200) * 120;
                
                this.miniMapContext.fillStyle = '#e74c3c';
                this.miniMapContext.beginPath();
                this.miniMapContext.arc(otherX, otherY, 2, 0, 2 * Math.PI);
                this.miniMapContext.fill();
            }
        });
        
        // Draw slot machines as small green squares
        this.slotMachines.forEach((machine) => {
            const machineX = (machine.x / 1600) * 160;
            const machineY = (machine.y / 1200) * 120;
            
            this.miniMapContext.fillStyle = machine.inUse ? '#f39c12' : '#27ae60';
            this.miniMapContext.fillRect(machineX - 1, machineY - 1, 2, 2);
        });
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
            // Player moved away from slot machine
            if (this.socket) {
                this.socket.emit('playerLeftSlotMachine', {
                    slotMachineId: this.nearbySlotMachine
                });
            }
            this.nearbySlotMachine = null;
            this.hideSlotMenu();
        }
    }

    showSlotMenu(slotMachineId) {
        const machine = this.slotMachines.get(slotMachineId);
        if (!machine) return;
        
        // Don't show menu if machine is spinning
        if (machine.state === 'spinning') {
            return;
        }
        
        // Don't show menu if machine is in use by another player (but allow showing results)
        if (machine.state === 'inUse') {
            return;
        }
        
        this.currentSlotMachineId = slotMachineId;
        this.slotMenu.style.display = 'block';
        this.slotResult.innerHTML = '';
        
        if (machine.state === 'showingResult') {
            // Machine has a result ready to claim
            this.spinButton.style.display = 'none';
            this.claimButton.style.display = 'block';
            this.claimButton.disabled = false;
            if (machine.currentResult) {
                this.slotResult.innerHTML = `
                    <div>${machine.currentResult.symbols.join(' ')}</div>
                    ${machine.currentResult.win ? `<div style="color: #27ae60;">WIN! +$${machine.currentResult.winAmount}</div>` : '<div style="color: #e74c3c;">No win</div>'}
                    <div style="color: #f39c12; font-size: 12px;">Click claim to collect!</div>
                `;
            }
        } else {
            // Machine is available for new spin
            this.spinButton.style.display = 'block';
            this.claimButton.style.display = 'none';
            this.spinButton.disabled = false;
            this.spinButton.textContent = 'Spin!';
        }
    }

    hideSlotMenu() {
        // Notify server that player left the slot machine
        if (this.currentSlotMachineId !== null && this.socket) {
            this.socket.emit('playerLeftSlotMachine', {
                slotMachineId: this.currentSlotMachineId
            });
        }
        
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

    claimSlotMachine() {
        if (this.currentSlotMachineId === null) {
            return;
        }
        
        // Disable claim button
        this.claimButton.disabled = true;
        this.claimButton.textContent = 'Claiming...';
        
        // Send claim request to server (same as spin for showing result state)
        this.socket.emit('slotMachineSpin', {
            slotMachineId: this.currentSlotMachineId
        });
    }

    updateBalanceDisplay() {
        this.balanceDisplay.textContent = `Balance: $${this.balance}`;
        this.updateLeaderboard();
    }

    updateLeaderboard() {
        // Collect all player data including balances
        const playerList = [];
        
        // Add current player
        if (this.currentPlayer) {
            playerList.push({
                playerId: this.currentPlayer.playerId,
                name: this.currentPlayer.playerName,
                balance: this.balance,
                isCurrentPlayer: true
            });
        }
        
        // Add other players
        this.players.forEach((player, playerId) => {
            if (playerId !== this.currentPlayer?.playerId) {
                playerList.push({
                    playerId: playerId,
                    name: player.playerName,
                    balance: player.playerBalance,
                    isCurrentPlayer: false
                });
            }
        });
        
        // Sort by balance (highest first)
        playerList.sort((a, b) => b.balance - a.balance);
        
        // Update leaderboard HTML
        this.leaderboardList.innerHTML = '';
        
        playerList.forEach((playerData, index) => {
            const entry = document.createElement('div');
            entry.className = `leaderboard-entry ${playerData.isCurrentPlayer ? 'current-player' : ''}`;
            
            const rankSpan = document.createElement('span');
            rankSpan.className = 'leaderboard-rank';
            rankSpan.textContent = `${index + 1}.`;
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'leaderboard-name';
            nameSpan.textContent = playerData.name;
            
            const balanceSpan = document.createElement('span');
            balanceSpan.className = 'leaderboard-balance';
            balanceSpan.textContent = `$${playerData.balance}`;
            
            entry.appendChild(rankSpan);
            entry.appendChild(nameSpan);
            entry.appendChild(balanceSpan);
            
            this.leaderboardList.appendChild(entry);
        });
    }

    updateShoveCooldownDisplay() {
        const currentTime = Date.now();
        const timeSinceShove = currentTime - this.lastShoveTime;
        const remainingCooldown = Math.max(0, this.SHOVE_COOLDOWN - timeSinceShove);
        
        if (remainingCooldown > 0) {
            this.shoveCooldownDisplay.style.display = 'block';
            this.shoveTimerDisplay.textContent = Math.ceil(remainingCooldown / 1000);
        } else {
            this.shoveCooldownDisplay.style.display = 'none';
        }
    }

    attemptShove() {
        const currentTime = Date.now();
        
        // Check cooldown
        if (currentTime - this.lastShoveTime < this.SHOVE_COOLDOWN) {
            console.log('Shove on cooldown');
            return;
        }
        
        // Check if player has enough money
        if (this.balance < this.SHOVE_COST) {
            console.log('Not enough money to shove');
            return;
        }
        
        // Find nearest player within shove range
        const SHOVE_RANGE = 80; // pixels
        let nearestPlayer = null;
        let nearestDistance = Infinity;
        
        this.players.forEach((player, playerId) => {
            if (playerId !== this.currentPlayer.playerId) {
                const distance = Phaser.Math.Distance.Between(
                    this.currentPlayer.x, this.currentPlayer.y,
                    player.x, player.y
                );
                
                if (distance < SHOVE_RANGE && distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestPlayer = { player, playerId };
                }
            }
        });
        
        if (nearestPlayer) {
            // Calculate shove direction (away from current player)
            const dx = nearestPlayer.player.x - this.currentPlayer.x;
            const dy = nearestPlayer.player.y - this.currentPlayer.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            if (length > 0) {
                const normalizedX = dx / length;
                const normalizedY = dy / length;
                
                // Send shove request to server
                this.socket.emit('playerShove', {
                    targetPlayerId: nearestPlayer.playerId,
                    forceX: normalizedX * this.SHOVE_FORCE,
                    forceY: normalizedY * this.SHOVE_FORCE
                });
                
                this.lastShoveTime = currentTime;
            }
        } else {
            console.log('No player nearby to shove');
        }
    }

    createShoveEffect(x, y) {
        // Create a visual effect for the shove
        const shoveEffect = this.add.graphics();
        shoveEffect.fillStyle(0xffffff, 0.8);
        shoveEffect.fillCircle(x, y, 20);
        
        // Animate the effect
        this.tweens.add({
            targets: shoveEffect,
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 300,
            ease: 'Power2',
            onComplete: () => {
                shoveEffect.destroy();
            }
        });
        
        // Add some particles
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const particle = this.add.graphics();
            particle.fillStyle(0xffffff);
            particle.fillCircle(x, y, 2);
            
            this.tweens.add({
                targets: particle,
                x: x + Math.cos(angle) * 40,
                y: y + Math.sin(angle) * 40,
                alpha: 0,
                duration: 400,
                ease: 'Power2',
                onComplete: () => {
                    particle.destroy();
                }
            });
        }
    }

    handlePointerDown(pointer) {
        // Only use click-to-move on desktop or when not using touch controls
        if (this.isMobile || !this.currentPlayer) return;
        
        // Don't move if clicking on UI elements
        if (this.slotMenu.style.display === 'block') return;
        
        // Convert pointer position to world coordinates
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        
        this.targetPosition = { x: worldPoint.x, y: worldPoint.y };
        this.showClickIndicator(worldPoint.x, worldPoint.y);
    }

    showClickIndicator(x, y) {
        this.clickIndicator.clear();
        this.clickIndicator.lineStyle(2, 0xf39c12);
        this.clickIndicator.strokeCircle(x, y, 10);
        this.clickIndicator.setVisible(true);
        
        // Update HTML indicator for visual feedback
        const screenPoint = this.cameras.main.getScreenPoint(x, y);
        const indicator = document.getElementById('click-to-move-indicator');
        if (indicator) {
            indicator.style.left = (screenPoint.x - 10) + 'px';
            indicator.style.top = (screenPoint.y - 10) + 'px';
            indicator.style.display = 'block';
            
            // Hide after animation
            setTimeout(() => {
                indicator.style.display = 'none';
            }, 1000);
        }
    }

    hideClickIndicator() {
        this.clickIndicator.setVisible(false);
        const indicator = document.getElementById('click-to-move-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }
}
