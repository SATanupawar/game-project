// API handlers for creature operations

/**
 * Upgrade creature to next milestone level by merging two creatures
 * This function includes client-side validation before making the API call
 */
async function upgradeCreatureMilestone(userId, creature1Id, creature2Id) {
    try {
        // Check if we can make the API call based on timing
        if (!window.creatureMerge.canCompleteMerge(userId, creature1Id, creature2Id)) {
            // If canCompleteMerge returns false, it will show the error message
            // so we just return without making the API call
            return;
        }

        // Proceed with API call
        const response = await fetch(`/api/creatures/${userId}/upgrade-milestone`, {
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
        
        // If this is the first click, store the timing information
        if (!data.success && data.timing) {
            window.creatureMerge.handleFirstMergeResponse(data, userId, creature1Id, creature2Id);
        } else {
            // Handle successful merge or other responses
            updateMergeUI(data);
        }
        
        return data;
    } catch (error) {
        console.error('Error in upgradeCreatureMilestone:', error);
        return {
            success: false,
            message: 'Network error: Could not connect to server'
        };
    }
}

/**
 * Check upgrade progress for creatures
 */
async function checkUpgradeProgress(userId, creature1Id, creature2Id) {
    try {
        const response = await fetch(`/api/creatures/check-upgrade-progress/${userId}?creature1Id=${creature1Id}&creature2Id=${creature2Id}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error in checkUpgradeProgress:', error);
        return {
            success: false,
            message: 'Network error: Could not connect to server'
        };
    }
}

/**
 * Collect a completed creature upgrade
 */
async function collectUpgrade(userId, creature1Id, creature2Id) {
    try {
        const response = await fetch(`/api/creatures/${userId}/collect-upgrade`, {
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
        return data;
    } catch (error) {
        console.error('Error in collectUpgrade:', error);
        return {
            success: false,
            message: 'Network error: Could not connect to server'
        };
    }
}

/**
 * Speed up an upgrade process (uses gems)
 */
async function speedUpUpgrade(userId, creature1Id, creature2Id) {
    try {
        const response = await fetch(`/api/creatures/speed-up-upgrade/${userId}`, {
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
        return data;
    } catch (error) {
        console.error('Error in speedUpUpgrade:', error);
        return {
            success: false,
            message: 'Network error: Could not connect to server'
        };
    }
}

// Update UI based on merge response
function updateMergeUI(data) {
    // Implement based on your actual UI
    console.log('Updating merge UI with:', data);
    
    // Example implementation
    const responseContainer = document.getElementById('merge-response-container');
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

// Export API functions
window.creatureAPI = {
    upgradeCreatureMilestone,
    checkUpgradeProgress,
    collectUpgrade,
    speedUpUpgrade,
    updateMergeUI
}; 