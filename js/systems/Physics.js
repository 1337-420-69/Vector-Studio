import { Instance } from '../core/Instance.js';

export function checkAABB(x, y, w, h, statics) {
    return statics.find(st => {
        if (st.parent === null) return false;
        const sp = st.parent;
        return (x - w/2 < sp.X + st.ColliderW/2 && x + w/2 > sp.X - st.ColliderW/2 &&
                y - h/2 < sp.Y + st.ColliderH/2 && y + h/2 > sp.Y - st.ColliderH/2);
    });
}

export function stepPhysics(workspace) {
    const bodies = Instance.findDeep(workspace, "RigidBody");
    const dynamics = bodies.filter(b => !b.IsStatic);
    const statics = bodies.filter(b => b.IsStatic);

    dynamics.forEach(rb => {
        const p = rb.parent;
        if (!p) return;
        
        rb.VelocityY += 0.5 * rb.GravityScale; 
        
        let nextX = p.X + rb.VelocityX;
        let collision = checkAABB(nextX, p.Y, rb.ColliderW, rb.ColliderH, statics);
        if (collision) {
            rb.VelocityX *= -rb.Bounciness;
        } else {
            p.X = nextX;
        }

        let nextY = p.Y + rb.VelocityY;
        collision = checkAABB(p.X, nextY, rb.ColliderW, rb.ColliderH, statics);
        if (collision) {
            if (rb.VelocityY > 0) p.Y = collision.parent.Y - collision.ColliderH/2 - rb.ColliderH/2;
            else if (rb.VelocityY < 0) p.Y = collision.parent.Y + collision.ColliderH/2 + rb.ColliderH/2;
            rb.VelocityY *= -rb.Bounciness;
        } else {
            p.Y = nextY;
        }
    });
}