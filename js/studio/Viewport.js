import { Instance } from '../core/Instance.js';

export function syncDOM(engine) {
    // ... (Keep existing syncDOM code untouched)
    engine.DOM.root.innerHTML = '';
    engine.DOM.defs.innerHTML = '';
    engine.DOM.debug.innerHTML = '';

    const walk = (inst, parentNode) => {
        let node = parentNode;
        
        if (inst.className === "SVGFilter") {
            const flt = document.createElementNS("http://www.w3.org/2000/svg", "filter");
            flt.id = inst.uuid;
            if (inst.Type === "Blur") {
                flt.innerHTML = `<feGaussianBlur stdDeviation="${inst.Amount}"/>`;
            } else if (inst.Type === "Glow") {
                flt.innerHTML = `<feGaussianBlur stdDeviation="${inst.Amount}" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>`;
            }
            engine.DOM.defs.appendChild(flt);
        }
        
        if (inst.className === "VectorPart") {
            node = document.createElementNS("http://www.w3.org/2000/svg", inst.Type === "circle" ? "circle" : "rect");
            node.id = inst.uuid;
            node.setAttribute('fill', inst.Color);
            if (inst.FilterID) node.setAttribute('filter', `url(#${inst.FilterID})`);
            
            if (inst.Type === "circle") {
                node.setAttribute('cx', inst.X); node.setAttribute('cy', inst.Y); node.setAttribute('r', inst.W/2);
            } else {
                node.setAttribute('x', inst.X - inst.W/2); node.setAttribute('y', inst.Y - inst.H/2);
                node.setAttribute('width', inst.W); node.setAttribute('height', inst.H);
            }
            
            if (!engine.IsPlaying) {
                node.style.cursor = "pointer";
                node.onclick = (e) => { e.stopPropagation(); engine.select(inst); };
                if (engine.Selected === inst) {
                    node.style.stroke = "#0f0";
                    node.style.strokeWidth = "2";
                }
            }
            parentNode.appendChild(node);
        }

        if (engine.DebugMode && inst.className === "RigidBody" && inst.parent && inst.parent.className === "VectorPart") {
            const dbg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            dbg.setAttribute('x', inst.parent.X - inst.ColliderW/2); 
            dbg.setAttribute('y', inst.parent.Y - inst.ColliderH/2);
            dbg.setAttribute('width', inst.ColliderW); 
            dbg.setAttribute('height', inst.ColliderH);
            dbg.setAttribute('fill', 'none'); 
            dbg.setAttribute('stroke', '#f00'); 
            dbg.setAttribute('stroke-width', '1.5');
            engine.DOM.debug.appendChild(dbg);
        }

        inst.children.forEach(c => walk(c, node));
    };
    
    engine.Workspace.children.forEach(c => walk(c, engine.DOM.root));
}

export function saveProjectSVG(workspace, svgElement) {
    // ... (Keep existing saveProjectSVG code untouched)
    const jsonState = JSON.stringify(workspace.serialize());
    const cloneSVG = svgElement.cloneNode(true);
    
    let metadata = cloneSVG.querySelector('metadata#engine-data');
    if (!metadata) {
        metadata = document.createElementNS("http://www.w3.org/2000/svg", "metadata");
        metadata.id = "engine-data";
        cloneSVG.appendChild(metadata);
    }
    metadata.textContent = jsonState;

    const xmlSerializer = new XMLSerializer();
    const svgString = xmlSerializer.serializeToString(cloneSVG);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `project_${Date.now()}.svg`;
    a.click();
}

export function loadProjectSVG(file, onCompleteCb) {
    // ... (Keep existing loadProjectSVG code untouched)
    const reader = new FileReader();
    reader.onload = (e) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(e.target.result, "image/svg+xml");
        const metadata = doc.querySelector('metadata#engine-data');
        if (metadata && metadata.textContent) {
            const parsedData = JSON.parse(metadata.textContent);
            onCompleteCb(parsedData);
        } else {
            alert("No embedded engine project state found in this SVG file!");
        }
    };
    reader.readAsText(file);
}

export function exportHTML(workspace) {
    // ... (Keep existing exportHTML code untouched)
    const rawHTML = document.documentElement.outerHTML;
    const jsonState = JSON.stringify(workspace.serialize());
    
    const exportContent = rawHTML
        .replace('</body>', `<script>window.IS_EXPORT=true; window.EXPORT_DATA=${jsonState};<\/script></body>`)
        .replace('<body', '<body class="export-mode"');
        
    const blob = new Blob([exportContent], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `GameExport_${Date.now()}.html`;
    a.click();
}

// --- NEW FEATURE: RAW SVG PARSER ---
export function importRawSVG(file, onCompleteCb) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(e.target.result, "image/svg+xml");
        
        const cleanName = file.name.replace(/\.[^/.]+$/, "");
        const rootFolder = new Instance(`Asset_${cleanName}`, "Folder");

        const parseNode = (svgNode, parentInst) => {
            if (svgNode.nodeType !== 1) return; // Skip non-elements (text, comments)
            
            const tag = svgNode.tagName.toLowerCase();
            let inst = null;
            
            if (tag === 'g' || tag === 'svg') {
                if (tag === 'g') {
                    inst = new Instance(svgNode.id || "Group", "Folder");
                    parentInst.addChild(inst);
                } else {
                    inst = parentInst; // Pass through root node directly
                }
                Array.from(svgNode.children).forEach(child => parseNode(child, inst));
            } 
            else if (tag === 'rect') {
                inst = new Instance(svgNode.id || "Rect", "VectorPart");
                inst.Type = "rect";
                
                const w = parseFloat(svgNode.getAttribute('width') || 50);
                const h = parseFloat(svgNode.getAttribute('height') || 50);
                const x = parseFloat(svgNode.getAttribute('x') || 0);
                const y = parseFloat(svgNode.getAttribute('y') || 0);
                
                inst.W = w; inst.H = h;
                inst.X = x + (w / 2); // Shift top-left to Engine's center coordinates
                inst.Y = y + (h / 2);
                inst.Color = svgNode.getAttribute('fill') || '#cccccc';
                
                parentInst.addChild(inst);
            }
            else if (tag === 'circle' || tag === 'ellipse') {
                inst = new Instance(svgNode.id || "Circle", "VectorPart");
                inst.Type = "circle";
                
                // Average radii if it's an ellipse, otherwise use standard r
                const r = parseFloat(svgNode.getAttribute('r') || svgNode.getAttribute('rx') || 25); 
                const cx = parseFloat(svgNode.getAttribute('cx') || 0);
                const cy = parseFloat(svgNode.getAttribute('cy') || 0);
                
                inst.W = r * 2; inst.H = r * 2; // Engine defines circle size via bounding width/height
                inst.X = cx; inst.Y = cy;
                inst.Color = svgNode.getAttribute('fill') || '#cccccc';
                
                parentInst.addChild(inst);
            }
        };

        parseNode(doc.documentElement, rootFolder);
        onCompleteCb(rootFolder);
    };
    reader.readAsText(file);
}
