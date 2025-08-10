// Initialize Socket.io
const socket = io();
window.gameSocket = socket;

let game = null;
let gameScene = null;
let isGameReady = false;

// Initialize customization screen
const customizationScreen = new CustomizationScreen();

// Phaser game configuration
const config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.RESIZE,
        parent: 'game-canvas',
        width: '100%',
        height: '100%',
        min: {
            width: 300,
            height: 200
        },
        max: {
            width: 1600,
            height: 1200
        }
    },
    backgroundColor: '#2c3e50',
    scene: GameScene,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    }
};

// Function to initialize the game (called after customization)
window.initializeGame = function() {
    // Create the game
    game = new Phaser.Game(config);
    
    // Wait for the game scene to be ready
    game.events.on('ready', () => {
        console.log('Phaser game is ready');
        gameScene = game.scene.getScene('GameScene');
        
        // Pass socket to the game scene
        gameScene.initialize(socket);
        
        // Wait a bit more to ensure scene is fully loaded
        setTimeout(() => {
            isGameReady = true;
            console.log('Game scene is ready, sending player customization');
            
            // Now send customization data
            if (window.pendingPlayerData) {
                socket.emit('playerCustomization', window.pendingPlayerData);
            }
        }, 500);
    });
};

// Function to show the game (called when everything is loaded)
window.showGame = function() {
    const loadingScreen = document.getElementById('loading-screen');
    const gameUI = document.getElementById('game-ui');
    
    setTimeout(() => {
        loadingScreen.style.display = 'none';
        gameUI.style.display = 'block';
        console.log('Game UI is now visible');
    }, 800); // Small delay to ensure smooth transition
};

// Handle connection status
const connectionStatus = document.getElementById('connection-status');

socket.on('connect', () => {
    console.log('Connected to server');
    connectionStatus.textContent = 'Connected';
    connectionStatus.classList.remove('disconnected');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    connectionStatus.textContent = 'Disconnected';
    connectionStatus.classList.add('disconnected');
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    connectionStatus.textContent = 'Connection Error';
    connectionStatus.classList.add('disconnected');
});

// Handle window resize
function resizeGame() {
    if (game && game.scale) {
        const gameContainer = document.getElementById('game-container');
        const containerRect = gameContainer.getBoundingClientRect();
        
        // Calculate available space for game canvas
        const availableWidth = containerRect.width - 40; // Account for padding
        const availableHeight = containerRect.height - 40;
        
        // Maintain aspect ratio but fit in container
        const targetWidth = Math.min(800, availableWidth);
        const targetHeight = Math.min(600, availableHeight);
        
        game.scale.setGameSize(targetWidth, targetHeight);
        
        // Update camera bounds
        if (gameScene && gameScene.cameras) {
            gameScene.cameras.main.setViewport(0, 0, targetWidth, targetHeight);
        }
    }
}

window.addEventListener('resize', resizeGame);
window.addEventListener('orientationchange', () => {
    setTimeout(resizeGame, 100);
});

// Touch controls for mobile
document.addEventListener('DOMContentLoaded', () => {
    const touchButtons = {
        up: document.getElementById('move-up-btn'),
        down: document.getElementById('move-down-btn'),
        left: document.getElementById('move-left-btn'),
        right: document.getElementById('move-right-btn'),
        shove: document.getElementById('shove-button')
    };

    // Touch movement state
    let touchMovement = {
        up: false,
        down: false,
        left: false,
        right: false
    };

    // Set up touch controls
    Object.keys(touchButtons).forEach(direction => {
        const button = touchButtons[direction];
        if (!button) return;

        if (direction === 'shove') {
            // Shove button
            button.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (gameScene && gameScene.attemptShove) {
                    gameScene.attemptShove();
                }
            });
        } else {
            // Movement buttons
            button.addEventListener('touchstart', (e) => {
                e.preventDefault();
                touchMovement[direction] = true;
                updateTouchMovement();
            });

            button.addEventListener('touchend', (e) => {
                e.preventDefault();
                touchMovement[direction] = false;
                updateTouchMovement();
            });

            button.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                touchMovement[direction] = false;
                updateTouchMovement();
            });
        }
    });

    function updateTouchMovement() {
        if (!gameScene || !gameScene.currentPlayer) return;

        let velocityX = 0;
        let velocityY = 0;
        const speed = 200;

        if (touchMovement.left) velocityX = -speed;
        if (touchMovement.right) velocityX = speed;
        if (touchMovement.up) velocityY = -speed;
        if (touchMovement.down) velocityY = speed;

        // Apply movement
        gameScene.currentPlayer.body.setVelocity(velocityX, velocityY);

        // Send to server if moving
        if ((velocityX !== 0 || velocityY !== 0) && gameScene.socket) {
            gameScene.socket.emit('playerMove', {
                x: gameScene.currentPlayer.x,
                y: gameScene.currentPlayer.y
            });
        }
    }

    // Expose touch movement for GameScene
    window.touchMovement = touchMovement;
    window.updateTouchMovement = updateTouchMovement;
});
