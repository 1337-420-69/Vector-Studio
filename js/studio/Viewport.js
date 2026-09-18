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
            node.id = inst.uuid;
            
            if (inst.Attributes) {
                for (const [key, val] of Object.entries(inst.Attributes)) {
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
            
            if (inst.Type === "circle") {
                node.setAttribute('cx', inst.X); node.setAttribute('cy', inst.Y); node.setAttribute('r', inst.W/2);
            } else {
                node.setAttribute('x', inst.X - inst.W/2); node.setAttribute('y', inst.Y - inst.H/2);
                node.setAttribute('width', inst.W); node.setAttribute('height', inst.H);
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
            const w = inst.ColliderW || (inst.parent.W || 50);
            const h = inst.ColliderH || (inst.parent.H || 50);
            const x = (inst.parent.X || 0) - w/2;
            const y = (inst.parent.Y || 0) - h/2;
            
            dbg.setAttribute('x', x); dbg.setAttribute('y', y);
            dbg.setAttribute('width', w); dbg.setAttribute('height', h);
            dbg.setAttribute('fill', 'none'); dbg.setAttribute('stroke', '#f00'); 
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
            
            // Retain all raw attributes including embedded base64 image hrefs
            Array.from(svgNode.attributes).forEach(attr => {
                if (attr.name !== 'id') inst.Attributes[attr.name] = attr.value;
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
