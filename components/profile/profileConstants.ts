import { Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const GRID_GAP = 2;
export const GRID_COLUMNS = 3;
export const GRID_CELL_WIDTH = (SCREEN_WIDTH - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
