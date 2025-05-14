// Global variables
let app;
let worldMap;
let cloudMap;
let countrySprites = {};
let activeFilter = 'public';
let developerData = [];
let assetsLoaded = 0;
let totalAssets = 2;

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initPixiApp();
    loadDeveloperData();
    setupEventListeners();
});

// Initialize PixiJS application
function initPixiApp() {
    const mapContainer = document.getElementById('map-container');
    
    // Create PixiJS application to fill the entire container
    app = new PIXI.Application({
        width: window.innerWidth,
        height: window.innerHeight - 100, // Account for header
        backgroundColor: 0x19283a, // Dark blue for ocean background
        resolution: window.devicePixelRatio || 1,
        autoDensity: true
    });
    
    mapContainer.appendChild(app.view);
    app.view.style.position = 'absolute';
    app.view.style.left = '0';
    app.view.style.top = '0';
    
    // Load both map assets - loading cloud map first, then pixel map
    PIXI.Assets.load('/static/images/worldmap_clouds2.png').then(cloudMapLoaded);
    PIXI.Assets.load('/static/images/pixel-world-map1.png').then(baseMapLoaded);
    
    // Handle window resize for responsive behavior
    window.addEventListener('resize', () => {
        app.renderer.resize(window.innerWidth, window.innerHeight - 100);
        repositionMap();
    });
}

// Handle cloud map loading - this is now the base layer
function cloudMapLoaded(cloudTexture) {
    assetsLoaded++;
    
    // Create the cloud layer sprite as the base
    cloudMap = new PIXI.Sprite(cloudTexture);
    cloudMap.width = app.screen.width;
    cloudMap.height = app.screen.height;
    cloudMap.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
    
    // Add to stage as the bottom layer
    app.stage.addChild(cloudMap);
    
    // Once both assets are loaded, setup the interactive map
    if (assetsLoaded === totalAssets) {
        setupMapInteraction();
    }
}

// Handle pixel map loading - this is now the top layer 
function baseMapLoaded(baseTexture) {
    assetsLoaded++;
    
    // Create the pixel world map sprite
    worldMap = new PIXI.Sprite(baseTexture);
    worldMap.width = app.screen.width;
    worldMap.height = app.screen.height;
    worldMap.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
    worldMap.alpha = 1.0;
    
    // Add to stage as the top layer
    app.stage.addChild(worldMap);
    
    // Once both assets are loaded, setup the interactive map
    if (assetsLoaded === totalAssets) {
        setupMapInteraction();
    }
}

// Setup the interactive elements on the map
function setupMapInteraction() {
    // Fetch countries from cache directory
    fetch('/get_countries')
        .then(response => response.json())
        .then(countriesData => {
            // Define country regions dynamically
            const countries = {};
            
            // Process the countries data
            countriesData.forEach(countryData => {
                const countryName = countryData.name;
                countries[countryName] = countryData.region || generateDefaultRegion(countryName);
            });
            
            // Create interactive regions for each country
            Object.entries(countries).forEach(([countryName, region]) => {
                const countryRegion = new PIXI.Graphics();
                countryRegion.beginFill(0xffffff, 0.001); // Nearly transparent fill
                countryRegion.drawRect(region.x, region.y, region.width, region.height);
                countryRegion.endFill();
                
                // Make the region interactive
                countryRegion.eventMode = 'static';
                countryRegion.cursor = 'pointer';
                
                // Add hover effects
                countryRegion.on('mouseover', () => {
                    highlightCountry(countryName, true);
                });
                
                countryRegion.on('mouseout', () => {
                    if (!document.getElementById('details-panel').classList.contains('visible') || 
                        document.getElementById('country-name').textContent !== countryName) {
                        highlightCountry(countryName, false);
                    }
                });
                
                // Add click handler
                countryRegion.on('click', () => {
                    openCountryPanel(countryName);
                });
                
                // Store the sprite reference
                countrySprites[countryName] = countryRegion;
                
                // Add to the stage
                app.stage.addChild(countryRegion);
            });
            
            // Set up autocomplete for search
            setupAutocomplete(countriesData.map(country => country.name));
            
            // Add some visual flair - floating pixels
            createFloatingPixels();
        })
        .catch(error => {
            console.error('Error fetching countries:', error);
            
            // Fallback to hardcoded countries if fetch fails
            const countries = {
                'Algeria': { x: 445, y: 180, width: 50, height: 40 },
                'USA': { x: 180, y: 150, width: 100, height: 70 },
                'India': { x: 620, y: 200, width: 60, height: 50 },
                'Brazil': { x: 300, y: 250, width: 70, height: 60 },
                'Japan': { x: 730, y: 170, width: 40, height: 30 },
                'Germany': { x: 460, y: 130, width: 30, height: 20 },
                'UK': { x: 430, y: 120, width: 20, height: 15 },
                'China': { x: 670, y: 170, width: 70, height: 50 },
                'Canada': { x: 200, y: 100, width: 100, height: 50 },
                'Australia': { x: 730, y: 300, width: 60, height: 50 }
            };
            
            // Proceed with hardcoded countries
            // ... (same code as above for creating interactive regions)
        });
}

