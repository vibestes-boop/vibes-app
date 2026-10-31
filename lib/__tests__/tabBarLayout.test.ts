import { TAB_BAR_HEIGHT, tabBarBottomGap, tabBarTop } from '../tabBarLayout';

describe('Lage der Tab-Leiste', () => {
  it('sitzt auf iPhones mit Face ID knapp über dem Home-Balken', () => {
    expect(tabBarBottomGap(34)).toBe(14);
  });
  it('hält ohne Home-Balken einen kleinen Rand', () => {
    expect(tabBarBottomGap(0)).toBe(8);
  });
  it('misst die Oberkante als Abstand plus Höhe', () => {
    expect(TAB_BAR_HEIGHT).toBe(60);
    expect(tabBarTop(34)).toBe(74);
  });
});
