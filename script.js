const VALUES = [
    0.01, 1, 5, 10, 25, 50, 75, 100, 200, 300, 400, 500, 750, 
    1000, 5000, 10000, 25000, 50000, 75000, 100000, 200000, 300000, 400000, 500000, 750000, 1000000
];

const ROUNDS = [6, 5, 4, 3, 2, 1, 1, 1, 1];

// Audio Elements
const winSound = new Audio('https://www.myinstants.com/media/sounds/millionaire-correct.mp3');
const loseSound = new Audio('https://www.myinstants.com/media/sounds/wrong-answer-sound-effect.mp3');

// Preload and unlock audio on first click (Browser Autoplay Policy fix)
let audioUnlocked = false;
document.addEventListener('click', () => {
    if (!audioUnlocked) {
        winSound.play().then(() => { winSound.pause(); winSound.currentTime = 0; }).catch(() => {});
        loseSound.play().then(() => { loseSound.pause(); loseSound.currentTime = 0; }).catch(() => {});
        audioUnlocked = true;
    }
}, { once: true });

let gameState = {
    cases: [], // { id: 1..26, value: number, isOpened: boolean }
    playerCase: null,
    currentRound: 0,
    casesToOpenThisRound: 0,
    status: 'START', // START, CHOOSE_OWN_CASE, OPEN_CASES, BANKER_OFFER, GAME_OVER
    currentOffer: 0
};

// DOM Elements
const leftBoardEl = document.getElementById('left-board');
const rightBoardEl = document.getElementById('right-board');
const casesGridEl = document.getElementById('cases-grid');
const playerCaseContainerEl = document.getElementById('player-case-container');
const instructionBarEl = document.getElementById('instruction-bar');

const bankerModalEl = document.getElementById('banker-modal');
const bankerOfferValueEl = document.getElementById('banker-offer-value');
const btnDeal = document.getElementById('btn-deal');
const btnNoDeal = document.getElementById('btn-no-deal');

const gameOverModalEl = document.getElementById('game-over-modal');
const gameOverTitleEl = document.getElementById('game-over-title');
const gameOverMessageEl = document.getElementById('game-over-message');
const finalWinningsValueEl = document.getElementById('final-winnings-value');
const caseRevealMessageEl = document.getElementById('case-reveal-message');
const btnPlayAgain = document.getElementById('btn-play-again');

function formatMoney(amount) {
    return amount.toLocaleString('en-US', { minimumFractionDigits: amount < 1 ? 2 : 0, maximumFractionDigits: amount < 1 ? 2 : 0 });
}

function initGame() {
    // Shuffle values
    let shuffledValues = [...VALUES].sort(() => Math.random() - 0.5);
    
    gameState = {
        cases: Array.from({length: 26}, (_, i) => ({
            id: i + 1,
            value: shuffledValues[i],
            isOpened: false
        })),
        playerCase: null,
        currentRound: 0,
        casesToOpenThisRound: 0,
        status: 'CHOOSE_OWN_CASE',
        currentOffer: 0,
        openingCaseId: null,
        revealedCaseId: null
    };

    renderMoneyBoards();
    renderCases();
    renderPlayerCase();
    updateInstruction();
    
    bankerModalEl.classList.add('hidden');
    gameOverModalEl.classList.add('hidden');
}

function renderMoneyBoards() {
    leftBoardEl.innerHTML = '';
    rightBoardEl.innerHTML = '';

    const midPoint = 13;
    
    // Left board (Low values)
    VALUES.slice(0, midPoint).forEach(val => {
        const isOpened = gameState.cases.find(c => c.value === val && c.isOpened);
        const div = document.createElement('div');
        div.className = `money-value low ${isOpened ? 'eliminated' : ''}`;
        div.innerHTML = `<span>${formatMoney(val)}</span>`;
        leftBoardEl.appendChild(div);
    });

    // Right board (High values)
    VALUES.slice(midPoint).forEach(val => {
        const isOpened = gameState.cases.find(c => c.value === val && c.isOpened);
        const div = document.createElement('div');
        div.className = `money-value high ${isOpened ? 'eliminated' : ''}`;
        div.innerHTML = `<span>${formatMoney(val)}</span>`;
        rightBoardEl.appendChild(div);
    });
}

function renderCases() {
    casesGridEl.innerHTML = '';
    gameState.cases.forEach(c => {
        const div = document.createElement('div');
        div.className = 'briefcase';
        if (c.isOpened) div.classList.add('opened');
        if (gameState.playerCase && gameState.playerCase.id === c.id) div.classList.add('opened'); // Remove from grid if player owns it
        
        if (gameState.openingCaseId === c.id) {
            div.classList.add('opening');
        } else if (gameState.revealedCaseId === c.id) {
            div.classList.add('revealed');
            if (c.value >= 100000) {
                div.classList.add('revealed-high');
            } else {
                div.classList.add('revealed-low');
            }
        }
        
        if (gameState.revealedCaseId === c.id) {
            div.innerHTML = `<span>$${formatMoney(c.value)}</span>`;
        } else {
            div.textContent = c.id;
        }
        
        div.addEventListener('click', () => handleCaseClick(c));
        
        casesGridEl.appendChild(div);
    });
}

function renderPlayerCase() {
    if (gameState.playerCase) {
        playerCaseContainerEl.innerHTML = `<div class="briefcase player-owned">${gameState.playerCase.id}</div>`;
        playerCaseContainerEl.classList.remove('empty');
    } else {
        playerCaseContainerEl.innerHTML = `<div class="case-placeholder">?</div>`;
        playerCaseContainerEl.classList.add('empty');
    }
}