// Helper function to generate default region coordinates based on country name
function generateDefaultRegion(countryName) {
    // Simple hash function to generate pseudo-random but consistent x,y positions
    let hash = 0;
    for (let i = 0; i < countryName.length; i++) {
        hash = ((hash << 5) - hash) + countryName.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    
    // Generate position within map bounds
    const x = Math.abs(hash % (app.screen.width - 100)) + 50;
    const y = Math.abs((hash >> 8) % (app.screen.height - 100)) + 50;
    
    return {
        x: x,
        y: y,
        width: 50,
        height: 40
    };
}

// Setup autocomplete for the search input
function setupAutocomplete(countryNames) {
    const searchInput = document.getElementById('search-input');
    
    // Create a custom dropdown container
    const dropdown = document.createElement('div');
    dropdown.className = 'pixel-dropdown';
    dropdown.style.display = 'none';
    document.querySelector('.search-container').appendChild(dropdown);
    
    // Track focused option index
    let focusedIndex = -1;
    
    // Position dropdown based on available space
    function positionDropdown() {
        const inputRect = searchInput.getBoundingClientRect();
        const dropdownHeight = 250; // Max height of dropdown
        const windowHeight = window.innerHeight;
        const spaceBelow = windowHeight - inputRect.bottom;
        const spaceAbove = inputRect.top;
        
        // Reset any previous positioning
        dropdown.style.top = '';
        dropdown.style.bottom = '';
        dropdown.style.maxHeight = '';
        
        if (spaceBelow >= dropdownHeight || spaceBelow >= spaceAbove) {
            // Enough space below or more space below than above
            dropdown.style.top = 'calc(100% + 5px)';
            dropdown.style.maxHeight = `${Math.min(dropdownHeight, spaceBelow - 10)}px`;
            dropdown.classList.remove('above');
            dropdown.classList.add('below');
        } else {
            // More space above than below
            dropdown.style.bottom = 'calc(100% + 5px)';
            dropdown.style.maxHeight = `${Math.min(dropdownHeight, spaceAbove - 10)}px`;
            dropdown.classList.remove('below');
            dropdown.classList.add('above');
        }
    }
    
    // Input event listener for real-time filtering
    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase().trim();
        
        if (!query) {
            dropdown.style.display = 'none';
            return;
        }
        
        // Filter countries based on input
        const matches = countryNames.filter(country => 
            country.toLowerCase().includes(query)
        );
        
        if (matches.length > 0) {
            // Populate and show dropdown
            dropdown.innerHTML = '';
            matches.slice(0, 5).forEach((country, index) => {
                const option = document.createElement('div');
                option.className = 'pixel-option';
                
                // Add pixel art decoration
                option.innerHTML = `
                    <span class="option-bullet">■</span>
                    <span class="option-text">${country}</span>
                `;
                
                // Handle option click
                option.addEventListener('click', () => {
                    searchInput.value = country;
                    dropdown.style.display = 'none';
                    handleSearch();
                });
                
                // Handle mouse hover
                option.addEventListener('mouseenter', () => {
                    clearOptionFocus();
                    option.classList.add('focused');
                    focusedIndex = index;
                });
                
                dropdown.appendChild(option);
            });
            
            // Position and show dropdown
            dropdown.style.display = 'block';
            positionDropdown();
        } else {
            dropdown.style.display = 'none';
        }
        
        // Reset focused index
        focusedIndex = -1;
    });
    
    // Handle keyboard navigation
    searchInput.addEventListener('keydown', function(e) {
        const options = dropdown.querySelectorAll('.pixel-option');
        
        if (!options.length) return;
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            focusedIndex = Math.min(focusedIndex + 1, options.length - 1);
            updateOptionFocus(options);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            focusedIndex = Math.max(focusedIndex - 1, 0);
            updateOptionFocus(options);
        } else if (e.key === 'Enter' && focusedIndex >= 0) {
            e.preventDefault();
            options[focusedIndex].click();
        } else if (e.key === 'Escape') {
            dropdown.style.display = 'none';
        }
    });
    
    // Clear focus from all options
    function clearOptionFocus() {
        const options = dropdown.querySelectorAll('.pixel-option');
        options.forEach(opt => opt.classList.remove('focused'));
    }
    
    // Update focus state
    function updateOptionFocus(options) {
        clearOptionFocus();
        options[focusedIndex].classList.add('focused');
        options[focusedIndex].scrollIntoView({ block: 'nearest' });
    }
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!dropdown.contains(e.target) && e.target !== searchInput) {
            dropdown.style.display = 'none';
        }
    });
    
    // Hide dropdown when search input loses focus
    searchInput.addEventListener('blur', function(e) {
        // Delayed to allow click events on options to fire
        setTimeout(() => {
            if (!dropdown.contains(document.activeElement)) {
                dropdown.style.display = 'none';
            }
        }, 200);
    });
    
    // Update dropdown position on window resize
    window.addEventListener('resize', function() {
        if (dropdown.style.display === 'block') {
            positionDropdown();
        }
    });
}

// Show a custom pixel art alert
function showPixelAlert(message) {
    // Create alert overlay
    const overlay = document.createElement('div');
    overlay.className = 'pixel-alert-overlay';
    
    // Create alert box
    const alertBox = document.createElement('div');
    alertBox.className = 'pixel-alert';
    
    // Add message
    const messageDiv = document.createElement('div');
    messageDiv.className = 'pixel-alert-message';
    messageDiv.textContent = message;
    alertBox.appendChild(messageDiv);
    
    // Add OK button
    const okButton = document.createElement('button');
    okButton.className = 'pixel-button';
    okButton.textContent = 'OK';
    okButton.onclick = () => {
        document.body.removeChild(overlay);
    };
    alertBox.appendChild(okButton);
    
    // Add alert to the page
    overlay.appendChild(alertBox);
    document.body.appendChild(overlay);
    
    // Focus the button
    okButton.focus();
}

// Highlight a country on the map
function highlightCountry(countryName, highlight) {
    const countrySprite = countrySprites[countryName];
    if (!countrySprite) return;
    
    if (highlight) {
        try {
            // Check if GlowFilter is available
            if (window.PIXI && PIXI.filters && typeof PIXI.filters.GlowFilter === 'function') {
        // Create a glow effect
        const glowFilter = new PIXI.filters.GlowFilter({
            distance: 15,
            outerStrength: 2,
            innerStrength: 1,
            color: 0x44a9fb,
            quality: 0.5
        });
        countrySprite.filters = [glowFilter];
            } else {
                // Fallback if GlowFilter is not available
                console.log("GlowFilter not available, using alternative highlight method");
                // Change tint as fallback highlight method
                countrySprite.tint = 0x44a9fb;
                countrySprite.alpha = 0.85;
            }
        } catch (error) {
            console.error("Error applying filters:", error);
            // Simple fallback
            countrySprite.tint = 0x44a9fb;
            countrySprite.alpha = 0.85;
        }
        
        // Slight scale up
        gsap.to(countrySprite.scale, {
            x: 1.05,
            y: 1.05,
            duration: 0.3,
            ease: "power2.out"
        });
    } else {
        // Remove highlight effects
        try {
        countrySprite.filters = null;
        } catch (error) {
            console.error("Error removing filters:", error);
        }
        
        // Reset tint if that was used
        countrySprite.tint = 0xFFFFFF;
        countrySprite.alpha = 1.0;
        
        // Scale back to normal
        gsap.to(countrySprite.scale, {
            x: 1,
            y: 1,
            duration: 0.3,
            ease: "power2.out"
        });
    }
}

