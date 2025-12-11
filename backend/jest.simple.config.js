module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/simple/**/*.test.js'
  ],
  setupFilesAfterEnv: ['dotenv/config'],
  verbose: true,
  collectCoverage: false,
  bail: false
};