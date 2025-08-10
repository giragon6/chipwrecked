class CustomizationScreen {
    constructor() {
        this.selectedColor = 0x3498db;
        this.playerName = '';
        this.previewCanvas = null;
        this.previewContext = null;
        
        this.init();
    }

    init() {
        // Get DOM elements
        this.customizationScreen = document.getElementById('customization-screen');
        this.loadingScreen = document.getElementById('loading-screen');
        this.gameUI = document.getElementById('game-ui');
        this.playerNameInput = document.getElementById('player-name');
        this.colorOptions = document.querySelectorAll('.color-option');
        this.enterButton = document.getElementById('enter-casino-button');
        this.previewCanvas = document.getElementById('player-preview');
        this.previewContext = this.previewCanvas.getContext('2d');
        this.previewName = document.getElementById('preview-name');
        this.miniPlayerDisplay = document.getElementById('mini-player-display');
        this.playerNameDisplay = document.getElementById('player-name-display');

        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize preview
        this.updatePreview();
    }

    setupEventListeners() {
        // Color selection
        this.colorOptions.forEach(option => {
            option.addEventListener('click', () => {
                // Remove selected class from all options
                this.colorOptions.forEach(opt => opt.classList.remove('selected'));
                // Add selected class to clicked option
                option.classList.add('selected');
                
                // Update selected color
                this.selectedColor = parseInt(option.dataset.color);
                this.updatePreview();
            });
        });

        // Name input
        this.playerNameInput.addEventListener('input', (e) => {
            this.playerName = e.target.value.trim();
            this.updatePreview();
        });

        // Enter button
        this.enterButton.addEventListener('click', () => {
            this.enterCasino();
        });

        // Enter key on name input
        this.playerNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.enterCasino();
            }
        });
    }

    updatePreview() {
        const displayName = this.playerName || 'Player';
        this.previewName.textContent = displayName;
        
        // Draw player preview
        this.drawPlayerPreview(this.previewContext, 30, 30, this.selectedColor);
    }

    drawPlayerPreview(ctx, x, y, color) {
        ctx.clearRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
        
        // Convert hex color to RGB
        const r = (color >> 16) & 255;
        const g = (color >> 8) & 255;
        const b = color & 255;
        
        // Draw circle
        ctx.beginPath();
        ctx.arc(x, y, 15, 0, 2 * Math.PI);
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fill();
        
        // Draw border
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    enterCasino() {
        const finalName = this.playerName || 'Player';
        
        if (finalName.length === 0) {
            alert('Please enter a name!');
            return;
        }

        // Hide customization screen and show loading screen
        this.customizationScreen.style.display = 'none';
        this.loadingScreen.style.display = 'block';
        
        // Start loading process
        this.startLoading(finalName, this.selectedColor);
    }

    startLoading(playerName, playerColor) {
        const loadingStatus = document.getElementById('loading-status');
        const loadingProgress = document.querySelector('.loading-progress');
        
        const steps = [
            { text: 'Connecting to server...', progress: 20 },
            { text: 'Loading casino assets...', progress: 40 },
            { text: 'Preparing slot machines...', progress: 60 },
            { text: 'Setting up multiplayer...', progress: 80 },
            { text: 'Entering casino...', progress: 100 }
        ];
        
        let currentStep = 0;
        
        const updateStep = () => {
            if (currentStep < steps.length) {
                loadingStatus.textContent = steps[currentStep].text;
                loadingProgress.style.width = steps[currentStep].progress + '%';
                currentStep++;
                
                setTimeout(updateStep, 500);
            } else {
                // Loading complete, send customization to server
                this.completeCustomization(playerName, playerColor);
            }
        };
        
        updateStep();
    }

    completeCustomization(playerName, playerColor) {
        // Update mini player display
        const miniCtx = this.miniPlayerDisplay.getContext('2d');
        this.drawPlayerPreview(miniCtx, 15, 15, playerColor);
        this.playerNameDisplay.textContent = playerName;
        
        // Store player data for when the game is ready
        window.pendingPlayerData = {
            name: playerName,
            color: playerColor
        };
        
        // Initialize the game first, then send customization when ready
        window.initializeGame();
    }
}