function updateInstruction() {
    if (gameState.status === 'CHOOSE_OWN_CASE') {
        instructionBarEl.textContent = 'Welcome! Choose your lucky case to start.';
    } else if (gameState.status === 'OPEN_CASES') {
        instructionBarEl.textContent = `Round ${gameState.currentRound + 1}: Open ${gameState.casesToOpenThisRound} more case${gameState.casesToOpenThisRound > 1 ? 's' : ''}.`;
    } else if (gameState.status === 'BANKER_OFFER') {
        instructionBarEl.textContent = 'The Banker is calling...';
    } else if (gameState.status === 'GAME_OVER') {
        instructionBarEl.textContent = 'Game Over!';
    }
}

function handleCaseClick(clickedCase) {
    if (clickedCase.isOpened) return;

    if (gameState.status === 'CHOOSE_OWN_CASE') {
        gameState.status = 'ANIMATING_CHOICE';
        gameState.openingCaseId = clickedCase.id;
        instructionBarEl.textContent = `You chose Case ${clickedCase.id}!`;
        renderCases();
        
        setTimeout(() => {
            gameState.openingCaseId = null;
            gameState.playerCase = clickedCase;
            gameState.status = 'OPEN_CASES';
            gameState.casesToOpenThisRound = ROUNDS[gameState.currentRound];
            renderPlayerCase();
            renderCases();
            updateInstruction();
        }, 1000);
    } else if (gameState.status === 'OPEN_CASES') {
        if (gameState.playerCase && gameState.playerCase.id === clickedCase.id) return; // Cannot open own case
        
        gameState.status = 'OPENING_CASE';
        gameState.openingCaseId = clickedCase.id;
        
        instructionBarEl.textContent = `Opening Case ${clickedCase.id}...`;
        renderCases();
        
        // Suspense delay
        setTimeout(() => {
            gameState.openingCaseId = null;
            gameState.revealedCaseId = clickedCase.id;
            
            // Show dramatic message based on value
            if (clickedCase.value >= 100000) {
                instructionBarEl.textContent = `Oh no! $${formatMoney(clickedCase.value)}!`;
                loseSound.currentTime = 0;
                loseSound.play().catch(e => console.log('Audio play failed:', e));
            } else {
                instructionBarEl.textContent = `Phew! Only $${formatMoney(clickedCase.value)}.`;
                winSound.currentTime = 0;
                winSound.play().catch(e => console.log('Audio play failed:', e));
            }
            
            renderCases();
            
            // Wait to let user read the value before removing it
            setTimeout(() => {
                clickedCase.isOpened = true;
                gameState.revealedCaseId = null;
                gameState.casesToOpenThisRound--;
                
                renderMoneyBoards();
                renderCases();
                
                if (gameState.casesToOpenThisRound === 0) {
                    triggerBanker();
                } else {
                    gameState.status = 'OPEN_CASES';
                    updateInstruction();
                }
            }, 1800);
        }, 1500);
    }
}

function triggerBanker() {
    gameState.status = 'BANKER_OFFER';
    updateInstruction();
    
    // Calculate Offer
    const remainingCases = gameState.cases.filter(c => !c.isOpened && c.id !== gameState.playerCase.id);
    remainingCases.push(gameState.playerCase); // Include player's case in calculation
    
    const sum = remainingCases.reduce((acc, c) => acc + c.value, 0);
    const expectedValue = sum / remainingCases.length;
    
    // Banker typically offers less than EV early on, increasing towards EV later
    // Round 0 = ~30% of EV, Round 8 = ~80-90% of EV
    const roundFactor = 0.3 + (gameState.currentRound * 0.08); 
    let offer = expectedValue * roundFactor;
    
    // Round to nearest 10 or 100 for cleaner numbers
    if (offer > 1000) {
        offer = Math.round(offer / 100) * 100;
    } else {
        offer = Math.round(offer / 10) * 10;
    }
    
    gameState.currentOffer = offer;
    
    bankerOfferValueEl.textContent = `$${formatMoney(offer)}`;
    setTimeout(() => {
        bankerModalEl.classList.remove('hidden');
    }, 1000); // Slight delay for dramatic effect
}

btnDeal.addEventListener('click', () => {
    bankerModalEl.classList.add('hidden');
    endGame(true);
});

btnNoDeal.addEventListener('click', () => {
    bankerModalEl.classList.add('hidden');
    gameState.currentRound++;
    
    if (gameState.currentRound >= ROUNDS.length) {
        // Last round, only 2 cases left. (Player's and 1 other). Player says No Deal -> Wins their own case
        endGame(false);
    } else {
        gameState.status = 'OPEN_CASES';
        gameState.casesToOpenThisRound = ROUNDS[gameState.currentRound];
        updateInstruction();
    }
});

function endGame(acceptedDeal) {
    gameState.status = 'GAME_OVER';
    updateInstruction();
    
    const winnings = acceptedDeal ? gameState.currentOffer : gameState.playerCase.value;
    
    if (acceptedDeal) {
        gameOverTitleEl.textContent = "DEAL!";
        gameOverMessageEl.textContent = "You accepted the banker's offer of";
        caseRevealMessageEl.textContent = `Your case (${gameState.playerCase.id}) contained $${formatMoney(gameState.playerCase.value)}. You ${winnings >= gameState.playerCase.value ? 'made a great deal!' : 'should have held on!'}`;
    } else {
        gameOverTitleEl.textContent = "NO DEAL!";
        gameOverMessageEl.textContent = "You kept your case and won";
        caseRevealMessageEl.textContent = "";
    }
    
    finalWinningsValueEl.textContent = `$${formatMoney(winnings)}`;
    
    setTimeout(() => {
        gameOverModalEl.classList.remove('hidden');
    }, 500);
}

btnPlayAgain.addEventListener('click', () => {
    initGame();
});

// Start game
initGame();
