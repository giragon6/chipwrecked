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
        this.lastClickTime = 0;
        this.SHOVE_COOLDOWN = 3000; // 3 seconds cooldown
        this.SHOVE_COST = 50; // $5 to shove
        
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
        this.load.image('background', 'assets/shipdeck2.svg');
        this.load.image('ocean-background', 'assets/oceanbackground.svg');
        this.load.audio('letsgo', 'assets/audio/gamblecore-letsgo.mp3')
        this.load.audio('awdangit', 'assets/audio/gamblecore-awdangit.mp3')
        // Note: winning sound file needs to be added to assets/audio/
        // For now, we'll use letsgo as a fallback
        this.load.audio('winning', ['assets/audio/gamblecore-winning.mp3', 'assets/audio/gamblecore-letsgo.mp3'])
    }

    create() {
        console.log('GameScene create() called');
        
        this.physics.world.setBounds(0, 0, 1600, 1200);
        this.cameras.main.setBounds(0, 0, 1600, 1200);
        
        this.drawCasino();
        
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

        this.add.image(0, 0, 'ocean-background').setOrigin(0, 0);
        this.add.image(0, 0, 'background').setOrigin(0.15,0).setScale(0.8);
    }

    drawCasino() {
        const casinoWidth = 1600;
        const casinoHeight = 1200;

        // // Draw casino floor (fill entire area)
        // const floor = this.add.graphics();
        // floor.fillStyle(0x8b4513); // Brown floor
        // floor.fillRect(0, 0, casinoWidth, casinoHeight);

        // // Draw walls (at the very edge)
        // const walls = this.add.graphics();
        // walls.lineStyle(8, 0x654321);
        // walls.strokeRect(0, 0, casinoWidth, casinoHeight);

        // // Draw carpet patterns (cover full area)
        // const carpet = this.add.graphics();
        // carpet.lineStyle(2, 0x722f37, 0.6);

        // // Vertical lines
        // for (let x = 50; x < casinoWidth; x += 50) {
        //     carpet.moveTo(x, 0);
        //     carpet.lineTo(x, casinoHeight);
        // }

        // // Horizontal lines
        // for (let y = 50; y < casinoHeight; y += 50) {
        //     carpet.moveTo(0, y);
        //     carpet.lineTo(casinoWidth, y);
        // }

        // carpet.strokePath();
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
                const machine = new SlotMachineSprite(this, machineData.x, machineData.y, machineData.id, machineData);
                
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
                    ${data.result.win ? `<div style="color: #27ae60;">WIN! +$${data.result.winAmount}</div>` : '<div style="color: #e74c3c;">No win :(</div>'}
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
                // Directly set the new position from server
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

        // Handle spatial audio events
        this.socket.on('playSpatialAudio', (data) => {
            this.playSpatialAudio(data.sound, data.position);
        });
    }

    update() {
        if (!this.currentPlayer || !this.isReady) return;
        
        // Handle player movement
        let velocityX = 0;
        let velocityY = 0;
        const speed = this.moveSpeed;
        
        // Keyboard movement (takes priority over click-to-move)
        let keyboardMovement = false;
        if (this.cursors.left.isDown || this.wasd.A.isDown) {
            velocityX = -speed;
            keyboardMovement = true;
        }
        if (this.cursors.right.isDown || this.wasd.D.isDown) {
            velocityX = speed;
            keyboardMovement = true;
        }
        if (this.cursors.up.isDown || this.wasd.W.isDown) {
            velocityY = -speed;
            keyboardMovement = true;
        }
        if (this.cursors.down.isDown || this.wasd.S.isDown) {
            velocityY = speed;
            keyboardMovement = true;
        }
        
        // If using keyboard, cancel click-to-move
        if (keyboardMovement && this.targetPosition) {
            this.targetPosition = null;
            this.hideClickIndicator();
        }
        
        // Click-to-move (only if no keyboard input)
        if (!keyboardMovement && this.targetPosition) {
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
        
        // Apply movement
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
        
        // Handle shove input
        if (Phaser.Input.Keyboard.JustDown(this.shoveKey)) {
            this.attemptShove();
        }
        
        // Check for nearby slot machines
        this.checkNearbySlotMachines();
        
        // Update shove cooldown display
        this.updateShoveCooldownDisplay();
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
        
        // Update slot info with tier and cost
        const slotTitle = document.getElementById('slot-title');
        const slotTierInfo = document.getElementById('slot-tier-info');
        const slotCost = document.getElementById('slot-cost');
        
        if (slotTitle) {
            slotTitle.textContent = `${machine.tier.name} Slot Machine`;
        }
        
        if (slotTierInfo) {
            const tierColors = {
                'Basic': '#3498db',
                'Premium': '#9b59b6', 
                'Gold': '#f1c40f',
                'Diamond': '#1abc9c'
            };
            slotTierInfo.innerHTML = `<span style="color: ${tierColors[machine.tier.name] || '#ffffff'}; font-weight: bold;">${machine.tier.name} Tier</span>`;
        }
        
        if (slotCost) {
            // Always allow spinning regardless of balance
            slotCost.innerHTML = `Cost: <span style="color: #f1c40f; font-weight: bold;">$${machine.cost}</span> per spin`;
        }
        
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
            // Machine is available for new spin - always allow spinning
            this.spinButton.style.display = 'block';
            this.claimButton.style.display = 'none';
            this.spinButton.disabled = false; // Always enable spinning
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
        if (this.currentSlotMachineId === null) {
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
        
        // Send claim request to server (same as spin for showing result state)
        this.socket.emit('slotMachineSpin', {
            slotMachineId: this.currentSlotMachineId
        });
    }

    updateBalanceDisplay() {
        const balanceColor = this.balance < 0 ? '#e74c3c' : '#ffffff'; // Red for negative, white for positive
        this.balanceDisplay.innerHTML = `Balance: <span style="color: ${balanceColor}; font-weight: ${this.balance < 0 ? 'bold' : 'normal'};">$${this.balance}</span>`;
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
            
            // Style negative balances in red
            if (playerData.balance < 0) {
                balanceSpan.style.color = '#e74c3c';
                balanceSpan.style.fontWeight = 'bold';
            }
            
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
        
        // Remove balance check - allow negative balance
        
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
                    shoveDirection: {
                        x: normalizedX,
                        y: normalizedY
                    }
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
      if (!this.currentPlayer) return;
      
        // Don't move if clicking on UI elements
        if (this.slotMenu.style.display === 'block') return;
        
        const currentTime = Date.now();
        const timeSinceClick = currentTime - this.lastClickTime;
        const doubleClick = timeSinceClick < 500;
        
        console.log(timeSinceClick)
        this.lastClickTime = currentTime;
        if (doubleClick) { 
          this.attemptShove();
          return;
        };
        
        // Convert pointer position to world coordinates
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        
        // Set move target (works on both desktop and mobile now)
        this.targetPosition = { x: worldPoint.x, y: worldPoint.y };
        this.showClickIndicator(worldPoint.x, worldPoint.y);
    }

    checkPlayerClick(worldX, worldY) {
        // Check if click position is near any player
        for (let [playerId, player] of this.players) {
            const distance = Phaser.Math.Distance.Between(worldX, worldY, player.x, player.y);
            if (distance <= 40) { // 40 pixel radius for clicking on players
                return player;
            }
        }
        return null;
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

    playSpatialAudio(soundKey, position) {
        if (!this.currentPlayer) return;
        
        // Calculate distance between player and sound source
        const distance = Phaser.Math.Distance.Between(
            this.currentPlayer.x, this.currentPlayer.y,
            position.x, position.y
        );
        
        // Maximum hearing distance (beyond this, sound volume is 0)
        const MAX_DISTANCE = 400;
        
        // Calculate volume based on distance (1.0 at source, 0.0 at max distance)
        let volume = Math.max(0, 1 - (distance / MAX_DISTANCE));
        
        // Apply volume curve for more realistic falloff
        volume = Math.pow(volume, 2); // Exponential falloff
        
        // Only play if volume is above threshold
        if (volume > 0.05) {
            // Calculate pan based on horizontal position relative to player
            const deltaX = position.x - this.currentPlayer.x;
            const pan = Math.max(-1, Math.min(1, deltaX / 200)); // Pan range: -1 to 1
            
            // Play the sound with spatial properties
            const sound = this.sound.add(soundKey, {
                volume: volume * 0.7, // Scale down overall volume
                pan: pan
            });
            
            sound.play();
            
            // Clean up the sound when it finishes
            sound.once('complete', () => {
                sound.destroy();
            });
            
            console.log(`Playing ${soundKey} at distance ${Math.round(distance)} with volume ${volume.toFixed(2)} and pan ${pan.toFixed(2)}`);
        }
    }
  }