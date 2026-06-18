// Blood & Bridle — the personal life (Phase 7).
//
// Partner, child, funeral of a parent, widow on the next ranch.
// The minimal personal life. The ranch is a system; the personal
// life is what makes the system a *life*.
//
// Pure module. No DOM. No localStorage.

export const PARTNER_TEMPLATES = Object.freeze([
  {
    id: 'saloon-keeper',
    name: 'Mae Calder',
    role: 'Head trainer',
    description: 'Married to the work, married to the place. The hands call her ma\'am when the boss is around.',
  },
  {
    id: 'widow',
    name: 'The widow on the next ranch',
    role: 'Neighboring rancher',
    description: 'Three sections east. Husband died ten years ago. Runs the place alone. Knows more than she says.',
  },
  {
    id: 'schoolteacher',
    name: 'A teacher from town',
    role: 'Local schoolteacher',
    description: 'Comes on weekends. Brings the children in the summer. The bunkhouse is fuller when she is there.',
  },
]);

// Initialize the personal life state.
export function createInitialPersonalLife() {
  return {
    partner: null,
    children: [],
    parents: [
      { relation: 'father', alive: true, age: 65 },
      { relation: 'mother', alive: true, age: 62 },
    ],
    milestones: [],
  };
}

// Get married. Returns the updated personal life.
export function marry(personalLife, partnerId) {
  const partner = PARTNER_TEMPLATES.find((p) => p.id === partnerId);
  if (!partner) throw new Error(`Unknown partner: ${partnerId}`);
  return {
    ...personalLife,
    partner: { ...partner, marriedDay: 0 },  // day filled in by caller
  };
}

// Have a child. Returns the updated personal life.
export function haveChild(personalLife, name, sex, day) {
  return {
    ...personalLife,
    children: [
      ...personalLife.children,
      { id: `child-${day}`, name, sex, age: 0, bornDay: day },
    ],
  };
}

// Tick children: they age with the years.
export function ageChildren(personalLife, yearsAdded) {
  return {
    ...personalLife,
    children: personalLife.children.map((c) => ({ ...c, age: (c.age ?? 0) + yearsAdded })),
  };
}

// Tick parents: they age and may die.
export function ageParents(personalLife, yearsAdded) {
  return {
    ...personalLife,
    parents: personalLife.parents.map((p) => {
      const newAge = (p.age ?? 60) + yearsAdded;
      // Mortality check: small chance per year, increasing with age
      let deathChance = 0;
      if (newAge > 75) deathChance = 0.10 * yearsAdded;
      else if (newAge > 65) deathChance = 0.04 * yearsAdded;
      else if (newAge > 55) deathChance = 0.01 * yearsAdded;
      return {
        ...p,
        age: newAge,
        alive: p.alive && Math.random() > deathChance,
      };
    }),
  };
}

// Detect personal life milestones for the season.
export function detectPersonalMilestones(personalLife, season, day) {
  const milestones = [];
  // Parent death
  for (const p of personalLife.parents ?? []) {
    if (!p.alive) {
      milestones.push({
        type: 'parent_funerals',
        title: `${capitalize(p.relation)}'s funeral`,
        description: `Your ${p.relation} has passed. The hands came to the service. Mae did the flowers.`,
        day,
      });
    }
  }
  // Child milestones
  for (const c of personalLife.children ?? []) {
    if (c.age >= 13 && (c.milestones ?? []).indexOf('thirteenth') === -1) {
      milestones.push({
        type: 'child_milestone',
        title: `${c.name} turned thirteen`,
        description: `${c.name} is thirteen. They asked if they could ride the colts. You said no.`,
        day,
      });
    }
  }
  return milestones;
}

// McCarthy-style description of the personal life.
export function describePersonalLife(personalLife) {
  const parts = [];
  if (personalLife.partner) {
    parts.push(`Married to ${personalLife.partner.name}.`);
  }
  if ((personalLife.children ?? []).length > 0) {
    const ages = personalLife.children.map((c) => c.age);
    parts.push(`${personalLife.children.length} child${personalLife.children.length === 1 ? '' : 'ren'}: ages ${ages.join(', ')}.`);
  }
  const dead = (personalLife.parents ?? []).filter((p) => !p.alive);
  if (dead.length > 0) {
    parts.push(`${dead.map((p) => capitalize(p.relation)).join(' and ')} gone.`);
  }
  if (parts.length === 0) {
    return 'No family in the picture. The hands are the family.';
  }
  return parts.join(' ');
}

// Helper: capitalize first letter.
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}