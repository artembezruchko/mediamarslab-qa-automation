export type Gender = 0 | 1;

export interface TestUser {
  email: string;
  password: string;
  name: string;
  gender: Gender;
}

/** Generates a unique test user so tests never collide with each other or previous runs. */
export function makeUser(overrides: Partial<TestUser> = {}): TestUser {
  const unique = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
  return {
    email: `qa+${unique}@example.com`,
    password: `Qa${unique}pass`,
    name: `QA User ${unique}`,
    gender: 0,
    ...overrides,
  };
}
