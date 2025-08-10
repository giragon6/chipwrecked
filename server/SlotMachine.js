class SlotMachine {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 40;
        this.inUse = false;
        this.symbols = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'];
        this.payouts = {
            '🍒': 20,
            '🍋': 30,
            '🔔': 50,
            '⭐': 100,
            '💎': 200,
            '7️⃣': 500
        };
    }

    spin() {
        // Generate three random symbols
        const symbols = [];
        for (let i = 0; i < 3; i++) {
            const randomIndex = Math.floor(Math.random() * this.symbols.length);
            symbols.push(this.symbols[randomIndex]);
        }

        // Check for win (all three symbols match)
        const win = symbols[0] === symbols[1] && symbols[1] === symbols[2];
        let winAmount = 0;

        if (win) {
            winAmount = this.payouts[symbols[0]] || 10;
        }

        return {
            symbols: symbols,
            win: win,
            winAmount: winAmount
        };
    }

    setInUse(inUse) {
        this.inUse = inUse;
    }

    isNearPlayer(playerX, playerY, distance = 60) {
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        return Math.sqrt(dx * dx + dy * dy) < distance;
    }
}

module.exports = SlotMachine;
