import { describe, it, expect, beforeEach } from 'bun:test';
import { ManifoldMap } from '../../src/collision/ManifoldMap.js';
import { type Manifold, type ContactPoint } from '../../src/collision/Manifold.js';
import { Body } from '../../src/dynamics/Body.js';
import { Circle } from '../../src/shapes/Circle.js';
import { Vec2 } from '../../src/math/Vec2.js';

function makeBody(x: number, y: number): Body {
  return new Body({ shape: new Circle(1), position: new Vec2(x, y) });
}

function makeManifold(bodyA: Body, bodyB: Body, contacts?: ContactPoint[]): Manifold {
  return {
    bodyA,
    bodyB,
    normal: new Vec2(1, 0),
    contacts: contacts ?? [{ point: new Vec2(0, 0), depth: 0.1, id: 0, normalImpulse: 0, tangentImpulse: 0 }],
    friction: 0.3,
    restitution: 0.2,
    isSensor: false,
  };
}

describe('ManifoldMap', () => {
  let map: ManifoldMap;

  beforeEach(() => {
    Body.resetIdCounter();
    map = new ManifoldMap();
  });

  it('first update with one manifold -> began contains it, ended empty', () => {
    const a = makeBody(0, 0);
    const b = makeBody(1, 0);
    const m = makeManifold(a, b);

    const result = map.update([m]);

    expect(result.began).toHaveLength(1);
    expect(result.began[0]).toBe(m);
    expect(result.ended).toHaveLength(0);
    expect(result.active).toHaveLength(1);
  });

  it('second update with same pair -> began empty, ended empty', () => {
    const a = makeBody(0, 0);
    const b = makeBody(1, 0);

    map.update([makeManifold(a, b)]);
    const result = map.update([makeManifold(a, b)]);

    expect(result.began).toHaveLength(0);
    expect(result.ended).toHaveLength(0);
    expect(result.active).toHaveLength(1);
  });

  it('second update without the pair -> ended contains it', () => {
    const a = makeBody(0, 0);
    const b = makeBody(1, 0);

    map.update([makeManifold(a, b)]);
    const result = map.update([]);

    expect(result.began).toHaveLength(0);
    expect(result.ended).toHaveLength(1);
    expect(result.ended[0].bodyA.id).toBe(a.id);
    expect(result.active).toHaveLength(0);
  });

  it('multiple pairs: add 3 then remove 1 -> ended shows 1', () => {
    const a = makeBody(0, 0);
    const b = makeBody(1, 0);
    const c = makeBody(2, 0);
    const d = makeBody(3, 0);

    // Frame 1: 3 pairs
    map.update([
      makeManifold(a, b),
      makeManifold(a, c),
      makeManifold(a, d),
    ]);

    // Frame 2: remove a-d pair
    const result = map.update([
      makeManifold(a, b),
      makeManifold(a, c),
    ]);

    expect(result.began).toHaveLength(0);
    expect(result.ended).toHaveLength(1);
    expect(result.active).toHaveLength(2);
  });

  it('warm-start transfer: impulses copied by feature ID', () => {
    const a = makeBody(0, 0);
    const b = makeBody(1, 0);

    // Frame 1: manifold with impulse values set
    const oldContacts: ContactPoint[] = [
      { point: new Vec2(0.5, 0), depth: 0.1, id: 42, normalImpulse: 5.5, tangentImpulse: 2.3 },
    ];
    map.update([makeManifold(a, b, oldContacts)]);
    // Simulate solver populating impulses on the cached manifold
    // The ManifoldMap stores the manifold from frame 1 which already has impulses

    // Frame 2: new manifold with same feature ID but zero impulses
    const newContacts: ContactPoint[] = [
      { point: new Vec2(0.5, 0), depth: 0.15, id: 42, normalImpulse: 0, tangentImpulse: 0 },
    ];
    const result = map.update([makeManifold(a, b, newContacts)]);

    expect(result.active).toHaveLength(1);
    const contact = result.active[0].contacts[0];
    expect(contact.normalImpulse).toBe(5.5);
    expect(contact.tangentImpulse).toBe(2.3);
  });

  it('warm-start: no transfer for mismatched feature IDs', () => {
    const a = makeBody(0, 0);
    const b = makeBody(1, 0);

    const oldContacts: ContactPoint[] = [
      { point: new Vec2(0.5, 0), depth: 0.1, id: 42, normalImpulse: 5.5, tangentImpulse: 2.3 },
    ];
    map.update([makeManifold(a, b, oldContacts)]);

    const newContacts: ContactPoint[] = [
      { point: new Vec2(0.5, 0), depth: 0.15, id: 99, normalImpulse: 0, tangentImpulse: 0 },
    ];
    const result = map.update([makeManifold(a, b, newContacts)]);

    const contact = result.active[0].contacts[0];
    expect(contact.normalImpulse).toBe(0);
    expect(contact.tangentImpulse).toBe(0);
  });

  it('clear empties the map', () => {
    const a = makeBody(0, 0);
    const b = makeBody(1, 0);
    map.update([makeManifold(a, b)]);

    map.clear();
    const result = map.update([makeManifold(a, b)]);

    // After clear, this should be a new "began" pair
    expect(result.began).toHaveLength(1);
  });
});
