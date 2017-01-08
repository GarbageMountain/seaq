module.exports = function (wallaby) {
  return {
    files: [
      'src/**/*.ts'
    ],

    tests: [
      'test/**/*.ts',
      'test/**/*.json'
    ],

    env: {
      type: 'node'
    },

    testFramework: 'ava',

    debug: false,
    delays: {
      run: 2000
    }
  };
};
