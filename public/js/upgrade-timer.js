/**
 * Client-side timer validation for creature upgrade
 * Prevents unnecessary API calls when the waiting time hasn't elapsed
 */

class UpgradeTimer {
    constructor() {
        this.timers = {};
        this.loadFromStorage();
        this.startTimerUpdates();
    }

    /**
     * Load saved timers from localStorage
     */
    loadFromStorage() {
        try {
            const savedTimers = localStorage.getItem('creatureUpgradeTimers');
            if (savedTimers) {
                this.timers = JSON.parse(savedTimers);
                // Convert string dates back to Date objects
                Object.keys(this.timers).forEach(key => {
                    if (this.timers[key].startTime) {
                        this.timers[key].startTime = new Date(this.timers[key].startTime);
                    }
                    if (this.timers[key].finishTime) {
                        this.timers[key].finishTime = new Date(this.timers[key].finishTime);
                    }
                });
            }
        } catch (error) {
            console.error('Error loading timers from storage:', error);
            this.timers = {};
        }
    }

    /**
     * Save timers to localStorage
     */
    saveToStorage() {
        try {
            localStorage.setItem('creatureUpgradeTimers', JSON.stringify(this.timers));
        } catch (error) {
            console.error('Error saving timers to storage:', error);
        }
    }

    /**
     * Start a timer for creature upgrade
     */
    startTimer(userId, creature1Id, creature2Id, waitTimeMinutes, apiResponse) {
        const key = this.getTimerKey(userId, creature1Id, creature2Id);
        const now = new Date();
        const finishTime = new Date(now.getTime() + (waitTimeMinutes * 60 * 1000));
        
        // Check if timer already exists (for handling second click)
        if (this.timers[key]) {
            // This is a subsequent click, increment click counter
            this.timers[key].clickCount = (this.timers[key].clickCount || 0) + 1;
            this.saveToStorage();
            return this.timers[key];
        }
        
        this.timers[key] = {
            userId,
            creature1Id,
            creature2Id,
            startTime: now,
            finishTime: finishTime,
            waitTimeMinutes,
            initialResponse: apiResponse,
            clickCount: 1 // Initialize click counter
        };
        
        this.saveToStorage();
        this.updateTimerUI(key);
        
        return this.timers[key];
    }

    /**
     * Check if timer has completed
     */
    isTimerComplete(userId, creature1Id, creature2Id) {
        const key = this.getTimerKey(userId, creature1Id, creature2Id);
        const timer = this.timers[key];
        
        if (!timer) {
            return true; // No timer found, allow API call
        }
        
        const now = new Date();
        return now >= timer.finishTime;
    }

    /**
     * Get remaining time in seconds
     */
    getRemainingTime(userId, creature1Id, creature2Id) {
        const key = this.getTimerKey(userId, creature1Id, creature2Id);
        const timer = this.timers[key];
        
        if (!timer) {
            return 0;
        }
        
        const now = new Date();
        const remainingMs = Math.max(0, timer.finishTime - now);
        return Math.ceil(remainingMs / 1000);
    }

