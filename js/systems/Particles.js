import { Instance } from '../core/Instance.js';

export function initParticlePool(domParticles, poolSize = 100) {
    domParticles.innerHTML = '';
    const pool = Array.from({ length: poolSize }).map(() => {
        const p = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        p.setAttribute('r', 3);
        p.style.display = 'none';
        domParticles.appendChild(p);
        return { node: p, active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, color: '#fff' };
    });
    return { pool, active: [] };
}

export function stepParticles(workspace, particleState) {
    const emitters = Instance.findDeep(workspace, "ParticleEmitter");
    emitters.forEach(em => {
        if (em.Emitting && em.parent) {
            for (let i = 0; i < em.Rate; i++) {
                const p = particleState.pool.find(p => !p.active);
                if (p) {
                    p.active = true; p.x = em.parent.X; p.y = em.parent.Y;
                    p.vx = (Math.random() - 0.5) * em.Speed; p.vy = (Math.random() - 0.5) * em.Speed;
                    p.life = 1.0; p.color = em.Color; p.node.setAttribute('fill', p.color);
                    p.node.style.display = 'block';
                    particleState.active.push(p);
                }
            }
        }
    });

    particleState.active.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.life -= 0.02;
        p.node.setAttribute('cx', p.x); p.node.setAttribute('cy', p.y);
        p.node.setAttribute('opacity', p.life);
        if (p.life <= 0) { p.active = false; p.node.style.display = 'none'; }
    });
    particleState.active = particleState.active.filter(p => p.active);
}