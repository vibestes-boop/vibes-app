import { Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export const EXPLORE_GRID_COLS = 3;
export const EXPLORE_ITEM_WIDTH = (width - 2) / EXPLORE_GRID_COLS;
export const EXPLORE_ITEM_HEIGHT = EXPLORE_ITEM_WIDTH * (4 / 3);
