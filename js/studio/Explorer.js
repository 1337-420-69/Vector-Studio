import { Schema } from '../core/Instance.js';

export function renderTree(workspace, selectedInst, containerEl, onSelectCb) {
    if (window.IS_EXPORT) return;
    containerEl.innerHTML = '';
    
    const walk = (inst, target) => {
        const wrap = document.createElement('div'); 
        wrap.className = 'tree-node';
        
        const el = document.createElement('div');
        el.className = `tree-item ${selectedInst === inst ? 'selected' : ''}`;
        el.innerHTML = `${Schema[inst.className].icon} ${inst.name}`;
        el.onclick = (e) => { 
            e.stopPropagation(); 
            onSelectCb(inst); 
        };
        
        wrap.appendChild(el);
        inst.children.forEach(c => walk(c, wrap));
        target.appendChild(wrap);
    };

    walk(workspace, containerEl);
}