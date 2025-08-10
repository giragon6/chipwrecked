class SlotMachineSprite extends Phaser.GameObjects.Graphics {
    constructor(scene, x, y, id) {
        super(scene);
        
        this.scene = scene;
        this.slotMachineId = id;
        this.width = 40;
        this.height = 40;
        this.inUse = false;
        
        this.setPosition(x, y);
        this.draw();
        
        scene.add.existing(this);
        
        // Make it interactive
        this.setInteractive(new Phaser.Geom.Rectangle(-this.width/2, -this.height/2, this.width, this.height), Phaser.Geom.Rectangle.Contains);
    }

    draw() {
        this.clear();
        
        // Draw slot machine body
        if (this.inUse) {
            this.fillStyle(0xf39c12); // Orange when in use
        } else {
            this.fillStyle(0x27ae60); // Green when available
        }
        
        this.fillRect(-this.width/2, -this.height/2, this.width, this.height);
        
        // Add border
        this.lineStyle(2, 0xffffff);
        this.strokeRect(-this.width/2, -this.height/2, this.width, this.height);
        
        // Add slot machine details
        this.fillStyle(0x2c3e50);
        this.fillRect(-15, -15, 30, 20);
        
        // Add coins symbol
        this.fillStyle(0xf1c40f);
        this.fillCircle(-8, -5, 3);
        this.fillCircle(0, -5, 3);
        this.fillCircle(8, -5, 3);
    }

    setInUse(inUse) {
        this.inUse = inUse;
        this.draw();
    }

    isNearPlayer(playerX, playerY, distance = 60) {
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        return Math.sqrt(dx * dx + dy * dy) < distance;
    }
}
