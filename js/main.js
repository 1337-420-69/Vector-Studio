import { Instance } from './core/Instance.js';
import { stepPhysics } from './systems/Physics.js';
import { initParticlePool, stepParticles } from './systems/Particles.js';
import { updateCamera } from './systems/Camera.js';
import { injectScripts } from './systems/ScriptEngine.js';
import { renderTree } from './studio/Explorer.js';
import { renderProps, updateLiveProps } from './studio/Properties.js';
import { syncDOM, saveProjectSVG, loadProjectSVG, exportHTML } from './studio/Viewport.js';

const Engine = {
    Workspace: new Instance("Workspace", "Folder"),
    IsPlaying: false,
    DebugMode: false,
    Selected: null,
    StateSnapshot: null,
    ParticleState: { pool: [], active: [] },
    DOM: {},

    Bus: new EventTarget(),
    Input: { keys: new Set(), isPressed: (k) => Engine.Input.keys.has(k.toLowerCase()) },

    init() {
        this.DOM = {
            svg: document.getElementById('game-svg'),
            root: document.getElementById('world-root'),
            defs: document.getElementById('engine-defs'),
            particles: document.getElementById('particle-root'),
            debug: document.getElementById('debug-root'),
            console: document.getElementById('console-overlay'),
            tree: document.getElementById('tree-root'),
            props: document.getElementById('prop-root')
        };

        if (!window.EXPORT_DATA) {
            const ground = new Instance("Ground", "VectorPart");
            ground.X = 400; ground.Y = 550; ground.W = 800; ground.H = 100; ground.Color = "#27ae60";
            const rbG = new Instance("Ground_Physics", "RigidBody");
            rbG.IsStatic = true; rbG.ColliderW = 800; rbG.ColliderH = 100;
            ground.addChild(rbG);
            this.Workspace.addChild(ground);

            const player = new Instance("Player", "VectorPart");
            player.X = 400; player.Y = 200; player.Color = "#e74c3c";
            const rbP = new Instance("Player_Physics", "RigidBody");
            player.addChild(rbP);
            const cam = new Instance("MainCamera", "Camera");
            player.addChild(cam);
            const script = new Instance("PlayerControl", "Script");
            script.Code = `// Move with Arrow Keys / WASD\nGame.on('Update', (dt) => {\n  let rb = script.Parent.find('Player_Physics');\n  if(Input.isPressed('a') || Input.isPressed('ArrowLeft')) rb.VelocityX = -5;\n  else if(Input.isPressed('d') || Input.isPressed('ArrowRight')) rb.VelocityX = 5;\n  else rb.VelocityX = 0;\n  if((Input.isPressed('w') || Input.isPressed('ArrowUp')) && rb.VelocityY === 0) rb.VelocityY = -12;\n});`;
            player.addChild(script);
            this.Workspace.addChild(player);
        } else {
            this.Workspace = Instance.deserialize(window.EXPORT_DATA);
        }

        window.addEventListener('keydown', e => this.Input.keys.add(e.key.toLowerCase()));
        window.addEventListener('keyup', e => this.Input.keys.delete(e.key.toLowerCase()));

        this.bindUI();
        this.renderTree();
        syncDOM(this);
        
        if (window.IS_EXPORT) setTimeout(() => this.play(), 100);
    },

    play() {
        this.StateSnapshot = this.Workspace.serialize();
        this.IsPlaying = true;
        this.DOM.console.style.display = this.DebugMode ? 'block' : 'none';
        this.DOM.console.innerHTML = '';
        document.getElementById('play-badge').style.display = 'block';

        Instance.findDeep(this.Workspace, "AudioSource").forEach(a => {
            a._audio = new Audio(a.Src);
            if (a.PlayOnStart) a._audio.play();
        });

        injectScripts(this.Workspace, this.Bus, this.Input, (m, c) => this.log(m, c));
        this.emit('Init');

        this.ParticleState = initParticlePool(this.DOM.particles);
        this.lastTime = performance.now();
        this.loop = requestAnimationFrame((t) => this.tick(t));
    },

    stop() {
        this.IsPlaying = false;
        cancelAnimationFrame(this.loop);
        document.getElementById('play-badge').style.display = 'none';

        if (this.StateSnapshot) {
            this.Workspace = Instance.deserialize(this.StateSnapshot);
            this.Selected = null;
        }

        this.renderTree();
        this.renderProps();
        syncDOM(this);
        updateCamera(this.Workspace, this.DOM.svg);
    },

    tick(time) {
        if (!this.IsPlaying) return;
        const dt = (time - this.lastTime) / 1000;
        this.lastTime = time;

        this.emit('Update', dt);
        stepPhysics(this.Workspace);
        stepParticles(this.Workspace, this.ParticleState);
        updateCamera(this.Workspace, this.DOM.svg);
        syncDOM(this);

        if (this.Selected) updateLiveProps(this.Selected);

        this.loop = requestAnimationFrame((t) => this.tick(t));
    },

    emit(evt, data) { 
        this.Bus.dispatchEvent(new CustomEvent(evt, { detail: data })); 
    },

    log(msg, cls) {
        const el = document.createElement('div');
        el.className = cls; 
        el.innerText = `> ${msg}`;
        this.DOM.console.appendChild(el);
        this.DOM.console.scrollTop = this.DOM.console.scrollHeight;
    },

    bindUI() {
        if (window.IS_EXPORT) return;
        
        document.getElementById('btn-add-obj').onclick = () => this.addNode("VectorPart");
        document.getElementById('btn-add-rb').onclick = () => this.addNode("RigidBody");
        document.getElementById('btn-add-cam').onclick = () => this.addNode("Camera");
        document.getElementById('btn-add-script').onclick = () => this.addNode("Script");
        document.getElementById('btn-add-filter').onclick = () => this.addNode("SVGFilter");
        document.getElementById('btn-add-particles').onclick = () => this.addNode("ParticleEmitter");

        document.getElementById('btn-play').onclick = () => {
            document.getElementById('btn-play').style.display = 'none';
            document.getElementById('btn-stop').style.display = 'block';
            this.play();
        };
        document.getElementById('btn-stop').onclick = () => {
            document.getElementById('btn-play').style.display = 'block';
            document.getElementById('btn-stop').style.display = 'none';
            this.stop();
        };

        document.getElementById('btn-save-svg').onclick = () => saveProjectSVG(this.Workspace, this.DOM.svg);
        
        const fileInput = document.getElementById('file-input-svg');
        document.getElementById('btn-load-svg').onclick = () => fileInput.click();
        fileInput.onchange = (e) => {
            if (e.target.files.length > 0) {
                loadProjectSVG(e.target.files[0], (state) => {
                    this.Workspace = Instance.deserialize(state);
                    this.Selected = null;
                    this.renderTree();
                    this.renderProps();
                    syncDOM(this);
                });
            }
        };

        const dbgBtn = document.getElementById('btn-debug');
        dbgBtn.onclick = () => {
            this.DebugMode = !this.DebugMode;
            dbgBtn.innerText = `🐞 Debug: ${this.DebugMode ? 'ON' : 'OFF'}`;
            dbgBtn.style.background = this.DebugMode ? '#d35400' : '#555';
            syncDOM(this);
        };

        document.getElementById('btn-close-script').onclick = () => document.getElementById('script-editor').style.display = 'none';
        document.getElementById('script-textarea').oninput = (e) => { if (this.Selected) this.Selected.Code = e.target.value; };
        document.getElementById('btn-publish').onclick = () => exportHTML(this.Workspace);
    },

    addNode(cls) {
        const inst = new Instance(`New_${cls}`, cls);
        (this.Selected && this.Selected.className !== "Script") ? this.Selected.addChild(inst) : this.Workspace.addChild(inst);
        this.select(inst);
    },

    select(inst) {
        this.Selected = inst;
        this.renderTree();
        this.renderProps();
        syncDOM(this);

        const editor = document.getElementById('script-editor');
        if (inst && inst.className === "Script") {
            editor.style.display = 'flex';
            document.getElementById('script-title').innerText = inst.name;
            document.getElementById('script-textarea').value = inst.Code;
        } else {
            editor.style.display = 'none';
        }
    },

    renderTree() {
        renderTree(this.Workspace, this.Selected, this.DOM.tree, (node) => this.select(node));
    },

    renderProps() {
        renderProps(
            this.Selected, 
            this.DOM.props, 
            () => { this.renderTree(); syncDOM(this); },
            (inst) => {
                if (inst.parent) inst.parent.removeChild(inst);
                this.Selected = null;
                this.renderTree();
                this.renderProps();
                syncDOM(this);
            }
        );
    }
};

Engine.init();
