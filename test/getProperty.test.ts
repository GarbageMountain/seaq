import { getProperty } from '../src/Seaq';

test('it works', () => {
  const testObj = {
    name: 'joe',
    emails: [
      {
        email: 'joe@test.com',
        label: 'home',
        meta: {
          provider: 'test.com',
          confirmed: false,
        },
      },
      {
        email: 'joey@tester.com',
        label: 'home',
        meta: {
          provider: 'tester.com',
          confirmed: true,
        },
      },
    ],
    address: {
      line1: '1234 Main Street',
      line2: 'Vancouver BC',
      line3: 'V0V0V0',
    },
    extra: null,
  };
  expect(getProperty(testObj, 'name')).toEqual(['joe']);
  expect(getProperty(testObj, 'emails.email')).toEqual([
    'joe@test.com',
    'joey@tester.com',
  ]);
  expect(getProperty(testObj, 'emails.meta.provider')).toEqual([
    'test.com',
    'tester.com',
  ]);
  expect(getProperty(testObj, 'emails.meta.confirmed')).toEqual([
    'false',
    'true',
  ]);
  expect(getProperty(testObj, 'address')).toEqual([
    '{"line1":"1234 Main Street","line2":"Vancouver BC","line3":"V0V0V0"}',
  ]);
  expect(getProperty(testObj, 'address.line1')).toEqual(['1234 Main Street']);
  expect(getProperty(testObj, 'extra')).toEqual([]);
  expect(getProperty(testObj, 'nothing')).toEqual([]);
});
