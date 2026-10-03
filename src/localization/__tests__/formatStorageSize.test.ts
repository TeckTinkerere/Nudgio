import {formatStorageSize} from '../format';

describe('formatStorageSize', () => {
  it('uses decimal units, matching what Android storage screens show', () => {
    // 486 MB here is 486 MB in Settings > Storage, not a binary figure that
    // reads ~5% smaller for no reason the user can see.
    expect(formatStorageSize(486_000_000)).toBe('486 MB');
  });

  it('never rounds a real file down to nothing', () => {
    // "0 MB" beside a library of photos reads as "nothing stored".
    expect(formatStorageSize(1)).toBe('<1 MB');
    expect(formatStorageSize(999_999)).toBe('<1 MB');
  });

  it('shows an empty library as zero, not as a sliver', () => {
    expect(formatStorageSize(0)).toBe('0 MB');
  });

  it('switches to one decimal place past a gigabyte', () => {
    expect(formatStorageSize(1_200_000_000)).toBe('1.2 GB');
    expect(formatStorageSize(999_000_000)).toBe('999 MB');
  });

  it('accepts the decimal-string ByteCount the bridge actually sends', () => {
    expect(formatStorageSize('486000000')).toBe('486 MB');
  });

  it('degrades instead of crashing a settings row on a malformed count', () => {
    expect(formatStorageSize('not-a-number')).toBe('—');
  });
});
