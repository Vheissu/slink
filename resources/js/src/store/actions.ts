import { AppState } from './state';

export const setUser = (state: AppState, user: AppState['user']) => ({
  ...state,
  user,
});
