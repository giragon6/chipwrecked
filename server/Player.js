class Player {
    constructor(id, x, y, playerData = {}) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.name = playerData.name || `Player_${id.substring(0, 6)}`;
        this.color = playerData.color || 0x3498db;
        this.balance = 1000; // Starting balance
        this.speed = 200;
        this.radius = 15;
        this.lastShoveTime = 0; // Track shove cooldown
    }

    updatePosition(x, y) {
        this.x = x;
        this.y = y;
    }

    updatePlayerData(playerData) {
        if (playerData.name) {
            this.name = playerData.name;
        }
        if (playerData.color !== undefined) {
            this.color = playerData.color;
        }
    }

    addBalance(amount) {
        this.balance += amount;
    }

    deductBalance(amount) {
        if (this.balance >= amount) {
            this.balance -= amount;
            return true;
        }
        return false;
    }

    canAffordBet(betAmount) {
        return this.balance >= betAmount;
    }

    canShove() {
        const SHOVE_COOLDOWN = 3000; // 3 seconds
        return (Date.now() - this.lastShoveTime) >= SHOVE_COOLDOWN;
    }

    setShoveTime() {
        this.lastShoveTime = Date.now();
    }

    toJSON() {
        return {
            id: this.id,
            x: this.x,
            y: this.y,
            name: this.name,
            color: this.color,
            balance: this.balance
        };
    }
}

module.exports = Player;
