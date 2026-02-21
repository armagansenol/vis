import { type Body } from '../dynamics/Body.js';
import { type Manifold } from '../collision/Manifold.js';

/**
 * Event data emitted when a contact begins or ends.
 */
export interface ContactEvent {
  bodyA: Body;
  bodyB: Body;
  manifold: Manifold;
  isSensor: boolean;
}

/**
 * Listener callback for contact events.
 */
export type ContactListener = (event: ContactEvent) => void;

/**
 * Lightweight typed event emitter for collision contact events.
 *
 * Supports beginContact and endContact event types with subscribe/unsubscribe.
 * No dependency on Node.js EventEmitter.
 */
export class EventDispatcher {
  private beginListeners: ContactListener[] = [];
  private endListeners: ContactListener[] = [];

  /**
   * Register a listener for beginContact events.
   * @returns Unsubscribe function.
   */
  onBeginContact(listener: ContactListener): () => void {
    this.beginListeners.push(listener);
    return () => {
      const idx = this.beginListeners.indexOf(listener);
      if (idx !== -1) this.beginListeners.splice(idx, 1);
    };
  }

  /**
   * Register a listener for endContact events.
   * @returns Unsubscribe function.
   */
  onEndContact(listener: ContactListener): () => void {
    this.endListeners.push(listener);
    return () => {
      const idx = this.endListeners.indexOf(listener);
      if (idx !== -1) this.endListeners.splice(idx, 1);
    };
  }

  /**
   * Emit a contact event to all registered listeners of the given type.
   */
  emit(type: 'begin' | 'end', event: ContactEvent): void {
    const listeners =
      type === 'begin' ? this.beginListeners : this.endListeners;
    for (const listener of listeners) {
      listener(event);
    }
  }

  /** Remove all listeners. */
  clear(): void {
    this.beginListeners = [];
    this.endListeners = [];
  }
}
