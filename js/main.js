import { Instance } from './core/Instance.js';
import { stepPhysics } from './systems/Physics.js';
import { initParticlePool, stepParticles } from './systems/Particles.js';
import { updateCamera } from './systems/Camera.js';
import { injectScripts } from './systems/ScriptEngine.js';

import { renderTree as buildExplorerTree } from './studio/Explorer.js';
import { renderProps as buildInspectorProps, updateLiveProps } from './studio/Properties.js';
import { syncDOM, saveProjectSVG, loadProjectSVG, exportHTML, importRawSVG } from './studio/Viewport.js';
import { EditorCamera } from './studio/EditorCamera.js'; // Added importRawSVG

window.Instance = Instance;

const Engine = {
    Workspace: new Instance("Workspace", "Folder"),
    IsPlaying: false,
    DebugMode: false,
    Selected: null,
    StateSnapshot: null,
    ParticleState: { pool: [], active: [] },
    DOM: {},
    EditorCamera: null,
    EditorCameraState: null,

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
            props: document.getElementById('prop-root'),
            viewport: document.getElementById('viewport')
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

        if (!window.IS_EXPORT) {
            this.EditorCamera = new EditorCamera(this.DOM.viewport, this.DOM.svg);
            this.EditorCamera.bindKeyEvents();
        }

        this.bindUI();
        this.updateExplorer();
        syncDOM(this);
        
        if (window.IS_EXPORT) setTimeout(() => this.play(), 100);
        console.log("Engine initialized successfully.");
    },

    play() {
        this.StateSnapshot = this.Workspace.serialize();
        
        if (this.EditorCamera) {
            this.EditorCameraState = this.EditorCamera.saveState();
            this.EditorCamera.unbindKeyEvents();
        }
        
        this.IsPlaying = true;
        this.DOM.console.style.display = this.DebugMode ? 'block' : 'none';
        this.DOM.console.innerHTML = '';
        
        const badge = document.getElementById('play-badge');
        if(badge) badge.style.display = 'block';

        this.Bus = new EventTarget(); 

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
        this.emit('EngineStop'); 
        this.IsPlaying = false;
        cancelAnimationFrame(this.loop);
        
        const badge = document.getElementById('play-badge');
        if(badge) badge.style.display = 'none';

        if (this.StateSnapshot) {
            this.Workspace = Instance.deserialize(this.StateSnapshot);
            
            this.select(null); 
        } else {
            this.select(null);
        }

        if (this.EditorCamera && this.EditorCameraState) {
            this.EditorCamera.restoreState(this.EditorCameraState);
            this.EditorCamera.bindKeyEvents();
        }
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
        if(!this.DOM.console) return;
        const el = document.createElement('div');
        el.className = cls; 
        el.innerText = `> ${msg}`;
        this.DOM.console.appendChild(el);
        this.DOM.console.scrollTop = this.DOM.console.scrollHeight;
    },

    bindUI() {
        if (window.IS_EXPORT) return;
        
        const bind = (id, action) => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', action);
        };

        bind('btn-add-obj', () => this.addNode("VectorPart"));
        bind('btn-add-rb', () => this.addNode("RigidBody"));
        bind('btn-add-cam', () => this.addNode("Camera"));
        bind('btn-add-script', () => this.addNode("Script"));
        bind('btn-add-filter', () => this.addNode("SVGFilter"));
        bind('btn-add-particles', () => this.addNode("ParticleEmitter"));

        bind('btn-play', () => {
            document.getElementById('btn-play').style.display = 'none';
            document.getElementById('btn-stop').style.display = 'block';
            this.play();
        });
        
        bind('btn-stop', () => {
            document.getElementById('btn-play').style.display = 'block';
            document.getElementById('btn-stop').style.display = 'none';
            this.stop();
        });

        bind('btn-save-svg', () => saveProjectSVG(this.Workspace, this.DOM.svg));
        
        const fileInput = document.getElementById('file-input-svg');
        bind('btn-load-svg', () => { if (fileInput) fileInput.click(); });
        
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    loadProjectSVG(e.target.files[0], (state) => {
                        this.Workspace = Instance.deserialize(state);
                        this.Selected = null;
                        this.updateExplorer();
                        this.updateInspector();
                        syncDOM(this);
                    });
                    e.target.value = ''; // Reset input to allow reloading same file
                }
            });
        }

        // NEW FEATURE: Binding SVG Import logic
        const importInput = document.getElementById('file-input-import');
        bind('btn-import-svg', () => { if (importInput) importInput.click(); });

        if (importInput) {
            importInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    importRawSVG(e.target.files[0], (importedFolder) => {
                        this.Workspace.addChild(importedFolder);
                        this.updateExplorer();
                        syncDOM(this);
                    });
                    e.target.value = ''; // Reset input
                }
            });
        }

        const dbgBtn = document.getElementById('btn-debug');
        if (dbgBtn) {
            dbgBtn.addEventListener('click', () => {
                this.DebugMode = !this.DebugMode;
                dbgBtn.innerText = `🐞 Debug: ${this.DebugMode ? 'ON' : 'OFF'}`;
                dbgBtn.style.background = this.DebugMode ? '#d35400' : '#555';
                syncDOM(this);
            });
        }

        bind('btn-close-script', () => {
            const editor = document.getElementById('script-editor');
            if (editor) editor.style.display = 'none';
        });

        const textarea = document.getElementById('script-textarea');
        if (textarea) {
            textarea.addEventListener('input', (e) => {
                if (this.Selected) this.Selected.Code = e.target.value;
            });
        }
        
        bind('btn-publish', async () => await exportHTML(this.Workspace));
    },

    addNode(cls) {
        const inst = new Instance(`New_${cls}`, cls);
        (this.Selected && this.Selected.className !== "Script") ? this.Selected.addChild(inst) : this.Workspace.addChild(inst);
        this.select(inst);
    },

    select(inst) {
        this.Selected = inst;
        this.updateExplorer();
        this.updateInspector();
        syncDOM(this);

        const editor = document.getElementById('script-editor');
        const scriptTitle = document.getElementById('script-title');
        const scriptArea = document.getElementById('script-textarea');

        if (inst && inst.className === "Script" && editor && scriptTitle && scriptArea) {
            editor.style.display = 'flex';
            scriptTitle.innerText = inst.name;
            scriptArea.value = inst.Code;
        } else if (editor) {
            editor.style.display = 'none';
        }
    },

    updateExplorer() {
        buildExplorerTree(this.Workspace, this.Selected, this.DOM.tree, (node) => this.select(node));
    },

    updateInspector() {
        buildInspectorProps(
            this.Selected, 
            this.DOM.props, 
            () => { this.updateExplorer(); syncDOM(this); },
            (inst) => {
                if (inst.parent) inst.parent.removeChild(inst);
                this.Selected = null;
                this.updateExplorer();
                this.updateInspector();
                syncDOM(this);
            }
        );
    }
};

Engine.init();
