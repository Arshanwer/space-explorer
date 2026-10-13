import * as THREE from 'three';

// Free-roam flying: drag anywhere to look, joystick to move, up/down buttons.
// Keyboard: WASD / arrows to move, Q/E or Space/Shift for up/down.
export class FlyControls {
  constructor(camera, dom, hud) {
    this.camera = camera;
    this.dom = dom;
    this.hud = hud;
    this.enabled = false;
    this.yaw = 0; this.pitch = 0;
    this.move = new THREE.Vector2();
    this.vertical = 0;
    this.keys = new Set();
    this.velocity = new THREE.Vector3();
    this.speedFn = () => 5;
    this.clampFn = null;
    this.lookPointer = null;
    this.stick = hud.querySelector('.stick');
    this.joy = hud.querySelector('.joystick');
    this.bind();
  }

  bind() {
    const lookDown = (e) => {
      if (!this.enabled || this.lookPointer !== null) return;
      this.lookPointer = e.pointerId; this.last = [e.clientX, e.clientY]; this.dragDist = 0;
    };
    const lookMove = (e) => {
      if (!this.enabled || e.pointerId !== this.lookPointer) return;
      const dx = e.clientX - this.last[0], dy = e.clientY - this.last[1];
      this.dragDist += Math.abs(dx) + Math.abs(dy);
      this.last = [e.clientX, e.clientY];
      const k = 0.0042 * (this.camera.fov / 60);
      this.yaw -= dx * k; this.pitch -= dy * k;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -1.5, 1.5);
    };
    const lookUp = (e) => { if (e.pointerId === this.lookPointer) this.lookPointer = null; };
    this.dom.addEventListener('pointerdown', lookDown);
    window.addEventListener('pointermove', lookMove);
    window.addEventListener('pointerup', lookUp);
    window.addEventListener('pointercancel', lookUp);

    // joystick
    let joyId = null; let rect;
    const setStick = (x, y) => {
      const R = rect.width / 2;
      let dx = x - (rect.left + R), dy = y - (rect.top + R);
      const len = Math.hypot(dx, dy); const max = R * 0.62;
      if (len > max) { dx *= max / len; dy *= max / len; }
      this.stick.style.transform = `translate(${dx}px, ${dy}px)`;
      this.move.set(dx / max, -dy / max);
    };
    this.joy.addEventListener('pointerdown', (e) => { e.stopPropagation(); joyId = e.pointerId; rect = this.joy.getBoundingClientRect(); this.joy.setPointerCapture(e.pointerId); setStick(e.clientX, e.clientY); });
    this.joy.addEventListener('pointermove', (e) => { if (e.pointerId === joyId) setStick(e.clientX, e.clientY); });
    const joyEnd = (e) => { if (e.pointerId !== joyId) return; joyId = null; this.move.set(0, 0); this.stick.style.transform = ''; };
    this.joy.addEventListener('pointerup', joyEnd); this.joy.addEventListener('pointercancel', joyEnd);

    this.hud.querySelectorAll('.ud').forEach((b) => {
      const dir = +b.dataset.dir;
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); b.setPointerCapture(e.pointerId); this.vertical = dir; b.classList.add('on'); });
      const end = () => { this.vertical = 0; b.classList.remove('on'); };
      b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
    });

    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
  }

  start() {
    this.enabled = true;
    const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.yaw = e.y; this.pitch = e.x;
    this.velocity.set(0, 0, 0);
    this.hud.hidden = false;
  }
  stop() { this.enabled = false; this.hud.hidden = true; this.move.set(0, 0); this.vertical = 0; this.lookPointer = null; }

  update(dt) {
    if (!this.enabled) return 0;
    const k = this.keys;
    const mx = this.move.x + ((k.has('KeyD') || k.has('ArrowRight')) ? 1 : 0) - ((k.has('KeyA') || k.has('ArrowLeft')) ? 1 : 0);
    const my = this.move.y + ((k.has('KeyW') || k.has('ArrowUp')) ? 1 : 0) - ((k.has('KeyS') || k.has('ArrowDown')) ? 1 : 0);
    const mv = this.vertical + ((k.has('KeyE') || k.has('Space')) ? 1 : 0) - ((k.has('KeyQ') || k.has('ShiftLeft')) ? 1 : 0);
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0);
    const speed = this.speedFn(this.camera.position);
    const want = new THREE.Vector3().addScaledVector(fwd, my).addScaledVector(right, mx).addScaledVector(up, mv);
    if (want.lengthSq() > 1) want.normalize();
    want.multiplyScalar(speed);
    // smooth acceleration so it feels like a spaceship
    this.velocity.lerp(want, 1 - Math.pow(0.05, dt));
    this.camera.position.addScaledVector(this.velocity, dt);
    if (this.clampFn) this.clampFn(this.camera.position);
    return this.velocity.length();
  }
}
