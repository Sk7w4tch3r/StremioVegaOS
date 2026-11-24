import {TorrentEngine} from '../src';

jest.mock('../src/turbo-modules/TorrentEngine');

describe('Template Turbomodule library tests', () => {
  it('Sample Test Case', () => {
    expect(TorrentEngine.getMajorVersion()).toBe(1);
  });
});
