import { describe, it, expect, beforeEach } from 'vitest';
import { EventDispatcher, type ContactEvent } from '../../src/events/EventDispatcher.js';
import { Body } from '../../src/dynamics/Body.js';
import { Circle } from '../../src/shapes/Circle.js';
import { Vec2 } from '../../src/math/Vec2.js';

function makeDummyEvent(): ContactEvent {
  const bodyA = new Body({ shape: new Circle(1), position: new Vec2(0, 0) });
  const bodyB = new Body({ shape: new Circle(1), position: new Vec2(1, 0) });
  return {
    bodyA,
    bodyB,
    manifold: {
      bodyA,
      bodyB,
      normal: new Vec2(1, 0),
      contacts: [{ point: new Vec2(0.5, 0), depth: 0.1, id: 0, normalImpulse: 0, tangentImpulse: 0 }],
      friction: 0.3,
      restitution: 0.2,
      isSensor: false,
    },
    isSensor: false,
  };
}

describe('EventDispatcher', () => {
  let dispatcher: EventDispatcher;

  beforeEach(() => {
    Body.resetIdCounter();
    dispatcher = new EventDispatcher();
  });

  it('beginContact listener called with correct data', () => {
    const received: ContactEvent[] = [];
    dispatcher.onBeginContact((e) => received.push(e));

    const event = makeDummyEvent();
    dispatcher.emit('begin', event);

    expect(received).toHaveLength(1);
    expect(received[0]).toBe(event);
  });

  it('endContact listener called with correct data', () => {
    const received: ContactEvent[] = [];
    dispatcher.onEndContact((e) => received.push(e));

    const event = makeDummyEvent();
    dispatcher.emit('end', event);

    expect(received).toHaveLength(1);
    expect(received[0]).toBe(event);
  });

  it('multiple listeners all called', () => {
    let count = 0;
    dispatcher.onBeginContact(() => count++);
    dispatcher.onBeginContact(() => count++);
    dispatcher.onBeginContact(() => count++);

    dispatcher.emit('begin', makeDummyEvent());

    expect(count).toBe(3);
  });

  it('unsubscribe removes listener', () => {
    let count = 0;
    const unsub = dispatcher.onBeginContact(() => count++);

    dispatcher.emit('begin', makeDummyEvent());
    expect(count).toBe(1);

    unsub();
    dispatcher.emit('begin', makeDummyEvent());
    expect(count).toBe(1); // Not called again
  });

  it('clear removes all listeners', () => {
    let beginCount = 0;
    let endCount = 0;
    dispatcher.onBeginContact(() => beginCount++);
    dispatcher.onEndContact(() => endCount++);

    dispatcher.clear();

    dispatcher.emit('begin', makeDummyEvent());
    dispatcher.emit('end', makeDummyEvent());

    expect(beginCount).toBe(0);
    expect(endCount).toBe(0);
  });

  it('begin and end events are independent', () => {
    let beginCount = 0;
    let endCount = 0;
    dispatcher.onBeginContact(() => beginCount++);
    dispatcher.onEndContact(() => endCount++);

    dispatcher.emit('begin', makeDummyEvent());
    expect(beginCount).toBe(1);
    expect(endCount).toBe(0);

    dispatcher.emit('end', makeDummyEvent());
    expect(beginCount).toBe(1);
    expect(endCount).toBe(1);
  });
});