// Create floating pixel particles
function createFloatingPixels() {
    const pixelCount = 50;
    
    for (let i = 0; i < pixelCount; i++) {
        const pixel = new PIXI.Graphics();
        const size = Math.random() * 3 + 1;
        const colors = [0x44a9fb, 0x8ceb34, 0xffcc00, 0xff5555, 0xb967ff];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        pixel.beginFill(color);
        pixel.drawRect(0, 0, size, size);
        pixel.endFill();
        
        // Random position
        pixel.x = Math.random() * app.screen.width;
        pixel.y = Math.random() * app.screen.height;
        
        // Random direction and speed
        pixel.vx = (Math.random() - 0.5) * 0.5;
        pixel.vy = (Math.random() - 0.5) * 0.5;
        
        app.stage.addChild(pixel);
        
        // Animate the pixel
        app.ticker.add(() => {
            pixel.x += pixel.vx;
            pixel.y += pixel.vy;
            
            // Wrap around edges
            if (pixel.x < 0) pixel.x = app.screen.width;
            if (pixel.x > app.screen.width) pixel.x = 0;
            if (pixel.y < 0) pixel.y = app.screen.height;
            if (pixel.y > app.screen.height) pixel.y = 0;
        });
    }
}

// Reposition map on resize for responsive behavior
function repositionMap() {
    if (worldMap) {
        worldMap.width = app.screen.width;
        worldMap.height = app.screen.height;
    }
    
    if (cloudMap) {
        cloudMap.width = app.screen.width;
        cloudMap.height = app.screen.height;
    }
    
    // Reposition country selection areas based on new dimensions
    // This would require more complex logic in a real application
    // to precisely map the countries to their new positions
}

// Load developer data
function loadDeveloperData() {
    // Fetch the developer data from our API
    fetch('/api/developers')
        .then(response => response.json())
        .then(data => {
            developerData = data.data || [];
            
            // If there's already a country panel open, refresh it
            const detailsPanel = document.getElementById('details-panel');
            if (detailsPanel.classList.contains('visible')) {
                const countryName = document.getElementById('country-name').textContent;
                populateDevCards(countryName);
            }
        })
        .catch(error => {
            console.error('Error loading developer data:', error);
            
            // Fallback to dummy data
            developerData = [
                {
                    country: 'Algeria',
                    developers: [
                        {
                            name: 'Mohamed Ali',
                            handle: 'mohamedcoder',
                            company: 'TechAlgiers',
                            location: 'Algiers, Algeria',
                            publicContributions: 785,
                            totalContributions: 1342,
                            followers: 321,
                            twitter: '@mohamedcoder',
                            avatar: '/static/images/avatars/dev1.svg'
                        },
                        {
                            name: 'Fatima Zohra',
                            handle: 'fatimadev',
                            company: 'OranCode',
                            location: 'Oran, Algeria',
                            publicContributions: 652,
                            totalContributions: 980,
                            followers: 245,
                            twitter: '@fatimadev',
                            avatar: '/static/images/avatars/dev2.svg'
                        }
                    ]
                },
                {
                    country: 'USA',
                    developers: [
                        {
                            name: 'John Smith',
                            handle: 'johnsmith',
                            company: 'TechGiant',
                            location: 'San Francisco, USA',
                            publicContributions: 1245,
                            totalContributions: 1985,
                            followers: 842,
                            twitter: '@johnsmith',
                            avatar: '/static/images/avatars/dev3.svg'
                        }
                    ]
                }
            ];
        });
}

// Set up event listeners
function setupEventListeners() {
    // Filter tabs
    const filterButtons = document.querySelectorAll('.tab-button:not(.modal-tab)');
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update active filter
            activeFilter = button.dataset.filter;
            
            // Update UI
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // If panel is open, refresh the developer list
            const detailsPanel = document.getElementById('details-panel');
            if (detailsPanel.classList.contains('visible')) {
                const countryName = document.getElementById('country-name').textContent;
                populateDevCards(countryName);
            }
            
            // If modal is open, update the modal too
            const modal = document.getElementById('top-devs-modal');
            if (modal && modal.classList.contains('visible')) {
                // Update modal tabs
                const modalTabs = modal.querySelectorAll('.modal-tab');
                modalTabs.forEach(tab => {
                    if (tab.dataset.filter === activeFilter) {
                        tab.classList.add('active');
                    } else {
                        tab.classList.remove('active');
                    }
                });
                
                // Get the country name from the modal header
                const modalCountry = modal.querySelector('.modal-header h2').textContent.split(' - ')[1];
                
                // Fetch country data again and update the modal
                const countryFileName = modalCountry.toLowerCase().replace(/\s+/g, '_');
                fetch(`/cache/${countryFileName}.json`)
                    .then(response => response.json())
                    .then(developers => {
                        // Sort developers based on active filter
                        const sortedDevs = sortDevelopersByFilter(developers, activeFilter);
                        const topDevs = sortedDevs.slice(0, 5);
                        
                        // Update the container
                        const devsContainer = modal.querySelector('.top-devs-container');
                        devsContainer.innerHTML = topDevs.map((dev, index) => 
                            createDevCard(dev, index + 1, modalCountry)
                        ).join('');
                        
                        // Re-attach event listeners
                        attachDevCardEventListeners(modal, developers, modalCountry);
                    })
                    .catch(error => {
                        console.error('Error updating modal data:', error);
                    });
            }
        });
    });
    
    // Close panel button
    document.getElementById('close-panel').addEventListener('click', () => {
        closeCountryPanel();
    });
    
    // Search button
    document.getElementById('search-button').addEventListener('click', handleSearch);
    
    // Search input (on enter key)
    document.getElementById('search-input').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
    
    // Close modal when clicking outside
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('top-devs-modal');
        if (modal && modal.classList.contains('visible')) {
            // Check if the click is outside the modal content
            if (e.target === modal) {
                modal.classList.remove('visible');
            }
        }
    });
    
    // Handle ESC key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('top-devs-modal');
            if (modal && modal.classList.contains('visible')) {
                modal.classList.remove('visible');
            }
        }
    });
}

