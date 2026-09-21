export function renderProps(selectedInst, container, onChange, onDelete) {
    container.innerHTML = '';
    if (!selectedInst) {
        container.innerHTML = '<div style="color:#666; text-align:center; margin-top:20px; font-size:11px;">Select an object.</div>';
        return;
    }

    const schema = {
        "Folder": { props: ["name"] },
        "VectorPart": { props: ["name", "Type", "X", "Y", "W", "H", "Color", "FilterID"] },
        "RigidBody": { props: ["name", "IsStatic", "ColliderW", "ColliderH", "VelocityX", "VelocityY", "Mass", "Bounciness"] },
        "Camera": { props: ["name", "Zoom"] },
        "Script": { props: ["name"] },
        "SVGFilter": { props: ["name", "Type", "Amount"] },
        "ParticleEmitter": { props: ["name", "Rate", "Speed"] },
        "SVGNode": { props: ["name", "Tag", "TextContent"] },
        "UIGradient": { props: ["name", "Type"] },
        "UIStroke": { props: ["name", "Color", "Width", "Opacity", "LineCap", "LineJoin", "DashArray", "DashOffset"] },
        "Pattern": { props: ["name", "Width", "Height", "Transform", "Units"] },
        "Animation": { props: ["name"] }
    };

    // 2. Safe Fallback logic
    const typeData = schema[selectedInst.className] || { props: ["name"] };
    const props = typeData.props;

    const title = document.createElement('div');
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '10px';
    title.style.color = '#fff';
    title.innerText = `${selectedInst.className} Properties`;
    container.appendChild(title);

    props.forEach(prop => {
        const row = document.createElement('div');
        row.className = 'prop-row';
        
        const label = document.createElement('span');
        label.innerText = prop;
        
        let input = document.createElement('input');
        
        if (prop === 'Type' && selectedInst.className === 'VectorPart') {
            input = document.createElement('select');
            ['rect', 'circle'].forEach(opt => {
                const o = document.createElement('option');
                o.value = opt; o.innerText = opt;
                if(selectedInst[prop] === opt) o.selected = true;
                input.appendChild(o);
            });
        } else if (prop === 'Type' && selectedInst.className === 'UIGradient') {
            input = document.createElement('select');
            ['Linear', 'Radial'].forEach(opt => {
                const o = document.createElement('option');
                o.value = opt; o.innerText = opt;
                if(selectedInst[prop] === opt) o.selected = true;
                input.appendChild(o);
            });
        } else if (prop === 'LineCap' && selectedInst.className === 'UIStroke') {
            input = document.createElement('select');
            ['butt', 'round', 'square'].forEach(opt => {
                const o = document.createElement('option');
                o.value = opt; o.innerText = opt;
                if(selectedInst[prop] === opt) o.selected = true;
                input.appendChild(o);
            });
        } else if (prop === 'LineJoin' && selectedInst.className === 'UIStroke') {
            input = document.createElement('select');
            ['miter', 'round', 'bevel'].forEach(opt => {
                const o = document.createElement('option');
                o.value = opt; o.innerText = opt;
                if(selectedInst[prop] === opt) o.selected = true;
                input.appendChild(o);
            });
        } else if (prop === 'Color') {
            input.type = 'color';
            input.value = selectedInst[prop] || '#000000';
        } else if (typeof selectedInst[prop] === 'boolean') {
            input.type = 'checkbox';
            input.checked = selectedInst[prop];
        } else {
            input.type = 'text';
            input.value = selectedInst[prop] !== undefined ? selectedInst[prop] : '';
        }
        
        input.onchange = (e) => {
            if (input.type === 'checkbox') selectedInst[prop] = e.target.checked;
            else if (input.type === 'color') selectedInst[prop] = e.target.value;
            else if (!isNaN(e.target.value) && e.target.value.trim() !== '') selectedInst[prop] = parseFloat(e.target.value);
            else selectedInst[prop] = e.target.value;
            onChange();
        };
        
        input.id = `prop-live-${prop}`;
        row.appendChild(label);
        row.appendChild(input);
        container.appendChild(row);
    });

    if (selectedInst.className === "SVGNode" && selectedInst.Attributes) {
        const attrTitle = document.createElement('div');
        attrTitle.style.fontWeight = 'bold';
        attrTitle.style.margin = '15px 0 5px 0';
        attrTitle.style.color = '#888';
        attrTitle.innerText = `Raw Attributes`;
        container.appendChild(attrTitle);

        for (const [key, val] of Object.entries(selectedInst.Attributes)) {
            const row = document.createElement('div');
            row.className = 'prop-row';
            row.innerHTML = `<span style="color:#aaa;">${key}</span> <input type="text" value="${val.replace(/"/g, '&quot;')}" readonly style="background:#222; color:#777; width:60%;">`;
            container.appendChild(row);
        }
    }
    
    if (selectedInst.className === "UIGradient" && selectedInst.ColorStops && Array.isArray(selectedInst.ColorStops)) {
        const stopsTitle = document.createElement('div');
        stopsTitle.style.fontWeight = 'bold';
        stopsTitle.style.margin = '15px 0 5px 0';
        stopsTitle.style.color = '#888';
        stopsTitle.innerText = `Color Stops`;
        container.appendChild(stopsTitle);

        selectedInst.ColorStops.forEach((stop, idx) => {
            const row = document.createElement('div');
            row.className = 'prop-row';
            row.innerHTML = `<span style="color:#aaa;">${idx}</span> <input type="text" value="offset:${stop.offset} color:${stop.color}" readonly style="background:#222; color:#777; width:60%;">`;
            container.appendChild(row);
        });
    }
    
    if (selectedInst.className === "Animation" && selectedInst.CSSText) {
        const cssTitle = document.createElement('div');
        cssTitle.style.fontWeight = 'bold';
        cssTitle.style.margin = '15px 0 5px 0';
        cssTitle.style.color = '#888';
        cssTitle.innerText = `CSS Animation Text`;
        container.appendChild(cssTitle);

        const textarea = document.createElement('textarea');
        textarea.value = selectedInst.CSSText;
        textarea.style.width = '100%';
        textarea.style.height = '200px';
        textarea.style.background = '#222';
        textarea.style.color = '#777';
        textarea.style.fontFamily = 'monospace';
        textarea.style.fontSize = '10px';
        textarea.readOnly = true;
        container.appendChild(textarea);
    }

    const delBtn = document.createElement('button');
    delBtn.innerText = "Delete Object";
    delBtn.style.marginTop = "15px";
    delBtn.style.width = "100%";
    delBtn.style.background = "#c0392b";
    delBtn.onclick = () => onDelete(selectedInst);
    container.appendChild(delBtn);
}

export function updateLiveProps(selectedInst) {
    if (!selectedInst) return;
    const liveProps = ["X", "Y", "VelocityX", "VelocityY"];
    liveProps.forEach(prop => {
        const el = document.getElementById(`prop-live-${prop}`);
        if (el && document.activeElement !== el) {
            el.value = selectedInst[prop] !== undefined ? parseFloat(selectedInst[prop]).toFixed(2) : '';
        }
    });
}
