/**
 * Ship Manager Module
 * Handles loading and managing EVE ship models
 */

class ShipManager {
    constructor() {
        this.ships = [];
        this.currentIndex = 0;
        this.loadTimer = null;
    }

    /**
     * Load ships from a list of URLs or local paths
     * @param {Array<string>} shipPaths - Array of paths to .glb files
     */
    setShips(shipPaths) {
        this.ships = shipPaths || [];
        this.currentIndex = 0;
    }

    /**
     * Get the next ship to display
     * @returns {string} Path to the next ship model
     */
    getNextShip() {
        if (this.ships.length === 0) {
            return null;
        }
        const ship = this.ships[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.ships.length;
        return ship;
    }

    /**
     * Get current ship
     * @returns {string} Path to current ship model
     */
    getCurrentShip() {
        if (this.ships.length === 0) {
            return null;
        }
        return this.ships[this.currentIndex];
    }

    /**
     * Get ship by index
     * @param {number} index - Index of ship
     * @returns {string} Path to ship model
     */
    getShipByIndex(index) {
        if (index < 0 || index >= this.ships.length) {
            return null;
        }
        return this.ships[index];
    }

    /**
     * Get all loaded ships
     * @returns {Array<string>} Array of all ship paths
     */
    getAllShips() {
        return [...this.ships];
    }

    /**
     * Get number of ships
     * @returns {number} Count of ships
     */
    getShipCount() {
        return this.ships.length;
    }

    /**
     * Shuffle ship order
     */
    shuffleShips() {
        for (let i = this.ships.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.ships[i], this.ships[j]] = [this.ships[j], this.ships[i]];
        }
        this.currentIndex = 0;
    }

    /**
     * Load default EVE ships from the gallery
     * This populates with a sample of popular EVE ships
     */
    loadDefaultShips() {
        const baseUrl = 'https://raw.githubusercontent.com/EstamelGG/EVE_Model_Gallery/main/docs/models/';
        
        // Sample of popular EVE ships to start with
        const defaultShips = [
            '582_lite.glb',      // Rifter
            '587_lite.glb',      // Atron
            '629_lite.glb',      // Vexor
            '621_lite.glb',      // Merlin
            '1944_lite.glb',     // Velator
            '2006_lite.glb',     // Catalyst
            '29984_lite.glb',    // Tengu
            '29986_lite.glb',    // Legion
            '29988_lite.glb',    // Proteus
            '29990_lite.glb',    // Loki
        ];

        this.ships = defaultShips.map(ship => baseUrl + ship);
        this.currentIndex = 0;
    }
}

export default ShipManager;
