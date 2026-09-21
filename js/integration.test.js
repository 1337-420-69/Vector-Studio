import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorCamera } from './studio/EditorCamera.js';

describe('Integration: Editor Camera with Engine Lifecycle', () => {
    let viewport, svg, editorCamera, savedState;

    beforeEach(() => {
        viewport = document.createElement('div');
        viewport.getBoundingClientRect = vi.fn(() => ({
            left: 0,
            top: 0,
            right: 800,
            bottom: 600,
            width: 800,
            height: 600
        }));
        document.body.appendChild(viewport);

        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        viewport.appendChild(svg);

        editorCamera = new EditorCamera(viewport, svg);
    });

    it('should preserve camera state across play/stop transitions', () => {
        editorCamera.x = 500;
        editorCamera.y = 400;
        editorCamera.zoom = 2.5;
        editorCamera.zoomSensitivity = 1.5;
        editorCamera.updateViewBox();
        editorCamera.bindKeyEvents();

        savedState = editorCamera.saveState();
        
        expect(savedState.x).toBe(500);
        expect(savedState.y).toBe(400);
        expect(savedState.zoom).toBe(2.5);
        expect(savedState.zoomSensitivity).toBe(1.5);

        editorCamera.unbindKeyEvents();

        editorCamera.x = 100;
        editorCamera.y = 100;
        editorCamera.zoom = 0.5;
        editorCamera.zoomSensitivity = 0.5;
        editorCamera.updateViewBox();

        editorCamera.restoreState(savedState);
        editorCamera.bindKeyEvents();

        expect(editorCamera.x).toBe(500);
        expect(editorCamera.y).toBe(400);
        expect(editorCamera.zoom).toBe(2.5);
        expect(editorCamera.zoomSensitivity).toBe(1.5);

        editorCamera.destroy();
        document.body.removeChild(viewport);
    });

    it('should maintain separate camera instances', () => {
        const camera1 = new EditorCamera(viewport, svg);
        
        const viewport2 = document.createElement('div');
        viewport2.getBoundingClientRect = vi.fn(() => ({
            left: 0,
            top: 0,
            right: 800,
            bottom: 600,
            width: 800,
            height: 600
        }));
        document.body.appendChild(viewport2);
        const svg2 = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        viewport2.appendChild(svg2);
        const camera2 = new EditorCamera(viewport2, svg2);

        camera1.x = 100;
        camera1.zoom = 2.0;
        camera2.x = 500;
        camera2.zoom = 0.5;

        expect(camera1.x).toBe(100);
        expect(camera1.zoom).toBe(2.0);
        expect(camera2.x).toBe(500);
        expect(camera2.zoom).toBe(0.5);

        camera1.destroy();
        camera2.destroy();
        document.body.removeChild(viewport2);
        document.body.removeChild(viewport);
    });

    it('should handle rapid mode switches', () => {
        editorCamera.x = 300;
        editorCamera.y = 200;
        editorCamera.zoom = 1.5;
        editorCamera.bindKeyEvents();

        for (let i = 0; i < 5; i++) {
            const state = editorCamera.saveState();
            editorCamera.unbindKeyEvents();
            
            editorCamera.x = Math.random() * 800;
            editorCamera.y = Math.random() * 600;
            editorCamera.zoom = Math.random() * 5;
            
            editorCamera.restoreState(state);
            editorCamera.bindKeyEvents();
        }

        expect(editorCamera.x).toBe(300);
        expect(editorCamera.y).toBe(200);
        expect(editorCamera.zoom).toBe(1.5);

        editorCamera.destroy();
        document.body.removeChild(viewport);
    });
});
