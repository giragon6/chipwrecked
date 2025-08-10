class PlayerSprite extends Phaser.GameObjects.Graphics {
    constructor(scene, x, y, playerId, isCurrentPlayer = false, playerData = {}) {
        super(scene);
        
        this.scene = scene;
        this.playerId = playerId;
        this.isCurrentPlayer = isCurrentPlayer;
        this.radius = 15;
        this.playerName = playerData.name || (isCurrentPlayer ? 'You' : playerId.substring(0, 8));
        this.playerColor = playerData.color || (isCurrentPlayer ? 0x3498db : 0xe74c3c);
        
        this.setPosition(x, y);
        this.draw();
        
        scene.add.existing(this);
        
        // Add name label
        this.nameText = scene.add.text(x, y - 30, this.playerName, {
            fontSize: '12px',
            fill: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 2
        });
        this.nameText.setOrigin(0.5, 0.5);
    }

    draw() {
        this.clear();
        
        // Draw circle with custom color
        this.fillStyle(this.playerColor);
        this.fillCircle(0, 0, this.radius);
        
        // Add border
        this.lineStyle(2, 0xffffff);
        this.strokeCircle(0, 0, this.radius);
    }

    updatePosition(x, y) {
        this.setPosition(x, y);
        this.nameText.setPosition(x, y - 30);
    }

    updatePlayerData(playerData) {
        if (playerData.name) {
            this.playerName = playerData.name;
            this.nameText.setText(this.playerName);
        }
        if (playerData.color) {
            this.playerColor = playerData.color;
            this.draw();
        }
    }

    destroy() {
        if (this.nameText) {
            this.nameText.destroy();
        }
        super.destroy();
    }
}
