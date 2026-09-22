import { describe, it, expect } from 'vitest';
import { filterNavByPermission, PROJECT_NAV_ITEMS } from './AppSidebar';

const allow = () => true;
const deny = () => false;
/** `can` that grants view on every area except those listed. */
const denyAreas =
  (...off: string[]) =>
  (area: string, action: string) =>
    action === 'view' && !off.includes(area);

const labels = (items: { label: string }[]) => items.map((i) => i.label);

describe('filterNavByPermission', () => {
  it('shows all items for a system role (can → true)', () => {
    const out = filterNavByPermission(PROJECT_NAV_ITEMS, allow);
    expect(labels(out)).toEqual(labels(PROJECT_NAV_ITEMS));
  });

  it('hides Bugs when bugs.view is denied', () => {
    const out = filterNavByPermission(PROJECT_NAV_ITEMS, denyAreas('bugs'));
    expect(labels(out)).not.toContain('Bugs');
    // unrelated items stay
    expect(labels(out)).toContain('Dashboard');
    expect(labels(out)).toContain('Sprints');
  });

  it('hides Wiki when wiki.view is denied', () => {
    const out = filterNavByPermission(PROJECT_NAV_ITEMS, denyAreas('wiki'));
    expect(labels(out)).not.toContain('Wiki');
  });

  it('hides Project Planner entirely when both planner and wbs are denied', () => {
    const out = filterNavByPermission(PROJECT_NAV_ITEMS, denyAreas('planner', 'wbs'));
    expect(labels(out)).not.toContain('Project Planner');
  });

  it('keeps Project Planner with only WBS when planner denied but wbs granted', () => {
    const out = filterNavByPermission(PROJECT_NAV_ITEMS, denyAreas('planner'));
    const planner = out.find((i) => i.label === 'Project Planner');
    expect(planner).toBeDefined();
    expect(labels(planner!.children ?? [])).toEqual(['WBS']);
  });

  it('shows a leaf item that has no area regardless of can', () => {
    const noArea = [{ label: 'Free', icon: () => null, path: 'free' }];
    expect(labels(filterNavByPermission(noArea, deny))).toEqual(['Free']);
  });

  it('does not mutate the source array', () => {
    const before = PROJECT_NAV_ITEMS.length;
    filterNavByPermission(PROJECT_NAV_ITEMS, denyAreas('bugs', 'wiki'));
    expect(PROJECT_NAV_ITEMS.length).toBe(before);
    expect(labels(PROJECT_NAV_ITEMS)).toContain('Bugs');
  });
});
