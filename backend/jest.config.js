module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
      isolatedModules: true,
    },
  },
  transformIgnorePatterns: [
    'node_modules/(?!(fastify)/)'
  ],
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
    '!src/app.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/config/(.*)$': '<rootDir>/src/config/$1',
    '^@/modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@/middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@/routes/(.*)$': '<rootDir>/src/routes/$1',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@/libs/(.*)$': '<rootDir>/src/libs/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 10000,
  maxWorkers: '50%',
  verbose: true,
};