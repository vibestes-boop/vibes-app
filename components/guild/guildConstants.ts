import { Dimensions } from 'react-native';

export const GUILD_SCREEN_WIDTH = Dimensions.get('window').width;

export const GUILD_COLORS: Record<string, string[]> = {
  'Pod Alpha': ['#CCCCCC', '#FFFFFF'],
  'Pod Beta': ['#EC4899', '#F43F5E'],
  'Pod Gamma': ['#10B981', '#059669'],
  'Pod Delta': ['#F59E0B', '#EF4444'],
  'Pod Omega': ['#06B6D4', '#3B82F6'],
};

export type GuildViewMode = 'feed' | 'leaderboard';
