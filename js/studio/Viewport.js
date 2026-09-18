import { Instance } from '../core/Instance.js';

export function syncDOM(engine) {
    engine.DOM.root.innerHTML = '';
    engine.DOM.defs.innerHTML = '';
    engine.DOM.debug.innerHTML = '';

    const walk = (inst, parentNode) => {
        let node = parentNode;
        
        // Generic & Raster SVG Node Renderer
        if (inst.className === "SVGNode") {
            node = document.createElementNS("http://www.w3.org/2000/svg", inst.Tag);
            
            // CRITICAL FIX: Preserve original Figma IDs for internal SVG referencing (e.g. fill="url(#id)")
            node.id = (inst.Attributes && inst.Attributes.id) ? inst.Attributes.id : inst.uuid;
            
            if (inst.Attributes) {
                for (const [key, val] of Object.entries(inst.Attributes)) {
                    if (key === 'id') continue; // Already set above
                    
                    // Handle XML namespaces for embedded PNGs and xlink references
                    if (key.includes(':')) {
                        const parts = key.split(':');
                        if (parts[0] === 'xlink') {
                            node.setAttributeNS("http://www.w3.org/1999/xlink", parts[1], val);
                        } else {
                            node.setAttribute(key, val);
                        }
                    } else {
                        node.setAttribute(key, val);
                    }
                }
            }
            
            if (inst.TextContent) {
                node.textContent = inst.TextContent;
            }
            
            if (!engine.IsPlaying) {
                node.style.cursor = "pointer";
                node.onclick = (e) => { e.stopPropagation(); engine.select(inst); };
                if (engine.Selected === inst) {
                    node.style.outline = "2px dashed #00ff00";
                }
            }
            
            // Route definitions to <defs>, renderable graphics/images to scene root
            const defTags = ['defs', 'mask', 'clippath', 'lineargradient', 'radialgradient', 'pattern', 'filter'];
            if (defTags.includes(inst.Tag.toLowerCase())) {
                engine.DOM.defs.appendChild(node);
            } else {
                parentNode.appendChild(node);
            }
        }

        // Engine Primitive Renderer
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
            
            // CRITICAL FIX: Safe numeric casting to prevent NaN layout crashes during physics simulation
            const ix = Number(inst.X) || 0;
            const iy = Number(inst.Y) || 0;
            const iw = Number(inst.W) || 0;
            const ih = Number(inst.H) || 0;

            if (inst.Type === "circle") {
                node.setAttribute('cx', ix); 
                node.setAttribute('cy', iy); 
                node.setAttribute('r', iw/2);
            } else {
                node.setAttribute('x', ix - iw/2); 
                node.setAttribute('y', iy - ih/2);
                node.setAttribute('width', iw); 
                node.setAttribute('height', ih);
            }
            
            if (!engine.IsPlaying) {
                node.style.cursor = "pointer";
                node.onclick = (e) => { e.stopPropagation(); engine.select(inst); };
                if (engine.Selected === inst) node.style.stroke = "#0f0";
            }
            parentNode.appendChild(node);
        }

        // Debug Physics Rendering
        if (engine.DebugMode && inst.className === "RigidBody" && inst.parent) {
            const dbg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            
            const w = Number(inst.ColliderW !== undefined ? inst.ColliderW : inst.parent.W) || 50;
            const h = Number(inst.ColliderH !== undefined ? inst.ColliderH : inst.parent.H) || 50;
            const px = Number(inst.parent.X) || 0;
            const py = Number(inst.parent.Y) || 0;
            
            dbg.setAttribute('x', px - w/2); 
            dbg.setAttribute('y', py - h/2);
            dbg.setAttribute('width', w); 
            dbg.setAttribute('height', h);
            dbg.setAttribute('fill', 'none'); 
            dbg.setAttribute('stroke', '#f00'); 
            engine.DOM.debug.appendChild(dbg);
        }

        inst.children.forEach(c => walk(c, node));
    };
    
    engine.Workspace.children.forEach(c => walk(c, engine.DOM.root));
}

export function saveProjectSVG(workspace, svgElement) {
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
    const reader = new FileReader();
    reader.onload = (e) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(e.target.result, "image/svg+xml");
        const metadata = doc.querySelector('metadata#engine-data');
        if (metadata && metadata.textContent) {
            onCompleteCb(JSON.parse(metadata.textContent));
        } else {
            alert("No embedded engine project state found in this SVG file.");
        }
    };
    reader.readAsText(file);
}

export function exportHTML(workspace) {
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

export function importRawSVG(file, onCompleteCb) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(e.target.result, "image/svg+xml");
        
        const cleanName = file.name.replace(/\.[^/.]+$/, "");
        const rootFolder = new Instance(`Asset_${cleanName}`, "Folder");

        const parseNode = (svgNode, parentInst) => {
            if (svgNode.nodeType !== 1) return;
            if (svgNode.tagName.toLowerCase() === 'svg') {
                Array.from(svgNode.children).forEach(child => parseNode(child, parentInst));
                return;
            }

            const tag = svgNode.tagName;
            const inst = new Instance(svgNode.id || tag, "SVGNode");
            inst.Tag = tag;
            inst.Attributes = {};
            
            // FIX: Retain ALL raw attributes including 'id'. 
            // Figma relies heavily on ID matching for patterns and images to render!
            Array.from(svgNode.attributes).forEach(attr => {
                inst.Attributes[attr.name] = attr.value;
            });

            if (svgNode.children.length === 0 && svgNode.textContent.trim() !== '') {
                inst.TextContent = svgNode.textContent.trim();
            }
            
            parentInst.addChild(inst);
            Array.from(svgNode.children).forEach(child => parseNode(child, inst));
        };

        parseNode(doc.documentElement, rootFolder);
        onCompleteCb(rootFolder);
    };
    reader.readAsText(file);
}
