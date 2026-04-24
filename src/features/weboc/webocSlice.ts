import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export type ToolKey = 'tariff' | 'history' | 'duty'

export interface ToolConfig {
  key: ToolKey
  label: string
  url: string
}

interface WebocState {
  selectedTool: ToolKey
  hsCodeQuery: string
  quantity: string
  unitValue: string
  description: string
  origin: string
  currency: string
  notes: string
}

export const tools: ToolConfig[] = [
  {
    key: 'tariff',
    label: 'Check HS Code',
    url: '/weboc/Shared/TariffList.aspx',
  },
  {
    key: 'history',
    label: 'Import History',
    url: '/weboc/DownloadValuationData.aspx',
  },
  {
    key: 'duty',
    label: 'Calculate Duty',
    url: '/weboc/Shared/ItemGeneralDutyCalculator.aspx',
  },
]

const initialState: WebocState = {
  selectedTool: 'tariff',
  hsCodeQuery: '',
  quantity: '',
  unitValue: '',
  description: '',
  origin: '',
  currency: '',
  notes: '',
}

const webocSlice = createSlice({
  name: 'weboc',
  initialState,
  reducers: {
    selectTool(state, action: PayloadAction<ToolKey>) {
      state.selectedTool = action.payload
    },
    updateForm(
      state,
      action: PayloadAction<
        Pick<
          WebocState,
          'hsCodeQuery' | 'quantity' | 'unitValue' | 'description' | 'origin' | 'currency' | 'notes'
        >
      >,
    ) {
      state.hsCodeQuery = action.payload.hsCodeQuery
      state.quantity = action.payload.quantity
      state.unitValue = action.payload.unitValue
      state.description = action.payload.description
      state.origin = action.payload.origin
      state.currency = action.payload.currency
      state.notes = action.payload.notes
    },
  },
})

export const { selectTool, updateForm } = webocSlice.actions
export default webocSlice.reducer