// Handle search functionality
function handleSearch() {
    const searchTerm = document.getElementById('search-input').value.trim();
    
    if (!searchTerm) return;
    
    // Convert search term to consistent format for comparison
    const normalizedSearchTerm = searchTerm.toLowerCase();
    
    // First check if it matches a country name
    const countryMatch = Object.keys(countrySprites).find(countryName => 
        countryName.toLowerCase().includes(normalizedSearchTerm)
    );
    
    if (countryMatch) {
        openCountryPanel(countryMatch);
        return;
    }
    
    // Check if it's a developer name or handle
    for (const country of developerData) {
        const devMatch = country.developers.find(dev => 
            dev.name.toLowerCase().includes(normalizedSearchTerm) || 
            dev.handle.toLowerCase().includes(normalizedSearchTerm)
        );
        
        if (devMatch) {
            openCountryPanel(country.country);
            // Highlight the developer card somehow
            return;
        }
    }
    
    // No matches found - use our custom pixel alert instead of default alert
    showPixelAlert('No matching country!');
}

// Open the country panel
function openCountryPanel(countryName) {
    // Highlight the country on the map
    Object.keys(countrySprites).forEach(country => {
        highlightCountry(country, country === countryName);
    });
    
    // Skip showing the side panel and just load country data for the modal
    loadCountryDevelopersData(countryName);
    
    // Note: We no longer show the details panel at all
    // const detailsPanel = document.getElementById('details-panel');
    // document.getElementById('country-name').textContent = countryName;
    // detailsPanel.classList.add('visible');
    // populateDevCards(countryName);
}

// Load country data from JSON file and show top developers modal
function loadCountryDevelopersData(countryName) {
    // Convert country name to file format (lowercase with underscores)
    const countryFileName = countryName.toLowerCase().replace(/\s+/g, '_');
    
    console.log("Loading country data for:", countryFileName);
    
    // Fetch the JSON data for the country
    fetch(`/cache/${countryFileName}.json`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Country data not found');
            }
            return response.json();
        })
        .then(developers => {
            console.log(`Found ${developers.length} developers for ${countryName}`);
            // Open the modal with developer data
            openTopDevelopersModal(countryName, developers);
        })
        .catch(error => {
            console.error('Error loading country data:', error);
            // Try with underscore suffix if the initial attempt fails (handle edge cases)
            if (!countryFileName.endsWith('_')) {
                fetch(`/cache/${countryFileName}_.json`)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Country data not found');
                        }
                        return response.json();
                    })
                    .then(developers => {
                        console.log(`Found ${developers.length} developers for ${countryName} (with underscore)`);
                        openTopDevelopersModal(countryName, developers);
                    })
                    .catch(secondError => {
                        console.error('Error on second attempt:', secondError);
                        // Instead of showing an alert, silently fail - don't show any popup
                        console.log(`No data available for ${countryName}, silent fail`);
                    });
            } else {
                // Instead of showing an alert, silently fail - don't show any popup
                console.log(`No data available for ${countryName}, silent fail`);
            }
        });
}