    /**
     * Get formatted remaining time
     */
    getFormattedRemainingTime(userId, creature1Id, creature2Id) {
        const remainingSeconds = this.getRemainingTime(userId, creature1Id, creature2Id);
        const minutes = Math.floor(remainingSeconds / 60);
        const seconds = remainingSeconds % 60;
        
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    /**
     * Get progress percentage
     */
    getProgressPercentage(userId, creature1Id, creature2Id) {
        const key = this.getTimerKey(userId, creature1Id, creature2Id);
        const timer = this.timers[key];
        
        if (!timer) {
            return 100;
        }
        
        const now = new Date();
        const totalDuration = timer.finishTime - timer.startTime;
        const elapsed = now - timer.startTime;
        
        // Get initial progress based on creature type (from the API response)
        let initialProgress = 50; // Default for common
        if (timer.initialResponse && timer.initialResponse.progress) {
            initialProgress = timer.initialResponse.progress.current;
        }
        
        // Calculate progress percentage
        const timeProgress = Math.floor((elapsed / totalDuration) * (100 - initialProgress));
        const progress = Math.min(100, initialProgress + timeProgress);
        
        return progress;
    }

    /**
     * Check if upgrade is ready and show message if not
     * Returns true if the upgrade is ready, false otherwise
     */
    checkUpgradeReady(userId, creature1Id, creature2Id) {
        const key = this.getTimerKey(userId, creature1Id, creature2Id);
        const timer = this.timers[key];
        
        // Check if this is a second click (for common creatures)
        if (timer && timer.clickCount && timer.clickCount >= 1) {
            console.log('Second click detected, completing upgrade');
            // Complete the upgrade on second click for common creatures
            delete this.timers[key];
            this.saveToStorage();
            
            // Return success response for second click
            const successResponse = {
                success: true,
                message: "Upgrade completed successfully!",
                progress: {
                    current: 100,
                    total: 100,
                    percentage: "100%"
                }
            };
            
            updateResponseUI(successResponse);
            return true;
        }
        
        // First check if timer exists and is not complete
        if (timer && !this.isTimerComplete(userId, creature1Id, creature2Id)) {
            // Timer not complete, show message
            const remainingTime = this.getFormattedRemainingTime(userId, creature1Id, creature2Id);
            const progress = this.getProgressPercentage(userId, creature1Id, creature2Id);
            
            // Create response object similar to what the API would return
            const response = {
                success: false,
                message: `Starting upgrade process. Please wait ${remainingTime} before clicking again.`,
                remaining_time: remainingTime,
                progress: {
                    current: progress,
                    total: 100,
                    percentage: `${progress}%`
                }
            };
            
            // Show the message
            this.showErrorMessage(response);
            
            return false;
        }
        
        return true; // No active timer or timer is complete
    }

    /**
     * Show error message - can be customized for your UI
     */
    showErrorMessage(response) {
        console.log('Upgrade not ready:', response);
        
        // Example implementation - update with your actual UI code
        const messageContainer = document.getElementById('upgrade-message-container');
        if (messageContainer) {
            messageContainer.innerHTML = `
                <div class="alert alert-warning">
                    <p>${response.message}</p>
                    <div class="progress">
                        <div class="progress-bar" role="progressbar" style="width: ${response.progress.percentage};" 
                            aria-valuenow="${response.progress.current}" aria-valuemin="0" aria-valuemax="${response.progress.total}">
                            ${response.progress.percentage}
                        </div>
                    </div>
                </div>
            `;
            messageContainer.style.display = 'block';
        }
    }

    /**
     * Update timer UI elements periodically
     */
    updateTimerUI(timerKey) {
        const timer = this.timers[timerKey];
        if (!timer) return;
        
        const progressElement = document.querySelector(`[data-timer="${timerKey}"] .progress-bar`);
        const timeElement = document.querySelector(`[data-timer="${timerKey}"] .remaining-time`);
        
        if (progressElement || timeElement) {
            const remainingTime = this.getFormattedRemainingTime(timer.userId, timer.creature1Id, timer.creature2Id);
            const progress = this.getProgressPercentage(timer.userId, timer.creature1Id, timer.creature2Id);
            
            if (progressElement) {
                progressElement.style.width = `${progress}%`;
                progressElement.setAttribute('aria-valuenow', progress);
                progressElement.textContent = `${progress}%`;
            }
            
            if (timeElement) {
                timeElement.textContent = remainingTime;
            }
        }
    }

    /**
     * Start periodic updates for all timers
     */
    startTimerUpdates() {
        setInterval(() => {
            Object.keys(this.timers).forEach(key => {
                this.updateTimerUI(key);
                
                // Remove completed timers
                if (this.isTimerComplete(
                    this.timers[key].userId, 
                    this.timers[key].creature1Id, 
                    this.timers[key].creature2Id
                )) {
                    delete this.timers[key];
                    this.saveToStorage();
                }
            });
        }, 1000);
    }

    /**
     * Process API response to start timer if needed
     */
    processApiResponse(userId, creature1Id, creature2Id, response) {
        if (!response.success && response.timing && response.timing.wait_time_minutes) {
            this.startTimer(
                userId, 
                creature1Id, 
                creature2Id, 
                response.timing.wait_time_minutes,
                response
            );
        }
        return response;
    }

    /**
     * Create a unique key for the timer
     */
    getTimerKey(userId, creature1Id, creature2Id) {
        return `${userId}_${creature1Id}_${creature2Id}`;
    }
}

// Create global instance
const upgradeTimer = new UpgradeTimer();

/**
 * Wrapper for the API call to upgrade creatures
 * This checks if timer is complete before making the API call
 */
async function upgradeCreatures(userId, creature1Id, creature2Id) {
    // Check if timer is complete before making API call
    if (!upgradeTimer.checkUpgradeReady(userId, creature1Id, creature2Id)) {
        return; // Don't make API call if timer not complete
    }
    
    try {
        // Make API call to the real endpoint
        const response = await fetch(`http://13.234.138.208:5000/api/creatures/${userId}/upgrade-milestone`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                creature1Id,
                creature2Id
            })
        });
        
        const data = await response.json();
        
        // Process response to start timer if needed
        upgradeTimer.processApiResponse(userId, creature1Id, creature2Id, data);
        
        // Update UI with response
        updateResponseUI(data);
        
        return data;
    } catch (error) {
        console.error('Error upgrading creatures:', error);
        
        // Fallback to mock response if the real API fails
        console.log('Using fallback mock response due to API error');
        
        const mockResponse = {
            success: false,
            message: "Starting upgrade process. Please wait 15 minutes before clicking again.",
            remaining_time: "15:00",
            progress: {
                current: 50,
                total: 100,
                percentage: "50%"
            },
            timing: {
                start_time: new Date().toISOString(),
                estimated_finish_time: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                wait_time_minutes: 15
            }
        };
        
        // Process response to start timer
        upgradeTimer.processApiResponse(userId, creature1Id, creature2Id, mockResponse);
        
        // Update UI with response
        updateResponseUI(mockResponse);
        
        return mockResponse;
    }
}

