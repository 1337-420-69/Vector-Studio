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

    let contextMenu = null;
    let draggedNode = null;
    let renameInput = null;

    const closeContextMenu = () => {
        if (contextMenu) {
            contextMenu.remove();
            contextMenu = null;
        }
    };

    const isDescendantOf = (node, potentialAncestor) => {
        let current = node;
        while (current) {
            if (current === potentialAncestor) return true;
            current = current.parent;
        }
        return false;
    };

    const showContextMenu = (inst, x, y) => {
        closeContextMenu();
        onSelect(inst);

        const menu = document.createElement('div');
        menu.style.position = 'fixed';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.style.background = '#2d2d2d';
        menu.style.border = '1px solid #555';
        menu.style.borderRadius = '4px';
        menu.style.padding = '4px 0';
        menu.style.zIndex = '10000';
        menu.style.minWidth = '150px';
        menu.style.boxShadow = '0 4px 8px rgba(0,0,0,0.5)';

        const addItem = (label, action, disabled = false) => {
            const item = document.createElement('div');
            item.textContent = label;
            item.style.padding = '6px 12px';
            item.style.cursor = disabled ? 'not-allowed' : 'pointer';
            item.style.fontSize = '12px';
            item.style.color = disabled ? '#666' : '#ccc';
            if (!disabled) {
                item.onmouseover = () => item.style.background = '#404040';
                item.onmouseout = () => item.style.background = 'transparent';
                item.onclick = () => {
                    action();
                    closeContextMenu();
                };
            }
            menu.appendChild(item);
        };

        const isRoot = inst === workspace;

        addItem('Add Child', () => {
            const { Instance } = window;
            const newFolder = new Instance('Folder', 'Folder');
            inst.addChild(newFolder);
            onSelect(newFolder);
        });

        addItem('Group', () => {
            const { Instance } = window;
            const newFolder = new Instance('Folder', 'Folder');
            const parent = inst.parent;
            const index = parent.children.indexOf(inst);
            parent.removeChild(inst);
            newFolder.addChild(inst);
            parent.children.splice(index, 0, newFolder);
            newFolder.parent = parent;
            onSelect(newFolder);
        }, isRoot);

        addItem('Delete', () => {
            if (inst.parent) {
                inst.parent.removeChild(inst);
                if (selectedNode && selectedNode.uuid === inst.uuid) {
                    onSelect(null);
                }
            }
        }, isRoot);

        addItem('Rename', () => {
            startRename(inst);
        });

        contextMenu = menu;
        document.body.appendChild(menu);

        const closeOnClickOutside = (e) => {
            if (!menu.contains(e.target)) {
                closeContextMenu();
                document.removeEventListener('click', closeOnClickOutside);
            }
        };
        setTimeout(() => document.addEventListener('click', closeOnClickOutside), 0);
    };

    const startRename = (inst) => {
        const treeItems = container.querySelectorAll('.tree-item');
        let targetEl = null;
        treeItems.forEach(el => {
            if (el._instance === inst) targetEl = el;
        });
        if (!targetEl) return;

        const nameSpan = targetEl.querySelector('span:last-child');
        if (!nameSpan) return;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = inst.name;
        input.style.background = '#3c3c3c';
        input.style.border = '1px solid #007acc';
        input.style.color = 'white';
        input.style.padding = '2px 4px';
        input.style.borderRadius = '3px';
        input.style.fontSize = '12px';
        input.style.width = '120px';

        const confirm = () => {
            if (input.value.trim()) {
                inst.name = input.value.trim();
                onSelect(inst);
            }
            renameInput = null;
        };

        const cancel = () => {
            onSelect(inst);
            renameInput = null;
        };

        input.onkeydown = (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') confirm();
            if (e.key === 'Escape') cancel();
        };

        input.onblur = confirm;

        nameSpan.replaceWith(input);
        input.focus();
        input.select();
        renameInput = input;
    };

    const walk = (inst, parentElement) => {
        const el = document.createElement('div');
        const isSelected = (selectedNode && selectedNode.uuid === inst.uuid);
        
        const icon = icons[inst.className] || "📄"; 
        
        el.className = `tree-item ${isSelected ? 'selected' : ''}`;
        el.innerHTML = `<span>${icon}</span> <span>${inst.name}</span>`;
        el._instance = inst;
        
        el.onclick = (e) => {
            e.stopPropagation();
            onSelect(inst);
        };

        el.oncontextmenu = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showContextMenu(inst, e.clientX, e.clientY);
        };

        el.draggable = true;

        el.ondragstart = (e) => {
            draggedNode = inst;
            e.dataTransfer.effectAllowed = 'move';
            el.style.opacity = '0.5';
        };

        el.ondragend = (e) => {
            el.style.opacity = '1';
            draggedNode = null;
            document.querySelectorAll('.tree-item').forEach(item => {
                item.classList.remove('drop-target');
            });
        };

        el.ondragover = (e) => {
            if (!draggedNode || draggedNode === inst || isDescendantOf(inst, draggedNode)) {
                return;
            }
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        };

        el.ondragenter = (e) => {
            if (!draggedNode || draggedNode === inst || isDescendantOf(inst, draggedNode)) {
                return;
            }
            e.preventDefault();
            el.classList.add('drop-target');
        };

        el.ondragleave = (e) => {
            if (e.target === el) {
                el.classList.remove('drop-target');
            }
        };

        el.ondrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            el.classList.remove('drop-target');

            if (!draggedNode || draggedNode === inst || isDescendantOf(inst, draggedNode)) {
                return;
            }

            const rect = el.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const height = rect.height;
            const topThird = height / 3;
            const bottomThird = height * 2 / 3;

            if (draggedNode.parent) {
                draggedNode.parent.removeChild(draggedNode);
            }

            if (y < topThird) {
                const parent = inst.parent;
                const index = parent.children.indexOf(inst);
                parent.children.splice(index, 0, draggedNode);
                draggedNode.parent = parent;
            } else if (y > bottomThird) {
                const parent = inst.parent;
                const index = parent.children.indexOf(inst);
                parent.children.splice(index + 1, 0, draggedNode);
                draggedNode.parent = parent;
            } else {
                inst.addChild(draggedNode);
            }

            onSelect(draggedNode);
        };
        
        parentElement.appendChild(el);

        if (inst.children && inst.children.length > 0) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = "tree-node";
            inst.children.forEach(child => walk(child, childrenContainer));
            parentElement.appendChild(childrenContainer);
        }
    };

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeContextMenu();
        }
    });

    walk(workspace, container);
}
