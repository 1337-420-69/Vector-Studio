// /engine-root/js/core/Instance.js
export const Schema = {
    Folder: { icon: "📁", props: [] },
    VectorPart: { icon: "🖌️", props: [{ n: "X", v: 400 }, { n: "Y", v: 300 }] }, // ... other props
    // ... other schemas
};

export class Instance {
    constructor(name, className) {
        this.uuid = 'id_' + Math.random().toString(36).substr(2, 9);
        this.name = name;
        this.className = className;
        this.children = [];
        this.parent = null;
        
        const schema = Schema[className];
        if (schema) schema.props.forEach(p => this[p.n] = p.v);
    }
    // ... addChild, removeChild, serialize, deserialize
}