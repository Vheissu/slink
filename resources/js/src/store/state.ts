export interface AppState {
  user: {
    name: string;
    role: string;
  } | null;
}

export const initialState: AppState = {
  user: null,
};
