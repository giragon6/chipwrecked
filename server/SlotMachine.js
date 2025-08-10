class SlotMachine {
    constructor(id, x, y) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 40;
        this.state = 'available'; // 'available', 'inUse', 'spinning', 'showingResult'
        
        // Randomize machine tier and properties
        this.tier = this.generateMachineTier();
        this.cost = this.tier.cost;
        this.multiplier = this.tier.multiplier;
        this.rareBonusChance = this.tier.rareBonusChance;
        
        this.symbols = ['🍒', '🍋', '🔔', '⭐', '💎', '7️⃣'];
        this.basePayouts = {
            '🍒': 20,
            '🍋': 30,
            '🔔': 50,
            '⭐': 100,
            '💎': 200,
            '7️⃣': 500
        };
        
        // Calculate actual payouts based on tier multiplier
        this.payouts = {};
        Object.keys(this.basePayouts).forEach(symbol => {
            this.payouts[symbol] = Math.round(this.basePayouts[symbol] * this.multiplier);
        });
        
        // Spinning state management
        this.currentSpinner = null; // Player ID who initiated the spin
        this.pendingResult = null;
        this.spinStartTime = null;
        this.spinTimeout = null;
        this.onSpinCompleteCallback = null; // Callback for when spin completes
    }

    generateMachineTier() {
        const random = Math.random();
        
        if (random < 0.5) { // 50% chance - Basic machines
            return {
                name: 'Basic',
                cost: 10,
                multiplier: 1.0,
                rareBonusChance: 0.05,
                color: 0x3498db // Blue
            };
        } else if (random < 0.8) { // 30% chance - Premium machines
            return {
                name: 'Premium',
                cost: 25,
                multiplier: 1.8,
                rareBonusChance: 0.1,
                color: 0x9b59b6 // Purple
            };
        } else if (random < 0.95) { // 15% chance - Gold machines
            return {
                name: 'Gold',
                cost: 50,
                multiplier: 2.5,
                rareBonusChance: 0.15,
                color: 0xf1c40f // Gold
            };
        } else { // 5% chance - Diamond machines
            return {
                name: 'Diamond',
                cost: 100,
                multiplier: 4.0,
                rareBonusChance: 0.25,
                color: 0x1abc9c // Teal/Diamond
            };
        }
    }

    startSpin(playerId) {
        if (this.state !== 'available' && this.state !== 'showingResult') {
            return null;
        }

        this.state = 'spinning';
        this.currentSpinner = playerId;
        this.spinStartTime = Date.now();
        
        // Generate the result immediately but don't reveal it for 2 seconds
        this.pendingResult = this.generateSpinResult();
        
        // Set timeout to complete spin after 2 seconds
        this.spinTimeout = setTimeout(() => {
            const result = this.completeSpin();
            if (result && this.onSpinCompleteCallback) {
                this.onSpinCompleteCallback(this.id, result);
            }
        }, 5000);

        return {
            success: true,
            spinning: true,
            spinId: `${this.id}_${this.spinStartTime}`
        };
    }

    generateSpinResult() {
        // Generate three random symbols
        const symbols = [];
        for (let i = 0; i < 3; i++) {
            const randomIndex = Math.floor(Math.random() * this.symbols.length);
            symbols.push(this.symbols[randomIndex]);
        }

        // Check for win
        const match1 = symbols[0] === symbols[1];
        const match2 = symbols[1] === symbols[2];
        const match3 = symbols[0] === symbols[2];
        let winAmount = 0;

        if (match1 && match2 && match3) {
            winAmount = this.payouts[symbols[0]] || 10;
            
            // Apply rare bonus chance for higher-tier machines
            if (Math.random() < this.rareBonusChance) {
                winAmount *= 2; // Double the winnings for rare bonus
            }
        } else if (match1 || match2 || match3) {
          winAmount = this.payouts[symbols[0]] || 10 * 0.001;
            
          // Apply rare bonus chance for higher-tier machines
          if (Math.random() < this.rareBonusChance) {
              winAmount *= 2; // Double the winnings for rare bonus
          }
        }

        return {
            symbols: symbols,
            win: match1 || match2 || match3,
            winAmount: winAmount,
            tier: this.tier.name,
            cost: this.cost
        };
    }

    completeSpin() {
        if (this.state !== 'spinning' || !this.pendingResult) {
            return null;
        }

        this.state = 'showingResult';
        
        // Clear timeout if it exists
        if (this.spinTimeout) {
            clearTimeout(this.spinTimeout);
            this.spinTimeout = null;
        }

        const result = this.pendingResult;
        return result;
    }

    claimResult(playerId) {
        if (this.state !== 'showingResult' || !this.pendingResult) {
            return null;
        }

        const result = this.pendingResult;
        
        // Reset machine to available state
        this.reset();
        
        return {
            success: true,
            ...result,
            claimedBy: playerId
        };
    }

    reset() {
        this.state = 'available';
        this.currentSpinner = null;
        this.pendingResult = null;
        this.spinStartTime = null;
        
        if (this.spinTimeout) {
            clearTimeout(this.spinTimeout);
            this.spinTimeout = null;
        }
    }

    // Legacy methods for backwards compatibility
    spin() {
        return this.generateSpinResult();
    }

    setInUse(inUse) {
        if (inUse && this.state === 'available') {
            this.state = 'inUse';
        } else if (!inUse && this.state === 'inUse') {
            this.state = 'available';
        }
    }

    get inUse() {
        return this.state !== 'available';
    }

    canInteract() {
        return this.state === 'available' || this.state === 'showingResult';
    }

    getState() {
        const result = {
            id: this.id,
            x: this.x,
            y: this.y,
            state: this.state,
            inUse: this.inUse,
            currentSpinner: this.currentSpinner,
            pendingResult: this.state === 'showingResult' ? this.pendingResult : null,
            tier: this.tier,
            cost: this.cost,
            payouts: this.payouts
        };
        
        // If machine is spinning, check if it should be completed
        if (this.state === 'spinning' && this.spinStartTime) {
            const timeElapsed = Date.now() - this.spinStartTime;
            if (timeElapsed >= 5000) {
                // Spin should be complete, update state
                const completedResult = this.completeSpin();
                result.state = 'showingResult';
                result.pendingResult = this.pendingResult;
                
                // Notify callback if this was an auto-completion
                if (completedResult && this.onSpinCompleteCallback) {
                    // Use setTimeout to avoid blocking the getState call
                    setTimeout(() => {
                        this.onSpinCompleteCallback(this.id, completedResult);
                    }, 0);
                }
            }
        }
        
        return result;
    }

    isNearPlayer(playerX, playerY, distance = 60) {
        const dx = playerX - this.x;
        const dy = playerY - this.y;
        return Math.sqrt(dx * dx + dy * dy) < distance;
    }

    setSpinCompleteCallback(callback) {
        this.onSpinCompleteCallback = callback;
    }
}

module.exports = SlotMachine;
