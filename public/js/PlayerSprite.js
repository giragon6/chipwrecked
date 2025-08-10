class PlayerSprite extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, playerId, isCurrentPlayer = false, playerData = {}) {
        // Create a unique texture key for this player
        const textureKey = `player_${playerId}`;
        
        // Create the texture if it doesn't exist
        if (!scene.textures.exists(textureKey)) {
            PlayerSprite.createPlayerTexture(scene, textureKey, playerData.color || (isCurrentPlayer ? 0x3498db : 0xe74c3c));
        }
        
        // Create sprite with the generated texture
        super(scene, x, y, textureKey);
        
        this.scene = scene;
        this.playerId = playerId;
        this.isCurrentPlayer = isCurrentPlayer;
        this.radius = 15;
        this.playerName = playerData.name || (isCurrentPlayer ? 'You' : playerId.substring(0, 8));
        this.playerColor = playerData.color || (isCurrentPlayer ? 0x3498db : 0xe74c3c);
        this.textureKey = textureKey;
        this.playerBalance = playerData.balance || 1000;
        
        // Add to scene and physics world
        scene.add.existing(this);
        scene.physics.add.existing(this);
        
        // Set physics body to be a circle
        this.body.setCircle(this.radius);
        
        // Set origin to center
        this.setOrigin(0.5, 0.5);
        
        // Add name label
        this.nameText = scene.add.text(x, y - 35, this.playerName, {
            fontSize: '12px',
            fill: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 2
        });
        this.nameText.setOrigin(0.5, 0.5);
        
        // Add balance label
        this.balanceText = scene.add.text(x, y - 22, `$${this.playerBalance}`, {
            fontSize: '10px',
            fill: '#f1c40f',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 2
        });
        this.balanceText.setOrigin(0.5, 0.5);
    }

    static createPlayerTexture(scene, textureKey, color) {
        const size = 32; // Texture size (should be power of 2)
        const graphics = scene.add.graphics();
        
        // Convert hex color to RGB components
        const r = (color >> 16) & 255;
        const g = (color >> 8) & 255;
        const b = color & 255;
        
        // Draw circle
        graphics.fillStyle(color);
        graphics.fillCircle(size/2, size/2, 15);
        
        // Add border
        graphics.lineStyle(2, 0xffffff);
        graphics.strokeCircle(size/2, size/2, 15);
        
        // Generate texture from graphics
        graphics.generateTexture(textureKey, size, size);
        
        // Clean up the graphics object
        graphics.destroy();
    }

    updatePosition(x, y) {
        this.setPosition(x, y);
        this.nameText.setPosition(x, y - 35);
        this.balanceText.setPosition(x, y - 22);
    }

    updatePlayerData(playerData) {
        if (playerData.name) {
            this.playerName = playerData.name;
            this.nameText.setText(this.playerName);
        }
        if (playerData.color && playerData.color !== this.playerColor) {
            this.playerColor = playerData.color;
            // Recreate texture with new color
            PlayerSprite.createPlayerTexture(this.scene, this.textureKey, this.playerColor);
            this.setTexture(this.textureKey);
        }
        if (playerData.balance !== undefined) {
            this.playerBalance = playerData.balance;
            this.balanceText.setText(`$${this.playerBalance}`);
        }
    }

    // Override the update method to keep name text in sync
    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        if (this.nameText) {
            this.nameText.setPosition(this.x, this.y - 35);
        }
        if (this.balanceText) {
            this.balanceText.setPosition(this.x, this.y - 22);
        }
    }

    destroy() {
        if (this.nameText) {
            this.nameText.destroy();
        }
        if (this.balanceText) {
            this.balanceText.destroy();
        }
        // Clean up the texture
        if (this.scene.textures.exists(this.textureKey)) {
            this.scene.textures.remove(this.textureKey);
        }
        super.destroy();
    }
}
