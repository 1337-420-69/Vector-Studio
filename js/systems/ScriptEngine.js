import { Instance } from '../core/Instance.js';

export function injectScripts(workspace, bus, inputState, logFn) {
    const scripts = Instance.findDeep(workspace, "Script");
    
    const context = {
        Game: { 
            State: {}, 
            on: (evt, cb) => bus.addEventListener(evt, e => cb(e.detail)),
            emit: (evt, data) => bus.dispatchEvent(new CustomEvent(evt, { detail: data }))
        },
        Input: inputState,
        console: {
            log: (m) => logFn(m, ''),
            warn: (m) => logFn(m, 'log-warn'),
            error: (m) => logFn(m, 'log-error')
        }
    };

    scripts.forEach(s => {
        try {
            const localCtx = { ...context, script: { Parent: s.parent } };
            if (s.parent) {
                s.parent.find = (n) => workspace.find(n);
            }
            const fn = new Function(...Object.keys(localCtx), s.Code);
            fn(...Object.values(localCtx));
        } catch(e) { 
            logFn(`Error in script [${s.name}]: ${e.message}`, 'log-error'); 
        }
    });
}