// Open modal to display top developers
function openTopDevelopersModal(countryName, developers) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('top-devs-modal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'top-devs-modal';
        modal.className = 'pixel-modal';
        document.body.appendChild(modal);
    }
    
    // Sort developers based on active filter
    const sortedDevs = sortDevelopersByFilter(developers, activeFilter);
    
    // Get top 5 developers
    const topDevs = sortedDevs.slice(0, 5);
    
    // Create modal content
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Top Developers - ${countryName}</h2>
                <div class="filter-tabs modal-tabs">
                    <button class="tab-button modal-tab ${activeFilter === 'public' ? 'active' : ''}" data-filter="public">Top Public</button>
                    <button class="tab-button modal-tab ${activeFilter === 'total' ? 'active' : ''}" data-filter="total">Top Total</button>
                    <button class="tab-button modal-tab ${activeFilter === 'followers' ? 'active' : ''}" data-filter="followers">Top Followers</button>
                </div>
                <button class="close-modal">×</button>
            </div>
            <div class="modal-search">
                <input type="text" id="dev-search-input" class="pixel-input" placeholder="Search developer...">
                <button id="dev-search-button" class="pixel-button">Search</button>
            </div>
            <div class="top-devs-container">
                ${topDevs.map((dev, index) => createDevCard(dev, index + 1, countryName)).join('')}
            </div>
        </div>
    `;
    
    // Add event listeners
    setupModalEventListeners(modal, developers, countryName);
    
    // Show the modal
    modal.classList.add('visible');
}

// Sort developers based on the active filter
function sortDevelopersByFilter(developers, filter) {
    return [...developers].sort((a, b) => {
        if (filter === 'public') {
            return b.publicContributions - a.publicContributions;
        } else if (filter === 'total') {
            return (b.privateContributions + b.publicContributions) - (a.privateContributions + a.publicContributions);
        } else {
            return b.followers - a.followers;
        }
    });
}

// Create a developer card for the modal
function createDevCard(dev, ranking, countryName) {
    // Handle undefined values
    const company = dev.company !== "undefined value" ? dev.company : "";
    const twitter = dev.twitterUsername !== "undefined value" ? dev.twitterUsername : "";
    const name = dev.name !== "undefined value" ? dev.name : dev.login;
    
    // Calculate the value to display based on active filter
    let filterValue = '';
    let filterLabel = '';
    
    if (activeFilter === 'public') {
        filterValue = dev.publicContributions;
        filterLabel = 'Public Contributions';
    } else if (activeFilter === 'total') {
        filterValue = dev.privateContributions + dev.publicContributions;
        filterLabel = 'Total Contributions';
    } else {
        filterValue = dev.followers;
        filterLabel = 'Followers';
    }
    
    return `
        <div class="top-dev-card" data-dev-id="${dev.login}">
            <div class="ranking-badge">#${ranking}</div>
            <img src="${dev.avatarUrl}" alt="${name}" class="dev-avatar pixel-avatar">
            <div class="dev-details">
                <h3 class="dev-name">${name}</h3>
                <p class="dev-handle">@${dev.login}</p>
                ${company ? `<p class="dev-company">${company}</p>` : ''}
                ${dev.location ? `<p class="dev-location">${dev.location}</p>` : ''}
                ${twitter ? `<p class="dev-twitter">Twitter: ${twitter}</p>` : ''}
                <div class="dev-stat">
                    <span class="stat-label">${filterLabel}:</span>
                    <span class="stat-value">${filterValue}</span>
                </div>
            </div>
            <div class="dev-actions">
                <button class="pixel-button download-card" data-dev="${encodeURIComponent(JSON.stringify(dev))}" data-rank="${ranking}" data-country="${countryName}">
                    <span class="button-icon">⬇️</span> Download
                </button>
                <button class="pixel-button share-twitter" data-dev="${encodeURIComponent(JSON.stringify(dev))}" data-rank="${ranking}" data-country="${countryName}">
                    <span class="button-icon">🐦</span> Twitter
                </button>
                <button class="pixel-button share-linkedin" data-dev="${encodeURIComponent(JSON.stringify(dev))}" data-rank="${ranking}" data-country="${countryName}">
                    <span class="button-icon">🔗</span> LinkedIn
                </button>
            </div>
        </div>
    `;
}

// Set up event listeners for the modal
function setupModalEventListeners(modal, developers, countryName) {
    // Close button
    const closeButton = modal.querySelector('.close-modal');
    closeButton.addEventListener('click', () => {
        modal.classList.remove('visible');
    });
    
    // Filter tabs
    const filterButtons = modal.querySelectorAll('.modal-tab');
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Update active filter
            activeFilter = button.dataset.filter;
            
            // Update UI
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update the main filter tabs as well
            const mainFilterButtons = document.querySelectorAll('.tab-button:not(.modal-tab)');
            mainFilterButtons.forEach(btn => {
                if (btn.dataset.filter === activeFilter) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            
            // Re-render the developer cards
            const sortedDevs = sortDevelopersByFilter(developers, activeFilter);
            const topDevs = sortedDevs.slice(0, 5);
            const devsContainer = modal.querySelector('.top-devs-container');
            devsContainer.innerHTML = topDevs.map((dev, index) => createDevCard(dev, index + 1, countryName)).join('');
            
            // Re-attach event listeners for the new cards
            attachDevCardEventListeners(modal, developers, countryName);
        });
    });
    
    // Setup autocomplete for developer search
    setupDevAutocomplete(modal, developers, countryName);
    
    // Attach event listeners to dev cards
    attachDevCardEventListeners(modal, developers, countryName);
}

// Setup autocomplete for developer search in the modal
function setupDevAutocomplete(modal, developers, countryName) {
    const searchInput = modal.querySelector('#dev-search-input');
    const searchButton = modal.querySelector('#dev-search-button');
    
    // Create a custom dropdown container
    const dropdown = document.createElement('div');
    dropdown.className = 'pixel-dropdown';
    dropdown.style.display = 'none';
    modal.querySelector('.modal-search').appendChild(dropdown);
    
    // Track focused option index
    let focusedIndex = -1;
    
    // Position dropdown based on available space
    function positionDropdown() {
        const inputRect = searchInput.getBoundingClientRect();
        const dropdownHeight = 250; // Max height of dropdown
        const windowHeight = window.innerHeight;
        const spaceBelow = windowHeight - inputRect.bottom;
        const spaceAbove = inputRect.top;
        
        // Reset any previous positioning
        dropdown.style.top = '';
        dropdown.style.bottom = '';
        dropdown.style.maxHeight = '';
        
        if (spaceBelow >= dropdownHeight || spaceBelow >= spaceAbove) {
            // Enough space below or more space below than above
            dropdown.style.top = 'calc(100% + 5px)';
            dropdown.style.maxHeight = `${Math.min(dropdownHeight, spaceBelow - 10)}px`;
            dropdown.classList.remove('above');
            dropdown.classList.add('below');
        } else {
            // More space above than below
            dropdown.style.bottom = 'calc(100% + 5px)';
            dropdown.style.maxHeight = `${Math.min(dropdownHeight, spaceAbove - 10)}px`;
            dropdown.classList.remove('below');
            dropdown.classList.add('above');
        }
    }
    
    // Function to perform search
    const performSearch = () => {
        const searchTerm = searchInput.value.toLowerCase().trim();
        
        if (!searchTerm) {
            // If search is empty, show top 5 developers
            const sortedDevs = sortDevelopersByFilter(developers, activeFilter);
            const topDevs = sortedDevs.slice(0, 5);
            const devsContainer = modal.querySelector('.top-devs-container');
            devsContainer.innerHTML = topDevs.map((dev, index) => createDevCard(dev, index + 1, countryName)).join('');
            attachDevCardEventListeners(modal, developers, countryName);
            return;
        }
        
        // Filter developers by search term
        const filteredDevs = developers.filter(dev => {
            const name = dev.name !== "undefined value" ? dev.name.toLowerCase() : "";
            const login = dev.login.toLowerCase();
            const location = dev.location ? dev.location.toLowerCase() : "";
            const company = dev.company !== "undefined value" ? dev.company.toLowerCase() : "";
            
            return name.includes(searchTerm) || 
                   login.includes(searchTerm) ||
                   location.includes(searchTerm) ||
                   company.includes(searchTerm);
        });
        
        if (filteredDevs.length === 0) {
            // No results found
            const devsContainer = modal.querySelector('.top-devs-container');
            devsContainer.innerHTML = `<div class="no-results">No developers found matching "${searchInput.value}"</div>`;
        } else {
            // Show filtered developers, sorted by the active filter
            const sortedDevs = sortDevelopersByFilter(filteredDevs, activeFilter);
            const devsContainer = modal.querySelector('.top-devs-container');
            
            // Calculate ranking based on the position in the original sorted list
            const allSortedDevs = sortDevelopersByFilter(developers, activeFilter);
            const devCards = sortedDevs.map(dev => {
                // Find the original rank in the full list
                const originalRank = allSortedDevs.findIndex(d => d.login === dev.login) + 1;
                return createDevCard(dev, originalRank, countryName);
            }).join('');
            
            devsContainer.innerHTML = devCards;
        }
        
        // Re-attach event listeners for the new cards
        attachDevCardEventListeners(modal, developers, countryName);
    };
    
    // Input event listener for real-time filtering
    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase().trim();
        
        if (!query) {
            dropdown.style.display = 'none';
            return;
        }
        
        // Get developer names and handles for autocomplete
        const devOptions = developers.map(dev => {
            const name = dev.name !== "undefined value" ? dev.name : "";
            return {
                displayName: name || dev.login,
                login: dev.login,
                searchText: (name + " " + dev.login).toLowerCase()
            };
        });
        
        // Filter developers based on input
        const matches = devOptions.filter(dev => 
            dev.searchText.includes(query)
        );
        
        if (matches.length > 0) {
            // Populate and show dropdown
            dropdown.innerHTML = '';
            matches.slice(0, 5).forEach((dev, index) => {
                const option = document.createElement('div');
                option.className = 'pixel-option';
                
                // Add pixel art decoration
                option.innerHTML = `
                    <span class="option-bullet">■</span>
                    <span class="option-text">${dev.displayName} (@${dev.login})</span>
                `;
                
                // Handle option click
                option.addEventListener('click', () => {
                    searchInput.value = dev.displayName;
                    dropdown.style.display = 'none';
                    performSearch();
                });
                
                // Handle mouse hover
                option.addEventListener('mouseenter', () => {
                    clearOptionFocus();
                    option.classList.add('focused');
                    focusedIndex = index;
                });
                
                dropdown.appendChild(option);
            });
            
            // Position and show dropdown
            dropdown.style.display = 'block';
            positionDropdown();
        } else {
            dropdown.style.display = 'none';
        }
        
        // Reset focused index
        focusedIndex = -1;
    });
    
    // Handle keyboard navigation
    searchInput.addEventListener('keydown', function(e) {
        const options = dropdown.querySelectorAll('.pixel-option');
        
        if (!options.length) return;
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            focusedIndex = Math.min(focusedIndex + 1, options.length - 1);
            updateOptionFocus(options);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            focusedIndex = Math.max(focusedIndex - 1, 0);
            updateOptionFocus(options);
        } else if (e.key === 'Enter' && focusedIndex >= 0) {
            e.preventDefault();
            options[focusedIndex].click();
        } else if (e.key === 'Enter') {
            performSearch();
        } else if (e.key === 'Escape') {
            dropdown.style.display = 'none';
        }
    });
    
    // Clear focus from all options
    function clearOptionFocus() {
        const options = dropdown.querySelectorAll('.pixel-option');
        options.forEach(opt => opt.classList.remove('focused'));
    }
    
    // Update focus state
    function updateOptionFocus(options) {
        clearOptionFocus();
        options[focusedIndex].classList.add('focused');
        options[focusedIndex].scrollIntoView({ block: 'nearest' });
    }
    
    // Hide dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!dropdown.contains(e.target) && e.target !== searchInput) {
            dropdown.style.display = 'none';
        }
    });
    
    // Hide dropdown when search input loses focus
    searchInput.addEventListener('blur', function(e) {
        // Delayed to allow click events on options to fire
        setTimeout(() => {
            if (!dropdown.contains(document.activeElement)) {
                dropdown.style.display = 'none';
            }
        }, 200);
    });
    
    // Update dropdown position on window resize
    window.addEventListener('resize', function() {
        if (dropdown.style.display === 'block') {
            positionDropdown();
        }
    });
    
    // Add click event listener to search button
    if (searchButton) {
        searchButton.addEventListener('click', performSearch);
    }
    
    // Focus the input for better UX
    setTimeout(() => {
        searchInput.focus();
    }, 300);
}

// Attach event listeners to individual developer cards
function attachDevCardEventListeners(modal, developers, countryName) {
    // Download card buttons
    const downloadButtons = modal.querySelectorAll('.download-card');
    downloadButtons.forEach(button => {
        button.addEventListener('click', () => {
            const devData = JSON.parse(decodeURIComponent(button.dataset.dev));
            const ranking = button.dataset.rank;
            downloadDevCard(devData, ranking, countryName);
        });
    });
    
    // Share on Twitter buttons
    const twitterButtons = modal.querySelectorAll('.share-twitter');
    twitterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const devData = JSON.parse(decodeURIComponent(button.dataset.dev));
            const ranking = button.dataset.rank;
            shareOnTwitter(devData, ranking, countryName);
        });
    });
    
    // Share on LinkedIn buttons
    const linkedinButtons = modal.querySelectorAll('.share-linkedin');
    linkedinButtons.forEach(button => {
        button.addEventListener('click', () => {
            const devData = JSON.parse(decodeURIComponent(button.dataset.dev));
            const ranking = button.dataset.rank;
            shareOnLinkedIn(devData, ranking, countryName);
        });
    });
}

// Download developer card as an image
function downloadDevCard(dev, ranking, countryName) {
    // Create a temporary canvas to draw the card
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Set canvas dimensions - larger for better quality
    canvas.width = 600;
    canvas.height = 350;

    // Show loading indicator
    showPixelAlert('Creating pixel art card...');

    // Function to wrap text
    function wrapText(context, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let lineCount = 0;

        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = context.measureText(testLine);
            const testWidth = metrics.width;

            if (testWidth > maxWidth && n > 0) {
                context.fillText(line, x, y);
                line = words[n] + ' ';
                y += lineHeight;
                lineCount++;
            } else {
                line = testLine;
            }
        }
        context.fillText(line, x, y);
        return lineCount + 1; // Return total number of lines
    }

    // Load the world map image and then draw the card
    const worldMapImage = new Image();
    worldMapImage.crossOrigin = "Anonymous";
    worldMapImage.src = '/static/images/pixel-world-map1.png';

    worldMapImage.onload = function() {
        drawCardWithMap(worldMapImage);
    };

    worldMapImage.onerror = function() {
        console.error('Failed to load world map image');
        // Fall back to drawing without the map
        drawCardWithMap(null);
    };

    // Draw the card with the world map background
    function drawCardWithMap(mapImage) {
        // Draw gradient background
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#2c2c3a');
        gradient.addColorStop(1, '#1a1a24');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw card container with elegant border
        ctx.fillStyle = '#43434f';
        ctx.globalAlpha = 1.0;
        ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);

        // Draw elegant border
        ctx.strokeStyle = '#44a9fb';
        ctx.lineWidth = 3;
        ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

        // Add secondary inner border
        ctx.strokeStyle = '#8ceb34';
        ctx.lineWidth = 1;
        ctx.strokeRect(26, 26, canvas.width - 52, canvas.height - 52);

        // Draw the world map image as a watermark (marca de agua)
        if (mapImage) {
            // Draw the map exactly covering the card area
            const cardX = 20;
            const cardY = 20;
            const cardW = canvas.width - 40;
            const cardH = canvas.height - 40;

            ctx.save();
            ctx.globalAlpha = 0.18; // Watermark-like transparency
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(mapImage, cardX, cardY, cardW, cardH);
            ctx.imageSmoothingEnabled = true;
            ctx.restore();
        }

        // Draw shadows
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;

        // Draw title with pixel art style
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 20px "Press Start 2P"';
        ctx.fillText(`Top ${activeFilter === 'public' ? 'Public' : activeFilter === 'total' ? 'Total' : 'Followers'}`, 40, 60);

        // Draw country name
        ctx.fillStyle = '#8ceb34';
        ctx.font = '16px "Press Start 2P"';
        ctx.fillText(countryName, 40, 90);

        // Draw rank position (added for instruction)
        ctx.fillStyle = '#b967ff';
        ctx.font = 'bold 14px "Press Start 2P"';
        ctx.fillText(`Rank Position: #${ranking}`, 40, 110);

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Draw ranking badge with pixel art style
        ctx.fillStyle = '#222323';
        ctx.globalAlpha = 0.96; // Slightly transparent to let map show through
        ctx.fillRect(40, 120, 90, 90);
        ctx.globalAlpha = 1.0;

        // Draw name with pixel art shadow effect
        const name = dev.name !== "undefined value" ? dev.name : dev.login;
        ctx.fillStyle = '#f5f6fa';
        ctx.font = '16px "Press Start 2P"';

        // Draw shadow text first (pixel art style shadow)
        ctx.fillStyle = '#333344';
        const nameLines = wrapText(ctx, name, 150 + 2, 130 + 2, 400, 24);

        // Draw actual text
        ctx.fillStyle = '#f5f6fa';
        wrapText(ctx, name, 150, 130, 400, 24);

        // Draw handle
        ctx.fillStyle = '#44a9fb';
        ctx.font = '12px "Press Start 2P"';
        ctx.fillText(`@${dev.login}`, 150, 130 + (nameLines * 24) + 10);

        // Current Y position for next text
        let currentY = 130 + (nameLines * 24) + 30;

        // Draw location
        if (dev.location) {
            // Draw location icon (pixel art style)
            ctx.fillStyle = '#a8a8b4';
            ctx.fillRect(150, currentY - 10, 8, 8);

            ctx.fillStyle = '#a8a8b4';
            ctx.font = '10px "Press Start 2P"';
            const locationLines = wrapText(ctx, dev.location, 170, currentY, 380, 15);
            currentY += locationLines * 15 + 15;
        }

        // Draw company
        const company = dev.company !== "undefined value" ? dev.company : "";
        if (company) {
            // Draw company icon (pixel art style)
            ctx.fillStyle = '#a8a8b4';
            ctx.fillRect(150, currentY - 10, 8, 8);
            ctx.fillRect(154, currentY - 6, 8, 8);

            ctx.fillStyle = '#a8a8b4';
            ctx.font = '10px "Press Start 2P"';
            const companyLines = wrapText(ctx, company, 170, currentY, 380, 15);
            currentY += companyLines * 15 + 15;
        }

        // Draw stats
        let statValue = 0;
        let statLabel = '';
        let statColor = '';

        if (activeFilter === 'public') {
            statValue = dev.publicContributions;
            statLabel = 'Public Contributions';
            statColor = '#8ceb34';
        } else if (activeFilter === 'total') {
            statValue = dev.privateContributions + dev.publicContributions;
            statLabel = 'Total Contributions';
            statColor = '#ff5555';
        } else {
            statValue = dev.followers;
            statLabel = 'Followers';
            statColor = '#b967ff';
        }

        // Draw stat bar (pixel art style)
        const barWidth = 300;
        const barHeight = 20;
        ctx.fillStyle = '#222323';
        ctx.globalAlpha = 0.96; // Slightly transparent to let map show through
        ctx.fillRect(150, currentY, barWidth, barHeight);
        ctx.globalAlpha = 1.0;

        // Calculate percentage (max 100%)
        let percentage = 0;
        if (activeFilter === 'public') {
            percentage = Math.min(100, (statValue / 2000) * 100);
        } else if (activeFilter === 'total') {
            percentage = Math.min(100, (statValue / 3000) * 100);
        } else {
            percentage = Math.min(100, (statValue / 1000) * 100);
        }

        // Fill stat bar with gradient
        const barGradient = ctx.createLinearGradient(150, 0, 150 + barWidth, 0);
        barGradient.addColorStop(0, statColor);
        barGradient.addColorStop(1, '#44a9fb');
        ctx.fillStyle = barGradient;
        ctx.fillRect(150, currentY, barWidth * (percentage / 100), barHeight);

        // Draw stat value
        ctx.fillStyle = '#f5f6fa';
        ctx.font = '12px "Press Start 2P"';
        ctx.fillText(`${statLabel}: ${statValue}`, 150, currentY + barHeight + 20);

        // Draw CodeMapper watermark
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.font = '10px "Press Start 2P"';
        ctx.fillText('CodeMapper', 40, canvas.height - 40);

        // Load and draw avatar
        loadAndDrawAvatar();
    }

    // Load and draw the avatar
    function loadAndDrawAvatar() {
        const avatar = new Image();
        avatar.crossOrigin = "Anonymous";

        avatar.onload = function() {
            // Draw avatar background with pixel art border
            ctx.fillStyle = '#222323';
            ctx.globalAlpha = 0.96; // Slightly transparent to let map show through
            ctx.fillRect(40, 120, 90, 90);
            ctx.globalAlpha = 1.0;

            // Draw the avatar with pixelation effect
            ctx.imageSmoothingEnabled = false; // Disable smoothing for pixel art effect
            ctx.drawImage(avatar, 40, 120, 90, 90);
            ctx.imageSmoothingEnabled = true;

            finishAndDownload();
        };

        avatar.onerror = function() {
            console.error('Failed to load avatar');
            // Draw placeholder avatar (pixel art face)
            ctx.fillStyle = '#44a9fb';
            ctx.globalAlpha = 0.96;
            ctx.fillRect(40, 120, 90, 90);
            ctx.globalAlpha = 1.0;

            // Draw pixel art face
            ctx.fillStyle = '#222323';
            // Eyes
            ctx.fillRect(60, 145, 10, 10);
            ctx.fillRect(100, 145, 10, 10);
            // Mouth
            ctx.fillRect(70, 170, 30, 5);

            finishAndDownload();
        };

        // Start loading avatar
        avatar.src = dev.avatarUrl;
    }

    // Function to finish the process and download
    function finishAndDownload() {
        try {
            // Convert canvas to image
            const imgData = canvas.toDataURL('image/png');

            // Create download link
            const downloadLink = document.createElement('a');
            downloadLink.href = imgData;
            downloadLink.download = `${dev.login}_${countryName}_${activeFilter}_rank${ranking}.png`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        } catch (error) {
            console.error('Error creating download:', error);
        } finally {
            // Remove the loading alert
            const alertOverlay = document.querySelector('.pixel-alert-overlay');
            if (alertOverlay) {
                document.body.removeChild(alertOverlay);
            }
        }
    }
}

