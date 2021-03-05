const normalConfig = require('./jest.config.js');

const { testMatch, ...rest } = normalConfig;
console.info({ testMatch });
module.exports = {
  ...rest,
  testEnvironment: 'jest-bench/environment',
  reporters: ['default', 'jest-bench/reporter'],
  testRegex: '(/__benchmarks__/.*|\\.bench)\\.(ts|tsx|js)$',
};
