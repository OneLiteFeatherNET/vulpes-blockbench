import { describe, expect, it } from 'vitest';
import type { ComponentEntry } from '../../src/items/item-dto';
import { currentModelOf, describeValue, ITEM_MODEL_COMPONENT, planAssignment } from '../../src/items/item-plan';

const KEY = 'vulpes:item/ruby';

function component(componentKey: string, value: unknown, id = `c-${componentKey}`): ComponentEntry {
  return { id, componentKey, value };
}

describe('planAssignment', () => {
  it('plans a create when the item has no item model component', () => {
    expect(planAssignment([component('minecraft:food', { nutrition: 4 })], KEY), 'the plan').toEqual({ kind: 'create' });
  });

  it('plans a create for an item without any components', () => {
    expect(planAssignment([], KEY), 'the plan').toEqual({ kind: 'create' });
  });

  it('plans nothing when the item already uses the model key', () => {
    expect(planAssignment([component(ITEM_MODEL_COMPONENT, KEY)], KEY), 'the plan').toEqual({ kind: 'already-assigned' });
  });

  it('plans a replacement with the id and the old value when the item uses another model', () => {
    const plan = planAssignment([component(ITEM_MODEL_COMPONENT, 'vulpes:item/old', 'c-7')], KEY);
    expect(plan, 'the plan').toEqual({ kind: 'replace', componentId: 'c-7', previous: 'vulpes:item/old' });
  });

  it('shows a non-string old value as JSON', () => {
    const plan = planAssignment([component(ITEM_MODEL_COMPONENT, { model: 'x' }, 'c-8')], KEY);
    expect(plan, 'the plan').toEqual({ kind: 'replace', componentId: 'c-8', previous: '{"model":"x"}' });
  });
});

describe('currentModelOf', () => {
  it('returns the value of the item model component', () => {
    expect(currentModelOf([component(ITEM_MODEL_COMPONENT, 'vulpes:item/old')]), 'the model').toBe('vulpes:item/old');
  });

  it('returns undefined when the item has no item model component', () => {
    expect(currentModelOf([component('minecraft:food', {})]), 'the model').toBeUndefined();
  });
});

describe('describeValue', () => {
  it('returns a string value unchanged', () => {
    expect(describeValue('vulpes:item/ruby'), 'the text').toBe('vulpes:item/ruby');
  });

  it('returns other values as JSON text', () => {
    expect(describeValue(4), 'the text').toBe('4');
  });
});
