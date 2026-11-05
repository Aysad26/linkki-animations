// Time drives each scene. IntersectionObserver only starts its playback.
export class SceneTimeline {
  constructor({ duration, render, onState = () => {}, now = () => performance.now(), requestFrame = cb => requestAnimationFrame(cb), cancelFrame = id => cancelAnimationFrame(id) }) {
    Object.assign(this, { duration, render, onState, now, requestFrame, cancelFrame });
    this.state = 'idle'; this.elapsed = 0; this.frameId = null;
    this.render(0);
  }
  setState(state) { this.state = state; this.onState(state); }
  play() {
    if (this.state === 'playing' || this.state === 'paused') return false;
    this.elapsed = 0; this.startedAt = this.now(); this.render(0);
    this.setState('playing');
    this.frameId = this.requestFrame(() => this.tick());
    return true;
  }
  tick() {
    this.frameId = null;
    if (this.state !== 'playing') return;
    this.elapsed = Math.min(this.duration, Math.max(0, this.now() - this.startedAt));
    this.render(this.elapsed / this.duration);
    if (this.elapsed >= this.duration) this.setState('complete');
    else this.frameId = this.requestFrame(() => this.tick());
  }
  pause() {
    if (this.state !== 'playing') return;
    this.elapsed = Math.min(this.duration, this.now() - this.startedAt);
    this.cancelPending(); this.setState('paused');
  }
  resume() {
    if (this.state !== 'paused') return;
    this.startedAt = this.now() - this.elapsed;
    this.setState('playing'); this.frameId = this.requestFrame(() => this.tick());
  }
  setDuration(duration) {
    if (!(duration > 0) || !Number.isFinite(duration)) return;
    const elapsed = this.state === 'playing' ? this.now() - this.startedAt : this.elapsed;
    const progress = Math.min(1, Math.max(0, elapsed / this.duration));
    this.duration = duration; this.elapsed = progress * duration;
    if (this.state === 'playing') this.startedAt = this.now() - this.elapsed;
    this.render(progress);
  }
  finish() { this.cancelPending(); this.elapsed = this.duration; this.render(1); this.setState('complete'); }
  reset() { this.cancelPending(); this.elapsed = 0; this.render(0); this.setState('idle'); }
  cancelPending() { if (this.frameId !== null) this.cancelFrame(this.frameId); this.frameId = null; }
}
