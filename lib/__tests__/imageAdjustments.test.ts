import { imageColorMatrix, normalizedImageMatrix } from '../imageAdjustments';
function pixel(matrix: number[], rgb: number[]) { return [0,1,2].map(row => rgb.reduce((v,c,i) => v + c * matrix[row*5+i],matrix[row*5+4])); }
it('keeps unedited colors and alpha unchanged', () => {
  const matrix = imageColorMatrix(null);
  expect(pixel(matrix,[42,96,210])).toEqual([42,96,210]);
  expect(matrix.slice(15)).toEqual([0,0,0,1,0]);
});
it('fully desaturates using luminance, rather than placing a gray overlay on the photo', () => {
  const channels=pixel(imageColorMatrix(null,{brightness:0,contrast:0,saturation:-50}),[255,0,0]);
  channels.forEach(v=>expect(v).toBeCloseTo(54.213));
});
it('adjusts contrast around mid-gray and changes brightness independently', () => {
  const contrast=imageColorMatrix(null,{brightness:0,contrast:50,saturation:0});
  expect(pixel(contrast,[127.5,127.5,127.5])).toEqual([127.5,127.5,127.5]);
  expect(pixel(contrast,[50,100,200])).toEqual([11.25,86.25,236.25]);
  expect(pixel(imageColorMatrix(null,{brightness:20,contrast:0,saturation:0}),[10,100,200])).toEqual([61,151,251]);
});
it('composes adjustments after a selected filter and normalizes only the bias for renderers', () => {
  const matrix=imageColorMatrix('warm',{brightness:12,contrast:30,saturation:-50});
  const [r,g,b]=pixel(matrix,[35,98,187]);expect(r).toBeCloseTo(g);expect(g).toBeCloseTo(b);
  normalizedImageMatrix('warm',{brightness:12,contrast:30,saturation:-50}).forEach((v,i)=>expect(v).toBeCloseTo(i%5===4?matrix[i]/255:matrix[i]));
});
