import { Schema } from '../core/Instance.js';

export function renderProps(selectedInst, containerEl, onPropChangeCb, onDeleteCb) {
    if (window.IS_EXPORT) return;
    containerEl.innerHTML = '';
    if (!selectedInst) return;

    const makeRow = (lbl, inputHTML) => `<div class="prop-row"><label>${lbl}</label>${inputHTML}</div>`;
    
    let html = makeRow("Name", `<input id="prop-name" type="text" value="${selectedInst.name}">`);
    
    Schema[selectedInst.className].props.forEach(p => {
        if (p.type === "code") return;
        if (p.opts) {
            let opts = p.opts.map(o => `<option value="${o}" ${selectedInst[p.n] === o ? 'selected' : ''}>${o}</option>`).join('');
            html += makeRow(p.n, `<select id="prop-${p.n}">${opts}</select>`);
        } else if (p.type === "bool") {
            html += makeRow(p.n, `<input id="prop-${p.n}" type="checkbox" ${selectedInst[p.n] ? 'checked' : ''}>`);
        } else if (p.type === "color") {
            html += makeRow(p.n, `<input id="prop-${p.n}" type="color" value="${selectedInst[p.n]}">`);
        } else {
            html += makeRow(p.n, `<input id="prop-${p.n}" type="text" value="${selectedInst[p.n]}">`);
        }
    });

    html += `<button style="width:100%; margin-top:15px; background:#e74c3c;" id="btn-del">Delete</button>`;
    containerEl.innerHTML = html;

    document.getElementById('prop-name').oninput = e => { 
        selectedInst.name = e.target.value; 
        onPropChangeCb('name'); 
    };

    Schema[selectedInst.className].props.forEach(p => {
        if (p.type === "code") return;
        const input = document.getElementById(`prop-${p.n}`);
        input.onchange = e => {
            selectedInst[p.n] = p.type === "bool" ? e.target.checked : (p.type === "text" || p.type === "color" || p.opts ? e.target.value : parseFloat(e.target.value));
            onPropChangeCb(p.n);
        };
    });

    document.getElementById('btn-del').onclick = () => onDeleteCb(selectedInst);
}

export function updateLiveProps(selectedInst) {
    if (!selectedInst || window.IS_EXPORT) return;
    const schema = Schema[selectedInst.className];
    if (!schema) return;

    schema.props.forEach(p => {
        if (p.type === "code") return;
        const el = document.getElementById(`prop-${p.n}`);
        if (!el || document.activeElement === el) return; 

        if (p.type === "bool") {
            el.checked = selectedInst[p.n];
        } else {
            el.value = selectedInst[p.n];
        }
    });
}