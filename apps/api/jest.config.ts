import type { Config } from 'jest'

const shared: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testEnvironment: 'node',
  coveragePathIgnorePatterns: [
    '/test/',
    '\\.spec\\.ts$',
    '\\.integration-spec\\.ts$',
    '\\.e2e-spec\\.ts$',
  ],
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
}

const config: Config = {
  ...shared,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.entity.ts',
    '!src/**/*.dto.ts',
    '!src/database/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
  projects: [
    {
      ...shared,
      displayName: 'unit',
      setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
      testMatch: ['<rootDir>/src/**/*.spec.ts'],
    },
    {
      ...shared,
      displayName: 'integration',
      setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
      testMatch: ['<rootDir>/test/integration/**/*.integration-spec.ts'],
    },
    {
      ...shared,
      displayName: 'e2e',
      setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
      testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
    },
  ],
}

export default config
