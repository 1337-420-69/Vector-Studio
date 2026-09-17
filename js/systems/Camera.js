import { Instance } from '../core/Instance.js';

export function updateCamera(workspace, svgElement) {
    const cam = Instance.findDeep(workspace, "Camera").find(c => c.IsActive);
    if (cam) {
        let tx = cam.parent ? cam.parent.X : cam.X;
        let ty = cam.parent ? cam.parent.Y : cam.Y;
        
        const vW = 800 / cam.Zoom; 
        const vH = 600 / cam.Zoom;
        svgElement.setAttribute('viewBox', `${tx - vW/2} ${ty - vH/2} ${vW} ${vH}`);
    }
}