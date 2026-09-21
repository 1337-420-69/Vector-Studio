import { Instance } from '../core/Instance.js';

export function syncDOM(engine) {
    engine.DOM.root.innerHTML = '';
    engine.DOM.defs.innerHTML = '';
    engine.DOM.debug.innerHTML = '';

    const walk = (inst, parentNode) => {
        let node = parentNode;
        
        // Generic Figma SVG Node Renderer
        if (inst.className === "SVGNode") {
            node = document.createElementNS("http://www.w3.org/2000/svg", inst.Tag);
            node.id = inst.uuid;
            
            if (inst.Attributes) {
                for (const [key, val] of Object.entries(inst.Attributes)) {
                    node.setAttribute(key, val);
                }
            }
            
            if (inst.TextContent) {
                node.textContent = inst.TextContent;
            }
            
            if (!engine.IsPlaying) {
                node.style.cursor = "pointer";
                node.onclick = (e) => { e.stopPropagation(); engine.select(inst); };
                if (engine.Selected === inst) {
                    node.style.outline = "2px dashed #00ff00"; // Outline used instead of stroke to preserve complex paths
                }
            }
            
            // Route definitions to <defs>, renderable graphics to <g> root
            const defTags = ['defs', 'mask', 'clippath', 'lineargradient', 'radialgradient', 'pattern', 'filter'];
            if (defTags.includes(inst.Tag.toLowerCase())) {
                engine.DOM.defs.appendChild(node);
            } else {
                parentNode.appendChild(node);
            }
        }

        // Legacy / Engine Primitive Renderer
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

        // Debug RigidBody rendering
        if (engine.DebugMode && inst.className === "RigidBody" && inst.parent) {
            const dbg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            const w = inst.ColliderW || (inst.parent.W || 50);
            const h = inst.ColliderH || (inst.parent.H || 50);
            // Default assumes engine primitives; for SVGNodes user must manually align physics
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

export async function exportHTML(workspace) {
    const allJS = await bundleAllJavaScript();
    
    const jsonState = JSON.stringify(workspace.serialize());
    
    let htmlTemplate = document.documentElement.outerHTML;
    
    htmlTemplate = htmlTemplate.replace(
        '<script type="module" src="js/main.js"></script>',
        `<script>
window.IS_EXPORT = true;
window.EXPORT_DATA = ${jsonState};

${allJS}
<\/script>`
    );
    
    htmlTemplate = htmlTemplate.replace('<body', '<body class="export-mode"');
    
    const blob = new Blob([htmlTemplate], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `GameExport_${Date.now()}.html`;
    a.click();
}

async function bundleAllJavaScript() {
    const modules = [
        'js/core/Instance.js',
        'js/systems/Physics.js',
        'js/systems/Camera.js',
        'js/systems/Particles.js',
        'js/systems/ScriptEngine.js'
    ];
    
    const sources = await Promise.all(
        modules.map(path => fetch(path).then(res => res.text()))
    );
    
    let bundle = '(function() {\n"use strict";\n\n';
    
    sources.forEach((source, index) => {
        let cleaned = source
            .replace(/export\s+(function|const|class|async\s+function)/g, '$1')
            .replace(/export\s*\{[^}]*\};?/g, '')
            .replace(/import\s+\{[^}]*\}\s+from\s+['"][^'"]+['"];?\n?/g, '')
            .replace(/import\s+[^\s]+\s+from\s+['"][^'"]+['"];?\n?/g, '');
        
        bundle += `// ===== ${modules[index]} =====\n`;
        bundle += cleaned + '\n\n';
    });
    
    bundle += `// ===== syncDOM (Runtime Renderer) =====\n`;
    bundle += `function syncDOM(engine) {
    engine.DOM.root.innerHTML = '';
    engine.DOM.defs.innerHTML = '';
    if (engine.DOM.debug) engine.DOM.debug.innerHTML = '';

    const walk = (inst, parentNode) => {
        let node = parentNode;
        
        if (inst.className === "SVGNode") {
            node = document.createElementNS("http://www.w3.org/2000/svg", inst.Tag);
            node.id = inst.uuid;
            
            if (inst.Attributes) {
                for (const [key, val] of Object.entries(inst.Attributes)) {
                    node.setAttribute(key, val);
                }
            }
            
            if (inst.TextContent) {
                node.textContent = inst.TextContent;
            }
            
            const defTags = ['defs', 'mask', 'clippath', 'lineargradient', 'radialgradient', 'pattern', 'filter'];
            if (defTags.includes(inst.Tag.toLowerCase())) {
                engine.DOM.defs.appendChild(node);
            } else {
                parentNode.appendChild(node);
            }
        }

        if (inst.className === "SVGFilter") {
            const flt = document.createElementNS("http://www.w3.org/2000/svg", "filter");
            flt.id = inst.uuid;
            if (inst.Type === "Blur") {
                flt.innerHTML = \`<feGaussianBlur stdDeviation="\${inst.Amount}"/>\`;
            } else if (inst.Type === "Glow") {
                flt.innerHTML = \`<feGaussianBlur stdDeviation="\${inst.Amount}" result="coloredBlur"/><feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>\`;
            }
            engine.DOM.defs.appendChild(flt);
        }
        
        if (inst.className === "VectorPart") {
            node = document.createElementNS("http://www.w3.org/2000/svg", inst.Type === "circle" ? "circle" : "rect");
            node.id = inst.uuid;
            node.setAttribute('fill', inst.Color);
            if (inst.FilterID) node.setAttribute('filter', \`url(#\${inst.FilterID})\`);
            
            if (inst.Type === "circle") {
                node.setAttribute('cx', inst.X);
                node.setAttribute('cy', inst.Y);
                node.setAttribute('r', inst.W/2);
            } else {
                node.setAttribute('x', inst.X - inst.W/2);
                node.setAttribute('y', inst.Y - inst.H/2);
                node.setAttribute('width', inst.W);
                node.setAttribute('height', inst.H);
            }
            parentNode.appendChild(node);
        }

        inst.children.forEach(c => walk(c, node));
    };
    
    engine.Workspace.children.forEach(c => walk(c, engine.DOM.root));
}\n\n`;
    
    bundle += `// ===== Engine Runtime =====\n`;
    bundle += `const Engine = {\n`;
    bundle += `  Workspace: new Instance("Workspace", "Folder"),\n`;
    bundle += `  IsPlaying: false,\n`;
    bundle += `  Selected: null,\n`;
    bundle += `  StateSnapshot: null,\n`;
    bundle += `  ParticleState: { pool: [], active: [] },\n`;
    bundle += `  DOM: {},\n`;
    bundle += `  Bus: new EventTarget(),\n`;
    bundle += `  Input: { keys: new Set(), isPressed: (k) => Engine.Input.keys.has(k.toLowerCase()) },\n\n`;
    
    bundle += `  init() {\n`;
    bundle += `    this.DOM = {\n`;
    bundle += `      svg: document.getElementById('game-svg'),\n`;
    bundle += `      root: document.getElementById('world-root'),\n`;
    bundle += `      defs: document.getElementById('engine-defs'),\n`;
    bundle += `      particles: document.getElementById('particle-root'),\n`;
    bundle += `      debug: document.getElementById('debug-root'),\n`;
    bundle += `      console: document.getElementById('console-overlay')\n`;
    bundle += `    };\n\n`;
    
    bundle += `    if (window.EXPORT_DATA) {\n`;
    bundle += `      this.Workspace = Instance.deserialize(window.EXPORT_DATA);\n`;
    bundle += `    }\n\n`;
    
    bundle += `    window.addEventListener('keydown', e => this.Input.keys.add(e.key.toLowerCase()));\n`;
    bundle += `    window.addEventListener('keyup', e => this.Input.keys.delete(e.key.toLowerCase()));\n\n`;
    
    bundle += `    syncDOM(this);\n`;
    bundle += `    if (window.IS_EXPORT) setTimeout(() => this.play(), 100);\n`;
    bundle += `  },\n\n`;
    
    bundle += `  play() {\n`;
    bundle += `    this.StateSnapshot = this.Workspace.serialize();\n`;
    bundle += `    this.IsPlaying = true;\n`;
    bundle += `    this.Bus = new EventTarget();\n`;
    bundle += `    Instance.findDeep(this.Workspace, "AudioSource").forEach(a => {\n`;
    bundle += `      a._audio = new Audio(a.Src);\n`;
    bundle += `      if (a.PlayOnStart) a._audio.play();\n`;
    bundle += `    });\n`;
    bundle += `    injectScripts(this.Workspace, this.Bus, this.Input, (m, c) => this.log(m, c));\n`;
    bundle += `    this.emit('Init');\n`;
    bundle += `    this.ParticleState = initParticlePool(this.DOM.particles);\n`;
    bundle += `    this.lastTime = performance.now();\n`;
    bundle += `    this.loop = requestAnimationFrame((t) => this.tick(t));\n`;
    bundle += `  },\n\n`;
    
    bundle += `  tick(time) {\n`;
    bundle += `    if (!this.IsPlaying) return;\n`;
    bundle += `    const dt = (time - this.lastTime) / 1000;\n`;
    bundle += `    this.lastTime = time;\n`;
    bundle += `    this.emit('Update', dt);\n`;
    bundle += `    stepPhysics(this.Workspace);\n`;
    bundle += `    stepParticles(this.Workspace, this.ParticleState);\n`;
    bundle += `    updateCamera(this.Workspace, this.DOM.svg);\n`;
    bundle += `    syncDOM(this);\n`;
    bundle += `    this.loop = requestAnimationFrame((t) => this.tick(t));\n`;
    bundle += `  },\n\n`;
    
    bundle += `  emit(evt, data) {\n`;
    bundle += `    this.Bus.dispatchEvent(new CustomEvent(evt, { detail: data }));\n`;
    bundle += `  },\n\n`;
    
    bundle += `  log(msg, cls) {\n`;
    bundle += `    if (!this.DOM.console) return;\n`;
    bundle += `    const el = document.createElement('div');\n`;
    bundle += `    el.className = cls;\n`;
    bundle += `    el.innerText = '> ' + msg;\n`;
    bundle += `    this.DOM.console.appendChild(el);\n`;
    bundle += `    this.DOM.console.scrollTop = this.DOM.console.scrollHeight;\n`;
    bundle += `  },\n\n`;
    
    bundle += `  select(inst) { this.Selected = inst; }\n`;
    bundle += `};\n\n`;
    
    bundle += `window.addEventListener('DOMContentLoaded', () => Engine.init());\n`;
    bundle += '})();\n';
    
    return bundle;
}

// Full 1:1 Universal SVG Importer for Figma files
export function importRawSVG(file, onCompleteCb) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(e.target.result, "image/svg+xml");
        
        const cleanName = file.name.replace(/\.[^/.]+$/, "");
        const rootFolder = new Instance(`Asset_${cleanName}`, "Folder");

        const parseNode = (svgNode, parentInst) => {
            if (svgNode.nodeType !== 1) return; // Skip non-elements (text nodes, comments)
            if (svgNode.tagName.toLowerCase() === 'svg') {
                Array.from(svgNode.children).forEach(child => parseNode(child, parentInst));
                return;
            }

            const tag = svgNode.tagName;
            const inst = new Instance(svgNode.id || tag, "SVGNode");
            inst.Tag = tag;
            inst.Attributes = {};
            
            // Extract every raw attribute (d-paths, stroke-width, matrices, mask refs)
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
