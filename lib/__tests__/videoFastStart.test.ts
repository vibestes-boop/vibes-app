import {
  inspectMp4FastStart,
  normalizeMediaMime,
} from '../../shared/media/videoFastStart';

function box(type: string, payloadLength = 0): Uint8Array {
  const bytes = new Uint8Array(8 + payloadLength);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, bytes.byteLength, false);
  for (let index = 0; index < 4; index += 1) {
    bytes[4 + index] = type.charCodeAt(index);
  }
  return bytes;
}

function ftyp(): Uint8Array {
  const bytes = box('ftyp', 12);
  const brands = 'isomiso2mp42';
  for (let index = 0; index < brands.length; index += 1) {
    bytes[8 + index] = brands.charCodeAt(index);
  }
  return bytes;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}

describe('video fast start inspection', () => {
  it('marks mp4 files with moov before mdat as fast-start', () => {
    const file = concat(ftyp(), box('moov', 16), box('mdat', 32));
    expect(inspectMp4FastStart(file, 'video/mp4')).toMatchObject({
      status: 'fast-start',
      reason: 'moov box is before mdat',
    });
  });

  it('marks mp4 files with mdat before moov as slow-start', () => {
    const file = concat(ftyp(), box('mdat', 32), box('moov', 16));
    expect(inspectMp4FastStart(file, 'video/mp4')).toMatchObject({
      status: 'slow-start',
      reason: 'mdat is before moov',
    });
  });

  it('infers video MIME type from mov/mp4 filenames when picker MIME is missing', () => {
    expect(normalizeMediaMime('', 'file:///tmp/camera.MOV')).toBe('video/quicktime');
    expect(normalizeMediaMime(null, 'clip.mp4?cache=1')).toBe('video/mp4');
  });
});
