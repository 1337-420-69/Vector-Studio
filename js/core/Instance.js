export const Schema = {
    Folder: { icon: "📁", props: [] },
    VectorPart: { icon: "🖌️", props: [
        { n: "X", v: 400 }, { n: "Y", v: 300 }, { n: "W", v: 50 }, { n: "H", v: 50 },
        { n: "Color", v: "#007acc", type: "color" }, { n: "FilterID", v: "", type: "text" }, { n: "Type", v: "rect", opts: ["rect", "circle"] }
    ]},
    RigidBody: { icon: "📦", props: [
        { n: "IsStatic", v: false, type: "bool" }, { n: "Mass", v: 1 }, 
        { n: "VelocityX", v: 0 }, { n: "VelocityY", v: 0 }, 
        { n: "GravityScale", v: 1 }, { n: "Bounciness", v: 0.2 },
        { n: "ColliderW", v: 50 }, { n: "ColliderH", v: 50 }
    ]},
    Camera: { icon: "🎥", props: [{ n: "X", v: 400 }, { n: "Y", v: 300 }, { n: "Zoom", v: 1 }, { n: "IsActive", v: true, type: "bool" }] },
    Script: { icon: "📜", props: [{ n: "Code", v: "// Game.on('Init', () => {});\n// Game.on('Update', (dt) => {});", type: "code" }] },
    SVGFilter: { icon: "✨", props: [{ n: "Type", v: "Glow", opts: ["Glow", "Blur"] }, { n: "Amount", v: 5 }] },
    ParticleEmitter: { icon: "🎆", props: [{ n: "Emitting", v: false, type: "bool" }, { n: "Rate", v: 2 }, { n: "Speed", v: 5 }, { n: "Color", v: "#ffeb3b", type: "color" }] },
    AudioSource: { icon: "🔊", props: [{ n: "Src", v: "https://actions.google.com/sounds/v1/alarms/beep_short.ogg", type: "text" }, { n: "PlayOnStart", v: false, type: "bool" }] },
    SVGNode: { icon: "🎨", props: [{ n: "Tag", v: "g", type: "text" }, { n: "Attributes", v: {}, type: "object" }, { n: "TextContent", v: "", type: "text" }] },
    UIGradient: { icon: "🌈", props: [
        { n: "Type", v: "Linear", opts: ["Linear", "Radial"] },
        { n: "ColorStops", v: [], type: "array" },
        { n: "Transform", v: "", type: "text" },
        { n: "Units", v: "objectBoundingBox", type: "text" },
        { n: "X1", v: "0%", type: "text" },
        { n: "Y1", v: "0%", type: "text" },
        { n: "X2", v: "100%", type: "text" },
        { n: "Y2", v: "0%", type: "text" },
        { n: "CX", v: "50%", type: "text" },
        { n: "CY", v: "50%", type: "text" },
        { n: "R", v: "50%", type: "text" }
    ]},
    UIStroke: { icon: "✏️", props: [
        { n: "Color", v: "#000000", type: "color" },
        { n: "Width", v: 1, type: "number" },
        { n: "Opacity", v: 1, type: "number" },
        { n: "LineCap", v: "butt", opts: ["butt", "round", "square"] },
        { n: "LineJoin", v: "miter", opts: ["miter", "round", "bevel"] },
        { n: "DashArray", v: "", type: "text" },
        { n: "DashOffset", v: 0, type: "number" }
    ]},
    Pattern: { icon: "🔲", props: [
        { n: "Width", v: 10, type: "number" },
        { n: "Height", v: 10, type: "number" },
        { n: "Transform", v: "", type: "text" },
        { n: "Units", v: "userSpaceOnUse", type: "text" },
        { n: "PatternContentUnits", v: "userSpaceOnUse", type: "text" },
        { n: "Content", v: "", type: "text" }
    ]},
    Animation: { icon: "⚡", props: [
        { n: "CSSText", v: "", type: "text" },
        { n: "Keyframes", v: {}, type: "object" }
    ]}
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

    addChild(child) { 
        child.parent = this; 
        this.children.push(child); 
    }

    removeChild(child) { 
        this.children = this.children.filter(c => c !== child); 
        child.parent = null; 
    }

    find(name) {
        const findHelper = (node, n) => {
            if (node.name === n) return node;
            for (let c of node.children) {
                let res = findHelper(c, n);
                if (res) return res;
            }
            return null;
        };
        return findHelper(this, name);
    }

    serialize() {
        const data = { uuid: this.uuid, name: this.name, className: this.className, props: {}, children: this.children.map(c => c.serialize()) };
        const schema = Schema[this.className];
        if (schema) {
            schema.props.forEach(p => data.props[p.n] = this[p.n]);
        } else {
            Object.keys(this).forEach(key => {
                if (key !== 'uuid' && key !== 'name' && key !== 'className' && key !== 'children' && key !== 'parent') {
                    data.props[key] = this[key];
                }
            });
        }
        return data;
    }

    static deserialize(data) {
        const inst = new Instance(data.name, data.className);
        inst.uuid = data.uuid;
        Object.assign(inst, data.props);
        data.children.forEach(c => inst.addChild(Instance.deserialize(c)));
        return inst;
    }

    static findDeep(root, className) {
        let res = [];
        if (root.className === className) res.push(root);
        root.children.forEach(c => res = res.concat(Instance.findDeep(c, className)));
        return res;
    }
}
