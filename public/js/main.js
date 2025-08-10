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
    width: 800,
    height: 600,
    parent: 'game-canvas',
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
window.addEventListener('resize', () => {
    if (game) {
        game.scale.resize(800, 600);
    }
});
