import { configureStore } from '@reduxjs/toolkit'
import webocReducer from '../features/weboc/webocSlice'

export const store = configureStore({
  reducer: {
    weboc: webocReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
