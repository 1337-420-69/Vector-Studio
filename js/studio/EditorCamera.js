export class EditorCamera {
    constructor(viewportElement, svgElement) {
        this.viewport = viewportElement;
        this.svg = svgElement;
        
        this.x = 400;
        this.y = 300;
        this.zoom = 1.0;
        this.focusX = 400;
        this.focusY = 300;
        this.zoomSensitivity = 1.0;
        
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragMode = null;
        
        this.wasdKeys = { w: false, a: false, s: false, d: false };
        this.lastUpdateTime = performance.now();
        this.animationFrame = null;
        
        this.bindEvents();
        this.updateViewBox();
    }
    
    bindEvents() {
        this.onMouseDown = (e) => {
            if (e.button !== 1) return;
            if (!this.isEventInViewport(e)) return;
            
            e.preventDefault();
            this.isDragging = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.dragMode = e.ctrlKey ? 'fixed' : 'scaled';
        };
        
        this.onMouseMove = (e) => {
            if (!this.isDragging) return;
            
            e.preventDefault();
            const dx = e.clientX - this.dragStartX;
            const dy = e.clientY - this.dragStartY;
            
            if (this.dragMode === 'scaled') {
                const scale = 1 / this.zoom;
                this.x -= dx * scale;
                this.y -= dy * scale;
            } else if (this.dragMode === 'fixed') {
                this.x -= dx;
                this.y -= dy;
            }
            
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.updateViewBox();
        };
        
        this.onMouseUp = (e) => {
            if (e.button !== 1) return;
            this.isDragging = false;
            this.dragMode = null;
        };
        
        this.onWheel = (e) => {
            if (!this.isEventInViewport(e)) return;
            
            e.preventDefault();
            
            if (e.altKey) {
                const delta = Math.sign(e.deltaY) * 0.1;
                this.zoomSensitivity = Math.max(0.1, Math.min(5.0, this.zoomSensitivity - delta));
            } else {
                const baseFactor = 1.1;
                const multiplier = e.ctrlKey ? 2.0 : 1.0;
                const adjustedFactor = Math.pow(baseFactor, this.zoomSensitivity * multiplier);
                
                const zoomFactor = e.deltaY < 0 ? adjustedFactor : 1 / adjustedFactor;
                this.zoom = Math.max(0.1, Math.min(10.0, this.zoom * zoomFactor));
            }
            
            this.updateViewBox();
        };
        
        this.onKeyDown = (e) => {
            const key = e.key.toLowerCase();
            if (key in this.wasdKeys) {
                this.wasdKeys[key] = true;
                if (!this.animationFrame) {
                    this.lastUpdateTime = performance.now();
                    this.startWASDLoop();
                }
            }
        };
        
        this.onKeyUp = (e) => {
            const key = e.key.toLowerCase();
            if (key in this.wasdKeys) {
                this.wasdKeys[key] = false;
            }
        };
        
        this.onBlur = () => {
            this.isDragging = false;
            this.dragMode = null;
        };
        
        this.viewport.addEventListener('mousedown', this.onMouseDown);
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
        this.viewport.addEventListener('wheel', this.onWheel, { passive: false });
        window.addEventListener('blur', this.onBlur);
    }
    
    bindKeyEvents() {
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);
    }
    
    unbindKeyEvents() {
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
    }
    
    startWASDLoop() {
        const update = (time) => {
            const dt = (time - this.lastUpdateTime) / 1000;
            this.lastUpdateTime = time;
            
            const speed = 300;
            let moved = false;
            
            if (this.wasdKeys.w) { this.y -= speed * dt; moved = true; }
            if (this.wasdKeys.s) { this.y += speed * dt; moved = true; }
            if (this.wasdKeys.a) { this.x -= speed * dt; moved = true; }
            if (this.wasdKeys.d) { this.x += speed * dt; moved = true; }
            
            if (moved) {
                this.updateViewBox();
            }
            
            if (Object.values(this.wasdKeys).some(v => v)) {
                this.animationFrame = requestAnimationFrame(update);
            } else {
                this.animationFrame = null;
            }
        };
        
        this.animationFrame = requestAnimationFrame(update);
    }
    
    isEventInViewport(e) {
        const rect = this.viewport.getBoundingClientRect();
        return (
            e.clientX >= rect.left &&
            e.clientX <= rect.right &&
            e.clientY >= rect.top &&
            e.clientY <= rect.bottom
        );
    }
    
    updateViewBox() {
        const vW = 800 / this.zoom;
        const vH = 600 / this.zoom;
        this.svg.setAttribute('viewBox', `${this.x - vW/2} ${this.y - vH/2} ${vW} ${vH}`);
    }
    
    saveState() {
        return {
            x: this.x,
            y: this.y,
            zoom: this.zoom,
            focusX: this.focusX,
            focusY: this.focusY,
            zoomSensitivity: this.zoomSensitivity
        };
    }
    
    restoreState(state) {
        this.x = state.x;
        this.y = state.y;
        this.zoom = state.zoom;
        this.focusX = state.focusX;
        this.focusY = state.focusY;
        this.zoomSensitivity = state.zoomSensitivity;
        this.updateViewBox();
    }
    
    destroy() {
        this.viewport.removeEventListener('mousedown', this.onMouseDown);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
        this.viewport.removeEventListener('wheel', this.onWheel);
        window.removeEventListener('blur', this.onBlur);
        this.unbindKeyEvents();
        
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
    }
}
