// /engine-root/js/studio/Viewport.js
export function saveSVG(workspace, svgElement) {
    const jsonState = JSON.stringify(workspace.serialize());
    const rawSVG = svgElement.outerHTML;
    
    // Inject custom metadata tag containing project state
    const exportData = rawSVG.replace('</svg>', `<metadata data-engine-state='${jsonState}'></metadata></svg>`);
    
    const blob = new Blob([exportData], {type: 'image/svg+xml'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `project_${Date.now()}.svg`;
    a.click();
}

export function loadSVG(file, onLoaded) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(e.target.result, "image/svg+xml");
        const metadata = doc.querySelector('metadata[data-engine-state]');
        
        if (metadata) {
            const state = JSON.parse(metadata.getAttribute('data-engine-state'));
            onLoaded(state);
        }
    };
    reader.readAsText(file);
}