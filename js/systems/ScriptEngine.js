import { Instance } from '../core/Instance.js';

export function injectScripts(workspace, bus, input, log) {
    const scripts = Instance.findDeep(workspace, "Script");
    
    const Game = {
        on: (evt, cb) => bus.addEventListener(evt, (e) => cb(e.detail)),
        emit: (evt, data) => bus.dispatchEvent(new CustomEvent(evt, { detail: data })),
        log: log,
        
        _timers: [],
        setInterval: (cb, ms) => { 
            const id = setInterval(cb, ms); 
            Game._timers.push({ id, type: 'interval' }); 
            return id; 
        },
        setTimeout: (cb, ms) => {
            const id = setTimeout(cb, ms);
            Game._timers.push({ id, type: 'timeout' });
            return id;
        }
    };

    bus.addEventListener('EngineStop', () => {
        Game._timers.forEach(t => {
            if (t.type === 'interval') clearInterval(t.id);
            if (t.type === 'timeout') clearTimeout(t.id);
        });
        Game._timers = [];
    });

    scripts.forEach(scriptInst => {
        try {
            // Polyfill Roblox-style uppercase syntax used in the default script
            if (!scriptInst.Parent) {
                scriptInst.Parent = scriptInst.parent;
            }
            if (scriptInst.Parent && typeof scriptInst.Parent.find !== 'function') {
                scriptInst.Parent.find = function(name) {
                    return this.children.find(c => c.name === name) || null;
                };
            }

            const runner = new Function('Game', 'Input', 'script', scriptInst.Code);
            runner(Game, input, scriptInst);
        } catch (e) {
            log(`Compilation Error [${scriptInst.name}]: ${e.message}`, "log-error");
        }
    });
}
