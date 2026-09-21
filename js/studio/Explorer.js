export function renderTree(workspace, selectedNode, container, onSelect) {
    container.innerHTML = '';
    
    const icons = {
        "Folder": "📁",
        "VectorPart": "🟦",
        "RigidBody": "🍎",
        "Camera": "🎥",
        "Script": "📜",
        "SVGFilter": "✨",
        "ParticleEmitter": "🎇",
        "SVGNode": "🎨",
        "UIGradient": "🌈",
        "UIStroke": "✏️",
        "Pattern": "🔲",
        "Animation": "⚡"
    };

    const walk = (inst, parentElement) => {
        const el = document.createElement('div');
        const isSelected = (selectedNode && selectedNode.uuid === inst.uuid);
        
        // Use dictionary icon, fallback to generic page if class is unknown
        const icon = icons[inst.className] || "📄"; 
        
        el.className = `tree-item ${isSelected ? 'selected' : ''}`;
        el.innerHTML = `<span>${icon}</span> <span>${inst.name}</span>`;
        
        el.onclick = (e) => {
            e.stopPropagation();
            onSelect(inst);
        };
        
        parentElement.appendChild(el);

        // Recursively render children indented
        if (inst.children && inst.children.length > 0) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = "tree-node";
            inst.children.forEach(child => walk(child, childrenContainer));
            parentElement.appendChild(childrenContainer);
        }
    };

    walk(workspace, container);
}
