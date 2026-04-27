/**
 * Advanced Camera Controller
 * Handles various camera movement patterns and animations
 */

class CameraController {
    constructor(camera) {
        this.camera = camera;
        this.targetPosition = new THREE.Vector3();
        this.currentPattern = 'orbit';
        this.time = 0;
        this.speed = 1;
    }

    /**
     * Update camera based on current pattern
     * @param {number} deltaTime - Time elapsed since last frame in milliseconds
     */
    update(deltaTime) {
        this.time += deltaTime * this.speed;

        switch (this.currentPattern) {
            case 'orbit':
                this.updateOrbit();
                break;
            case 'carousel':
                this.updateCarousel();
                break;
            case 'showcase':
                this.updateShowcase();
                break;
            case 'examine':
                this.updateExamine();
                break;
            default:
                this.updateOrbit();
        }
    }

    /**
     * Circular orbit around the object
     */
    updateOrbit() {
        const radius = 50;
        const angle = (this.time * 0.0003) % (Math.PI * 2);
        
        this.camera.position.x = Math.cos(angle) * radius;
        this.camera.position.z = Math.sin(angle) * radius;
        this.camera.position.y = 20 + Math.sin(this.time * 0.0002) * 10;
        
        this.camera.lookAt(0, 5, 0);
    }

    /**
     * Carousel motion - figure-8 pattern
     */
    updateCarousel() {
        const time = this.time * 0.0002;
        const radius = 50;
        
        this.camera.position.x = Math.sin(time) * radius;
        this.camera.position.z = Math.sin(time * 2) * radius * 0.7;
        this.camera.position.y = 25 + Math.cos(time * 2) * 15;
        
        this.camera.lookAt(0, 5, 0);
    }

    /**
     * Showcase motion - smooth vertical and horizontal sweep
     */
    updateShowcase() {
        const time = this.time * 0.0002;
        const radius = 50;
        
        this.camera.position.x = Math.cos(time) * radius;
        this.camera.position.y = 15 + Math.sin(time * 0.5) * 25;
        this.camera.position.z = Math.sin(time * 0.5) * radius;
        
        this.camera.lookAt(0, 10, 0);
    }

    /**
     * Examine motion - close orbit with slight vertical movement
     */
    updateExamine() {
        const time = this.time * 0.0005;
        const radius = 30;
        
        this.camera.position.x = Math.cos(time) * radius;
        this.camera.position.z = Math.sin(time) * radius;
        this.camera.position.y = 10 + Math.sin(time * 2) * 5;
        
        this.camera.lookAt(0, 0, 0);
    }

    /**
     * Set camera movement pattern
     * @param {string} pattern - Pattern name: 'orbit', 'carousel', 'showcase', 'examine'
     */
    setPattern(pattern) {
        this.currentPattern = pattern;
        this.time = 0;
    }

    /**
     * Set animation speed multiplier
     * @param {number} speed - Speed multiplier (1 = normal)
     */
    setSpeed(speed) {
        this.speed = Math.max(0.1, Math.min(5, speed));
    }

    /**
     * Get available patterns
     * @returns {Array<string>} Available pattern names
     */
    getAvailablePatterns() {
        return ['orbit', 'carousel', 'showcase', 'examine'];
    }

    /**
     * Randomize to a random pattern
     */
    randomizePattern() {
        const patterns = this.getAvailablePatterns();
        const randomPattern = patterns[Math.floor(Math.random() * patterns.length)];
        this.setPattern(randomPattern);
    }
}

export default CameraController;