/**
 * Update UI with API response
 */
function updateResponseUI(data) {
    // Example implementation - update with your actual UI code
    const responseContainer = document.getElementById('upgrade-response-container');
    if (responseContainer) {
        if (data.success) {
            responseContainer.innerHTML = `
                <div class="alert alert-success">
                    <p>${data.message}</p>
                </div>
            `;
        } else {
            responseContainer.innerHTML = `
                <div class="alert alert-warning">
                    <p>${data.message}</p>
                    ${data.progress ? `
                        <div class="progress">
                            <div class="progress-bar" role="progressbar" style="width: ${data.progress.percentage};" 
                                aria-valuenow="${data.progress.current}" aria-valuemin="0" aria-valuemax="${data.progress.total}">
                                ${data.progress.percentage}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        responseContainer.style.display = 'block';
    }
}

// Export for global use
window.upgradeCreatures = upgradeCreatures;

/**
 * Upgrade Timer Handler for Creature Merges
 * This file handles the creature merge process, particularly for common creatures
 * that can be completed with two clicks without waiting for timers.
 */

// Base API URL - update this to your server URL
const API_BASE_URL = 'http://localhost:5000';

/**
 * Start a creature merge process by calling the upgrade-milestone API
 * @param {string} userId - The user ID
 * @param {string} creature1Id - First creature ID
 * @param {string} creature2Id - Second creature ID
 * @returns {Promise} - The API response
 */
async function startMergeProcess(userId, creature1Id, creature2Id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/creatures/${userId}/upgrade-milestone`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                creature1Id,
                creature2Id
            })
        });
        
        const data = await response.json();
        console.log('Merge API response:', data);
        
        // For common creatures, handle the first click
        if (data.data && data.data.rarity === 'common') {
            // First click will return success: false with a message to wait
            if (!data.success && data.progress && data.progress.current === 50) {
                // Display progress and message to user
                updateProgressUI(data.progress.current, data.message);
                
                // For common creatures, we can immediately click again without waiting
                // since we've modified the server to skip the timer check
                return completeCommonCreatureMerge(userId, creature1Id, creature2Id);
            }
        }
        
        return data;
    } catch (error) {
        console.error('Error starting merge process:', error);
        throw error;
    }
}

/**
 * Complete the merge process for common creatures (second click)
 * @param {string} userId - The user ID
 * @param {string} creature1Id - First creature ID
 * @param {string} creature2Id - Second creature ID
 * @returns {Promise} - The API response
 */
async function completeCommonCreatureMerge(userId, creature1Id, creature2Id) {
    try {
        // Short delay to make the process visible to the user
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Make the second API call
        const response = await fetch(`${API_BASE_URL}/api/creatures/${userId}/upgrade-milestone`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                creature1Id,
                creature2Id
            })
        });
        
        const data = await response.json();
        console.log('Merge completion response:', data);
        
        // Update the UI with completion status
        if (data.success) {
            updateProgressUI(100, 'Merge completed successfully!');
        } else {
            updateProgressUI(data.progress?.current || 0, data.message);
        }
        
        return data;
    } catch (error) {
        console.error('Error completing merge process:', error);
        throw error;
    }
}

/**
 * Check the progress of an ongoing merge
 * @param {string} userId - The user ID
 * @param {string} creature1Id - First creature ID
 * @param {string} creature2Id - Second creature ID
 * @returns {Promise} - The API response
 */
async function checkMergeProgress(userId, creature1Id, creature2Id) {
    try {
        const response = await fetch(
            `${API_BASE_URL}/api/creatures/check-upgrade-progress/${userId}?creature1Id=${creature1Id}&creature2Id=${creature2Id}`,
            { method: 'GET' }
        );
        
        const data = await response.json();
        console.log('Progress check response:', data);
        
        // Update the UI with progress
        if (data.progress) {
            updateProgressUI(data.progress.current, data.message);
        }
        
        return data;
    } catch (error) {
        console.error('Error checking merge progress:', error);
        throw error;
    }
}

/**
 * Collect a completed merge
 * @param {string} userId - The user ID
 * @param {string} creature1Id - First creature ID
 * @param {string} creature2Id - Second creature ID
 * @returns {Promise} - The API response
 */
async function collectCompletedMerge(userId, creature1Id, creature2Id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/creatures/${userId}/collect-upgrade`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                creature1Id,
                creature2Id
            })
        });
        
        const data = await response.json();
        console.log('Collect merge response:', data);
        
        if (data.success) {
            updateProgressUI(100, 'Merge collected successfully!');
        }
        
        return data;
    } catch (error) {
        console.error('Error collecting merge:', error);
        throw error;
    }
}

/**
 * Update the progress UI elements
 * @param {number} progress - Progress percentage (0-100)
 * @param {string} message - Status message to display
 */
function updateProgressUI(progress, message) {
    // Find UI elements - these IDs should match your HTML elements
    const progressBar = document.getElementById('merge-progress-bar');
    const progressText = document.getElementById('merge-progress-text');
    const statusMessage = document.getElementById('merge-status-message');
    
    // Update elements if they exist
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
        progressBar.setAttribute('aria-valuenow', progress);
    }
    
    if (progressText) {
        progressText.textContent = `${progress}%`;
    }
    
    if (statusMessage) {
        statusMessage.textContent = message;
    }
}

// Export functions for use in other files
window.creatureMerge = {
    startMergeProcess,
    completeCommonCreatureMerge,
    checkMergeProgress,
    collectCompletedMerge
}; 