// Share on Twitter
function shareOnTwitter(dev, ranking, countryName) {
    const name = dev.name !== "undefined value" ? dev.name : dev.login;
    let statValue = 0;
    let statLabel = '';
    
    if (activeFilter === 'public') {
        statValue = dev.publicContributions;
        statLabel = 'Public Contributions';
    } else if (activeFilter === 'total') {
        statValue = dev.privateContributions + dev.publicContributions;
        statLabel = 'Total Contributions';
    } else {
        statValue = dev.followers;
        statLabel = 'Followers';
    }
    
    const tweetText = encodeURIComponent(
        `${name} is ranked #${ranking} in ${countryName} with ${statValue} ${statLabel}! #CodeMapper #DevRanking`
    );
    
    window.open(`https://twitter.com/intent/tweet?text=${tweetText}`, '_blank');
}

// Share on LinkedIn
function shareOnLinkedIn(dev, ranking, countryName) {
    const name = dev.name !== "undefined value" ? dev.name : dev.login;
    let statValue = 0;
    let statLabel = '';
    
    if (activeFilter === 'public') {
        statValue = dev.publicContributions;
        statLabel = 'Public Contributions';
    } else if (activeFilter === 'total') {
        statValue = dev.privateContributions + dev.publicContributions;
        statLabel = 'Total Contributions';
    } else {
        statValue = dev.followers;
        statLabel = 'Followers';
    }
    
    // Simple text for LinkedIn
    const shareText = `${name} is ranked #${ranking} in ${countryName} with ${statValue} ${statLabel}! #CodeMapper #DevRanking`;
    
    // LinkedIn's simplest sharing method - just share the text (no preview)
    const url = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(shareText)}`;
    
    // Try to open a new window with the sharing URL
    try {
        // Show a loading message
        showPixelAlert("Opening LinkedIn...");
        
        // Open LinkedIn in a new window
        const linkedinWindow = window.open(url, '_blank');
        
        // Close the alert after a short delay
        setTimeout(() => {
            const alertOverlay = document.querySelector('.pixel-alert-overlay');
            if (alertOverlay) {
                document.body.removeChild(alertOverlay);
            }
            
            // Provide fallback if window was blocked
            if (!linkedinWindow || linkedinWindow.closed || typeof linkedinWindow.closed === 'undefined') {
                console.log("LinkedIn window may have been blocked");
                // Show instructions as fallback
                showPixelAlert(`Please copy and share on LinkedIn: ${shareText}`);
            }
        }, 1500);
    } catch (error) {
        console.error("Error sharing to LinkedIn:", error);
        // Show manual copy option as fallback
        const textToCopy = shareText;
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                showPixelAlert("Text copied! Please paste it on LinkedIn manually.");
            })
            .catch(err => {
                showPixelAlert(`Please share this text on LinkedIn: ${shareText}`);
            });
    }
}

// Close the country panel
function closeCountryPanel() {
    const detailsPanel = document.getElementById('details-panel');
    const countryName = document.getElementById('country-name').textContent;
    
    // Remove highlight from the country
    highlightCountry(countryName, false);
    
    // Hide the panel
    detailsPanel.classList.remove('visible');
}

// Populate developer cards based on country and active filter
function populateDevCards(countryName) {
    const cardsContainer = document.getElementById('dev-cards-container');
    cardsContainer.innerHTML = '';
    
    // Find the country data
    const countryData = developerData.find(country => country.country === countryName);
    
    if (!countryData || !countryData.developers || countryData.developers.length === 0) {
        // Empty state without the suggestion to contribute
        cardsContainer.innerHTML = `
            <div class="no-data-message">
                <p>No developer data available for ${countryName}.</p>
            </div>
        `;
        return;
    }
    
    // Sort developers based on active filter
    const sortedDevs = [...countryData.developers].sort((a, b) => {
        if (activeFilter === 'public') {
            return b.publicContributions - a.publicContributions;
        } else if (activeFilter === 'total') {
            return b.totalContributions - a.totalContributions;
        } else {
            return b.followers - a.followers;
        }
    });
    
    // Create a card for each developer
    sortedDevs.forEach(dev => {
        const card = document.createElement('div');
        card.className = 'dev-card';
        
        // Calculate percentage for stat bars
        const publicPercentage = Math.min(100, (dev.publicContributions / 2000) * 100);
        const totalPercentage = Math.min(100, (dev.totalContributions / 3000) * 100);
        const followersPercentage = Math.min(100, (dev.followers / 1000) * 100);
        
        card.innerHTML = `
            <img src="${dev.avatar}" alt="${dev.name}" class="dev-avatar">
            <div class="dev-info">
                <div class="dev-name">${dev.name}</div>
                <div class="dev-handle">@${dev.handle}</div>
                <div class="dev-location">${dev.location}</div>
                
                <div class="dev-stats">
                    <div class="stat-label">Public Contributions</div>
                    <div class="stat-bar">
                        <div class="stat-bar-fill" style="width: ${publicPercentage}%"></div>
                    </div>
                    
                    <div class="stat-label">Total Contributions</div>
                    <div class="stat-bar">
                        <div class="stat-bar-fill" style="width: ${totalPercentage}%"></div>
                    </div>
                    
                    <div class="stat-label">Followers</div>
                    <div class="stat-bar">
                        <div class="stat-bar-fill" style="width: ${followersPercentage}%"></div>
                    </div>
                </div>
                
                <div class="dev-social">
                    <a href="https://twitter.com/${dev.twitter}" target="_blank">
                        <img src="/static/images/twitter-pixel.svg" alt="Twitter" class="social-icon">
                    </a>
                    <a href="https://github.com/${dev.handle}" target="_blank">
                        <img src="/static/images/github-pixel.png" alt="GitHub" class="social-icon">
                    </a>
                </div>
            </div>
        `;
        
        cardsContainer.appendChild(card);
        
        // Stagger the animation of cards
        setTimeout(() => {
            card.style.opacity = 1;
        }, 100 * cardsContainer.children.length);
    });
} 