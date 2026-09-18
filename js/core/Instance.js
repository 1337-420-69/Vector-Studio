// Internal Schema defining property persistence per instance class
const Schema = {
    Folder: { props: ["name"] },
    VectorPart: { props: ["name", "Type", "X", "Y", "W", "H", "Color", "FilterID"] },
    RigidBody: { props: ["name", "IsStatic", "ColliderW", "ColliderH", "VelocityX", "VelocityY", "Mass", "Bounciness"] },
    Camera: { props: ["name", "Zoom"] },
    Script: { props: ["name", "Code"] },
    SVGFilter: { props: ["name", "Type", "Amount"] },
    ParticleEmitter: { props: ["name", "Rate", "Speed"] },
    SVGNode: { props: ["name", "Tag", "Attributes", "TextContent"] } // Registered for Figma & Raster SVG imports
};

export class Instance {
    constructor(name = "NewNode", className = "Folder") {
        this.uuid = 'inst_' + Math.random().toString(36).substr(2, 9);
        this.name = name;
        this.className = className;
        this.parent = null;
        this.children = [];

        // Class-specific property initialization
        if (className === "VectorPart") {
            this.Type = "rect"; this.X = 0; this.Y = 0; this.W = 50; this.H = 50;
            this.Color = "#3498db"; this.FilterID = "";
        } else if (className === "RigidBody") {
            this.IsStatic = false; this.ColliderW = 50; this.ColliderH = 50;
            this.VelocityX = 0; this.VelocityY = 0; this.Mass = 1; this.Bounciness = 0.2;
        } else if (className === "Camera") {
            this.Zoom = 1;
        } else if (className === "Script") {
            this.Code = "// Game Logic\nGame.on('Update', (dt) => {\n\n});";
        } else if (className === "SVGFilter") {
            this.Type = "Blur"; this.Amount = 5;
        } else if (className === "ParticleEmitter") {
            this.Rate = 10; this.Speed = 2;
        } else if (className === "SVGNode") {
            this.Tag = "g";
            this.Attributes = {};
            this.TextContent = "";
        }
    }

    addChild(child) {
        if (child.parent) child.parent.removeChild(child);
        child.parent = this;
        this.children.push(child);
    }

    removeChild(child) {
        this.children = this.children.filter(c => c !== child);
        child.parent = null;
    }

    serialize() {
        // Fallback protects against custom/unknown runtime classes
        const classSchema = Schema[this.className] || { props: ["name"] };
        const data = {
            uuid: this.uuid,
            className: this.className,
            children: this.children.map(c => c.serialize())
        };

        classSchema.props.forEach(p => {
            if (p === 'Attributes' && typeof this[p] === 'object' && this[p] !== null) {
                data[p] = JSON.parse(JSON.stringify(this[p]));
            } else {
                data[p] = this[p];
            }
        });

        return data;
    }

    static deserialize(data) {
        const inst = new Instance(data.name || "Instance", data.className);
        inst.uuid = data.uuid || inst.uuid;

        const classSchema = Schema[data.className] || { props: ["name"] };
        classSchema.props.forEach(p => {
            if (data[p] !== undefined) {
                if (p === 'Attributes' && typeof data[p] === 'object') {
                    inst[p] = JSON.parse(JSON.stringify(data[p]));
                } else {
                    inst[p] = data[p];
                }
            }
        });

        if (data.children && Array.isArray(data.children)) {
            data.children.forEach(cData => {
                const child = Instance.deserialize(cData);
                inst.addChild(child);
            });
        }

        return inst;
    }

    static findDeep(root, className) {
        let results = [];
        if (root.className === className) results.push(root);
        root.children.forEach(c => {
            results = results.concat(Instance.findDeep(c, className));
        });
        return results;
    }
}
