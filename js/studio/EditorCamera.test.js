import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EditorCamera } from './EditorCamera.js';

describe('EditorCamera', () => {
    let viewport, svg, camera;

    beforeEach(() => {
        viewport = document.createElement('div');
        viewport.style.position = 'absolute';
        viewport.style.left = '0px';
        viewport.style.top = '0px';
        viewport.style.width = '800px';
        viewport.style.height = '600px';
        document.body.appendChild(viewport);

        viewport.getBoundingClientRect = vi.fn(() => ({
            left: 0,
            top: 0,
            right: 800,
            bottom: 600,
            width: 800,
            height: 600
        }));

        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        viewport.appendChild(svg);

        camera = new EditorCamera(viewport, svg);
    });

    afterEach(() => {
        camera.destroy();
        document.body.removeChild(viewport);
    });

    describe('Initialization', () => {
        it('should initialize with default values', () => {
            expect(camera.x).toBe(400);
            expect(camera.y).toBe(300);
            expect(camera.zoom).toBe(1.0);
            expect(camera.zoomSensitivity).toBe(1.0);
        });

        it('should set initial viewBox on SVG', () => {
            const viewBox = svg.getAttribute('viewBox');
            expect(viewBox).toBe('0 0 800 600');
        });
    });

    describe('Middle mouse drag panning (scaled by 1/zoom)', () => {
        it('should pan camera with middle mouse drag scaled by 1/zoom', () => {
            camera.zoom = 2.0;
            camera.updateViewBox();

            const mouseDown = new MouseEvent('mousedown', {
                button: 1,
                clientX: 400,
                clientY: 300,
                bubbles: true
            });
            viewport.dispatchEvent(mouseDown);

            const mouseMove = new MouseEvent('mousemove', {
                clientX: 450,
                clientY: 350,
                bubbles: true
            });
            document.dispatchEvent(mouseMove);

            expect(camera.x).toBe(400 - 50 * (1 / 2.0));
            expect(camera.y).toBe(300 - 50 * (1 / 2.0));

            const mouseUp = new MouseEvent('mouseup', {
                button: 1,
                bubbles: true
            });
            document.dispatchEvent(mouseUp);
        });

        it('should not pan when middle mouse is not pressed', () => {
            const initialX = camera.x;
            const initialY = camera.y;

            const mouseMove = new MouseEvent('mousemove', {
                clientX: 450,
                clientY: 350,
                bubbles: true
            });
            document.dispatchEvent(mouseMove);

            expect(camera.x).toBe(initialX);
            expect(camera.y).toBe(initialY);
        });
    });

    describe('Scroll wheel zooming', () => {
        it('should zoom in with scroll up (multiplicative, factor 1.1)', () => {
            const initialZoom = camera.zoom;
            
            const wheelEvent = new WheelEvent('wheel', {
                deltaY: -100,
                clientX: 400,
                clientY: 300,
                bubbles: true
            });
            viewport.dispatchEvent(wheelEvent);

            expect(camera.zoom).toBeCloseTo(initialZoom * 1.1, 5);
        });

        it('should zoom out with scroll down', () => {
            const initialZoom = camera.zoom;
            
            const wheelEvent = new WheelEvent('wheel', {
                deltaY: 100,
                clientX: 400,
                clientY: 300,
                bubbles: true
            });
            viewport.dispatchEvent(wheelEvent);

            expect(camera.zoom).toBeCloseTo(initialZoom / 1.1, 5);
        });

        it('should clamp zoom between 0.1 and 10.0', () => {
            camera.zoom = 0.15;
            
            for (let i = 0; i < 10; i++) {
                const wheelEvent = new WheelEvent('wheel', {
                    deltaY: 100,
                    clientX: 400,
                    clientY: 300,
                    bubbles: true
                });
                viewport.dispatchEvent(wheelEvent);
            }

            expect(camera.zoom).toBeGreaterThanOrEqual(0.1);
            expect(camera.zoom).toBe(0.1);

            camera.zoom = 9.5;
            
            for (let i = 0; i < 10; i++) {
                const wheelEvent = new WheelEvent('wheel', {
                    deltaY: -100,
                    clientX: 400,
                    clientY: 300,
                    bubbles: true
                });
                viewport.dispatchEvent(wheelEvent);
            }

            expect(camera.zoom).toBeLessThanOrEqual(10.0);
            expect(camera.zoom).toBe(10.0);
        });
    });

    describe('Ctrl+scroll for faster zoom', () => {
        it('should apply 2.0 multiplier with Ctrl+scroll', () => {
            camera.zoom = 1.0;
            camera.zoomSensitivity = 1.0;

            const wheelEvent = new WheelEvent('wheel', {
                deltaY: -100,
                ctrlKey: true,
                clientX: 400,
                clientY: 300,
                bubbles: true
            });
            viewport.dispatchEvent(wheelEvent);

            const expectedZoom = 1.0 * Math.pow(1.1, 2.0);
            expect(camera.zoom).toBeCloseTo(expectedZoom, 5);
        });
    });

    describe('Alt+scroll for zoomSensitivity adjustment', () => {
        it('should adjust zoomSensitivity with Alt+scroll', () => {
            camera.zoomSensitivity = 1.0;

            const wheelEvent = new WheelEvent('wheel', {
                deltaY: -100,
                altKey: true,
                clientX: 400,
                clientY: 300,
                bubbles: true
            });
            viewport.dispatchEvent(wheelEvent);

            expect(camera.zoomSensitivity).toBe(1.1);
        });

        it('should clamp zoomSensitivity between 0.1 and 5.0', () => {
            camera.zoomSensitivity = 0.2;

            for (let i = 0; i < 5; i++) {
                const wheelEvent = new WheelEvent('wheel', {
                    deltaY: 100,
                    altKey: true,
                    clientX: 400,
                    clientY: 300,
                    bubbles: true
                });
                viewport.dispatchEvent(wheelEvent);
            }

            expect(camera.zoomSensitivity).toBe(0.1);

            camera.zoomSensitivity = 4.9;

            for (let i = 0; i < 5; i++) {
                const wheelEvent = new WheelEvent('wheel', {
                    deltaY: -100,
                    altKey: true,
                    clientX: 400,
                    clientY: 300,
                    bubbles: true
                });
                viewport.dispatchEvent(wheelEvent);
            }

            expect(camera.zoomSensitivity).toBe(5.0);
        });

        it('should not affect zoom when adjusting sensitivity', () => {
            const initialZoom = camera.zoom;

            const wheelEvent = new WheelEvent('wheel', {
                deltaY: -100,
                altKey: true,
                clientX: 400,
                clientY: 300,
                bubbles: true
            });
            viewport.dispatchEvent(wheelEvent);

            expect(camera.zoom).toBe(initialZoom);
        });
    });

    describe('Ctrl+middle drag for fixed pan', () => {
        it('should pan at 1px-per-world-unit ratio with Ctrl+middle drag', () => {
            camera.zoom = 2.0;
            camera.updateViewBox();

            const mouseDown = new MouseEvent('mousedown', {
                button: 1,
                ctrlKey: true,
                clientX: 400,
                clientY: 300,
                bubbles: true
            });
            viewport.dispatchEvent(mouseDown);

            const mouseMove = new MouseEvent('mousemove', {
                clientX: 450,
                clientY: 350,
                bubbles: true
            });
            document.dispatchEvent(mouseMove);

            expect(camera.x).toBe(400 - 50);
            expect(camera.y).toBe(300 - 50);

            const mouseUp = new MouseEvent('mouseup', {
                button: 1,
                bubbles: true
            });
            document.dispatchEvent(mouseUp);
        });
    });

    describe('WASD camera movement', () => {
        it('should move camera with WASD keys at 300 units/sec', async () => {
            vi.useFakeTimers();
            camera.bindKeyEvents();

            const keyDown = new KeyboardEvent('keydown', {
                key: 'w',
                bubbles: true
            });
            document.dispatchEvent(keyDown);

            await vi.advanceTimersByTimeAsync(100);

            const expectedY = 300 - 300 * 0.1;
            expect(camera.y).toBeCloseTo(expectedY, -1);

            const keyUp = new KeyboardEvent('keyup', {
                key: 'w',
                bubbles: true
            });
            document.dispatchEvent(keyUp);

            camera.unbindKeyEvents();
            vi.useRealTimers();
        });

        it('should handle all WASD directions', async () => {
            vi.useFakeTimers();
            camera.bindKeyEvents();

            const keys = [
                { key: 'w', axis: 'y', delta: -30 },
                { key: 's', axis: 'y', delta: 30 },
                { key: 'a', axis: 'x', delta: -30 },
                { key: 'd', axis: 'x', delta: 30 }
            ];

            for (const { key, axis, delta } of keys) {
                const initialValue = camera[axis];

                const keyDown = new KeyboardEvent('keydown', {
                    key,
                    bubbles: true
                });
                document.dispatchEvent(keyDown);

                await vi.advanceTimersByTimeAsync(100);

                expect(camera[axis]).toBeCloseTo(initialValue + delta, -1);

                const keyUp = new KeyboardEvent('keyup', {
                    key,
                    bubbles: true
                });
                document.dispatchEvent(keyUp);
            }

            camera.unbindKeyEvents();
            vi.useRealTimers();
        });
    });

    describe('Viewport bounds checking', () => {
        it('should ignore events outside viewport', () => {
            const initialZoom = camera.zoom;

            const wheelEvent = new WheelEvent('wheel', {
                deltaY: -100,
                clientX: 1000,
                clientY: 1000,
                bubbles: true
            });
            viewport.dispatchEvent(wheelEvent);

            expect(camera.zoom).toBe(initialZoom);
        });

        it('should not start drag outside viewport', () => {
            const initialX = camera.x;

            const mouseDown = new MouseEvent('mousedown', {
                button: 1,
                clientX: 1000,
                clientY: 1000,
                bubbles: true
            });
            viewport.dispatchEvent(mouseDown);

            const mouseMove = new MouseEvent('mousemove', {
                clientX: 1050,
                clientY: 1050,
                bubbles: true
            });
            document.dispatchEvent(mouseMove);

            expect(camera.x).toBe(initialX);
        });
    });

    describe('Focus loss handling', () => {
        it('should cancel drag on window blur', () => {
            const mouseDown = new MouseEvent('mousedown', {
                button: 1,
                clientX: 400,
                clientY: 300,
                bubbles: true
            });
            viewport.dispatchEvent(mouseDown);

            expect(camera.isDragging).toBe(true);

            const blurEvent = new Event('blur');
            window.dispatchEvent(blurEvent);

            expect(camera.isDragging).toBe(false);
        });
    });

    describe('State preservation', () => {
        it('should save and restore camera state', () => {
            camera.x = 500;
            camera.y = 400;
            camera.zoom = 2.5;
            camera.zoomSensitivity = 1.5;

            const state = camera.saveState();

            camera.x = 100;
            camera.y = 100;
            camera.zoom = 0.5;
            camera.zoomSensitivity = 0.5;

            camera.restoreState(state);

            expect(camera.x).toBe(500);
            expect(camera.y).toBe(400);
            expect(camera.zoom).toBe(2.5);
            expect(camera.zoomSensitivity).toBe(1.5);
        });
    });
});
