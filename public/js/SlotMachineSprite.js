class SlotMachineSprite extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, id, machineData = {}) {
        // Get tier information or default to basic
        const tier = machineData.tier || { name: 'Basic', color: 0x3498db, cost: 10 };
        const cost = machineData.cost || 10;
        
        // Create unique texture keys for different states
        const availableTextureKey = `slotmachine_available_${id}`;
        const inUseTextureKey = `slotmachine_inuse_${id}`;
        const spinningTextureKey = `slotmachine_spinning_${id}`;
        
        // Create textures with tier color if they don't exist
        if (!scene.textures.exists(availableTextureKey)) {
            SlotMachineSprite.createSlotMachineTexture(scene, availableTextureKey, tier.color); // Tier color
        }
        if (!scene.textures.exists(inUseTextureKey)) {
            SlotMachineSprite.createSlotMachineTexture(scene, inUseTextureKey, 0xf39c12); // Orange
        }
        if (!scene.textures.exists(spinningTextureKey)) {
            SlotMachineSprite.createSlotMachineTexture(scene, spinningTextureKey, 0xe74c3c); // Red for spinning
        }
        
        // Create sprite with available texture initially
        super(scene, x, y, availableTextureKey);
        
        this.scene = scene;
        this.slotMachineId = id;
        this.width = 40;
        this.height = 40;
        this.state = 'available'; // 'available', 'inUse', 'spinning', 'showingResult'
        this.tier = tier;
        this.cost = cost;
        this.availableTextureKey = availableTextureKey;
        this.inUseTextureKey = inUseTextureKey;
        this.spinningTextureKey = spinningTextureKey;
        
        // Animation and result properties
        this.isSpinning = false;
        this.spinAnimation = null;
        this.currentResult = null;
        this.spinSymbols = ['🎰', '🎲', '🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'];
        this.currentSymbolIndex = 0;
        
        // Add to scene and physics world
        scene.add.existing(this);
        scene.physics.add.existing(this, true); // true makes it a static body
        
        // Set physics body size
        this.body.setSize(this.width, this.height);
        
        // Set origin to center
        this.setOrigin(0.5, 0.5);
        
        // Make it interactive
        this.setInteractive();
        
        // Create spinning symbols display
        this.symbolsText = scene.add.text(this.x, this.y - 5, '', {
            fontSize: '10px',
            fill: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 1
        });
        this.symbolsText.setOrigin(0.5, 0.5);
        this.symbolsText.setVisible(false);
        
        // Create cost display
        this.costText = scene.add.text(this.x, this.y + 25, `$${this.cost}`, {
            fontSize: '12px',
            fill: '#f1c40f',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 2,
            fontWeight: 'bold'
        });
        this.costText.setOrigin(0.5, 0.5);
        
        // Create tier indicator
        this.tierText = scene.add.text(this.x, this.y - 25, tier.name, {
            fontSize: '8px',
            fill: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 1
        });
        this.tierText.setOrigin(0.5, 0.5);

        //idek dude
        this.setTexture(this.availableTextureKey);
        this.stopSpinAnimation();
        this.symbolsText.setVisible(false);
        this.currentResult = null;
    }

    static createSlotMachineTexture(scene, textureKey, bodyColor) {
        const size = 64; // Texture size
        const graphics = scene.add.graphics();
        
        // Draw slot machine body
        graphics.fillStyle(bodyColor);
        graphics.fillRect(12, 12, 40, 40);
        
        // Add border
        graphics.lineStyle(2, 0xffffff);
        graphics.strokeRect(12, 12, 40, 40);
        
        // Add slot machine details (screen area)
        graphics.fillStyle(0x2c3e50);
        graphics.fillRect(17, 17, 30, 20);
        
        // Add coins symbol
        graphics.fillStyle(0xf1c40f);
        graphics.fillCircle(24, 27, 3);
        graphics.fillCircle(32, 27, 3);
        graphics.fillCircle(40, 27, 3);
        
        // Add handle
        graphics.lineStyle(3, 0x95a5a6);
        graphics.beginPath();
        graphics.moveTo(52, 20);
        graphics.lineTo(52, 35);
        graphics.strokePath();
        
        // Add handle knob
        graphics.fillStyle(0x95a5a6);
        graphics.fillCircle(52, 35, 4);
        
        // Generate texture from graphics
        graphics.generateTexture(textureKey, size, size);
        
        // Clean up the graphics object
        graphics.destroy();
    }

    setState(newState, data = {}) {
        if (this.state === newState) return;
        
        this.state = newState;
        
        switch (newState) {
            case 'available':
                this.setTexture(this.availableTextureKey);
                this.stopSpinAnimation();
                this.symbolsText.setVisible(false);
                this.currentResult = null;
                break;
                
            case 'inUse':
                this.setTexture(this.inUseTextureKey);
                this.stopSpinAnimation();
                this.symbolsText.setVisible(false);
                break;
                
            case 'spinning':
                this.setTexture(this.spinningTextureKey);
                this.startSpinAnimation();
                break;
                
            case 'showingResult':
                this.setTexture(this.inUseTextureKey);
                this.stopSpinAnimation();
                this.showResult(data.result);
                break;
        }
    }

    startSpinAnimation() {
        if (this.isSpinning) return;
        
        this.isSpinning = true;
        this.symbolsText.setVisible(true);
        
        // Create spinning animation
        this.spinAnimation = this.scene.time.addEvent({
            delay: 100, // Change symbol every 100ms
            callback: () => {
                this.currentSymbolIndex = (this.currentSymbolIndex + 1) % this.spinSymbols.length;
                const symbols = `${this.spinSymbols[this.currentSymbolIndex]} ${this.spinSymbols[(this.currentSymbolIndex + 1) % this.spinSymbols.length]} ${this.spinSymbols[(this.currentSymbolIndex + 2) % this.spinSymbols.length]}`;
                this.symbolsText.setText(symbols);
            },
            loop: true
        });
        
        // Add pulsing effect
        this.scene.tweens.add({
            targets: this,
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 300,
            yoyo: true,
            repeat: -1
        });
    }

    stopSpinAnimation() {
        if (!this.isSpinning) return;
        
        this.isSpinning = false;
        
        if (this.spinAnimation) {
            this.spinAnimation.destroy();
            this.spinAnimation = null;
        }
        
        // Stop pulsing effect and preserve position
        this.scene.tweens.killTweensOf(this);
        
        // Store current position before resetting scale
        const currentX = this.x;
        const currentY = this.y;
        
        // Reset scale
        this.setScale(1, 1);
        
        // Restore position to prevent drift
        this.setPosition(currentX, currentY);
    }

    showResult(result) {
        if (result && result.symbols) {
            this.currentResult = result;
            this.symbolsText.setText(result.symbols.join(' '));
            this.symbolsText.setVisible(true);
            
            // Add win animation if player won
            if (result.win) {
                this.symbolsText.setStyle({ fill: '#f1c40f' }); // Gold color for wins
                this.scene.tweens.add({
                    targets: this.symbolsText,
                    scaleX: 1.3,
                    scaleY: 1.3,
                    duration: 200,
                    yoyo: true,
                    repeat: 2,
                    onComplete: () => {
                        this.symbolsText.setStyle({ fill: '#ffffff' });
                    }
                });
            }
        }
    }

    // Legacy method for backwards compatibility
    setInUse(inUse) {
        if (inUse) {
            this.setState('inUse');
        } else {
            this.setState('available');
        }
    }

    canInteract() {
        return this.state === 'available' || this.state === 'showingResult';
    }

    isNearPlayer(playerX, playerY, distance = 60) {
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        return Math.sqrt(dx * dx + dy * dy) < distance;
    }

    destroy() {
        this.stopSpinAnimation();
        
        if (this.symbolsText) {
            this.symbolsText.destroy();
        }
        
        if (this.costText) {
            this.costText.destroy();
        }
        
        if (this.tierText) {
            this.tierText.destroy();
        }
        
        // Clean up textures
        if (this.scene.textures.exists(this.availableTextureKey)) {
            this.scene.textures.remove(this.availableTextureKey);
        }
        if (this.scene.textures.exists(this.inUseTextureKey)) {
            this.scene.textures.remove(this.inUseTextureKey);
        }
        if (this.scene.textures.exists(this.spinningTextureKey)) {
            this.scene.textures.remove(this.spinningTextureKey);
        }
        
        super.destroy();
    }
}
