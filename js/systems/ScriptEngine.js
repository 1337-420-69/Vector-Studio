import { Instance } from '../core/Instance.js';

export function injectScripts(workspace, bus, input, log) {
    const scripts = Instance.findDeep(workspace, "Script");
    
    // Create a localized sandbox API to prevent global namespace pollution
    const Game = {
        on: (evt, cb) => bus.addEventListener(evt, (e) => cb(e.detail)),
        emit: (evt, data) => bus.dispatchEvent(new CustomEvent(evt, { detail: data })),
        log: log,
        
        // Timer tracking array for automatic garbage collection on stop
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

    // Self-destruct sequence when the engine stops
    bus.addEventListener('EngineStop', () => {
        Game._timers.forEach(t => {
            if (t.type === 'interval') clearInterval(t.id);
            if (t.type === 'timeout') clearTimeout(t.id);
        });
        Game._timers = [];
    });

    scripts.forEach(scriptInst => {
        try {
            // new Function isolated scope (prevents ghosting from <script> tags)
            const runner = new Function('Game', 'Input', 'script', scriptInst.Code);
            runner(Game, input, scriptInst);
        } catch (e) {
            log(`Compilation Error [${scriptInst.name}]: ${e.message}`, "log-error");
        }
    });
}
