import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useDispatch, useSelector } from 'react-redux'
import { selectTool, tools, updateForm, type ToolKey } from './features/weboc/webocSlice'
import type { RootState } from './app/store'

type FormValues = {
  hsCodeQuery: string
  quantity: string
  unitValue: string
  description: string
  origin: string
  currency: string
  notes: string
}

type LoginFormValues = {
  username: string
  password: string
}

type CreateAccountFormValues = {
  username: string
  password: string
  confirmPassword: string
  validDays: number
}

type ClientAccount = {
  username: string
  password: string
  expiresAt: string
}

type ReferenceRecord = FormValues & {
  id: string
  createdAt: string
  createdBy: string
}

const CLIENT_ACCOUNTS_STORAGE_KEY = 'hscode-client-accounts'
const REFERENCE_RECORDS_STORAGE_KEY = 'hscode-reference-records'

const ADMIN_ACCOUNT = {
  username: 'admin',
  password: '123456',
}

const DEFAULT_VALID_DAYS = 30

const toExpiryDate = (days: number) => {
  const expiry = new Date()
  expiry.setHours(23, 59, 59, 999)
  expiry.setDate(expiry.getDate() + days)
  return expiry.toISOString()
}

const isExpired = (expiresAt: string) => new Date(expiresAt).getTime() < Date.now()

const getDaysLeft = (expiresAt: string) =>
  Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))

const extendExpiryDate = (currentExpiresAt: string, days: number) => {
  const currentExpiry = new Date(currentExpiresAt)
  const currentExpiryTs = currentExpiry.getTime()
  const isCurrentValid = Number.isFinite(currentExpiryTs) && currentExpiryTs > Date.now()

  const nextExpiry = isCurrentValid ? new Date(currentExpiryTs) : new Date()
  nextExpiry.setDate(nextExpiry.getDate() + days)

  // Keep same "end of day" behavior for renewed accounts.
  if (!isCurrentValid) {
    nextExpiry.setHours(23, 59, 59, 999)
  }

  return nextExpiry.toISOString()
}

const getStoredClientAccounts = (): ClientAccount[] => {
  const raw = localStorage.getItem(CLIENT_ACCOUNTS_STORAGE_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter(
      (item): item is ClientAccount =>
        item &&
        typeof item === 'object' &&
        typeof item.username === 'string' &&
        typeof item.password === 'string' &&
        typeof item.expiresAt === 'string',
    )
  } catch {
    return []
  }
}

const getStoredReferenceRecords = (): ReferenceRecord[] => {
  const raw = localStorage.getItem(REFERENCE_RECORDS_STORAGE_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(
      (item): item is ReferenceRecord =>
        item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.createdAt === 'string' &&
        typeof item.createdBy === 'string' &&
        typeof item.hsCodeQuery === 'string' &&
        typeof item.quantity === 'string' &&
        typeof item.unitValue === 'string' &&
        typeof item.description === 'string' &&
        typeof item.origin === 'string' &&
        typeof item.currency === 'string' &&
        typeof item.notes === 'string',
    )
  } catch {
    return []
  }
}

function App() {
  const dispatch = useDispatch()
  const { selectedTool, hsCodeQuery, quantity, unitValue, description, origin, currency, notes } =
    useSelector(
    (state: RootState) => state.weboc,
    )
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [saveStatus, setSaveStatus] = useState('')
  const [fillStatus, setFillStatus] = useState('')
  const [clientAccounts, setClientAccounts] = useState<ClientAccount[]>(() => getStoredClientAccounts())
  const [referenceRecords, setReferenceRecords] = useState<ReferenceRecord[]>(() =>
    getStoredReferenceRecords(),
  )
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem('hscode-authenticated') === 'true',
  )
  const [currentUsername, setCurrentUsername] = useState(() => localStorage.getItem('hscode-auth-user') ?? '')
  const [activePage, setActivePage] = useState<'workspace' | 'records'>('workspace')
  const [loginError, setLoginError] = useState('')
  const [accountStatus, setAccountStatus] = useState('')
  const [recordStatus, setRecordStatus] = useState('')

  const currentTool = useMemo(
    () => tools.find((tool) => tool.key === selectedTool) ?? tools[0],
    [selectedTool],
  )

  const { register, handleSubmit, reset, getValues } = useForm<FormValues>({
    defaultValues: {
      hsCodeQuery,
      quantity,
      unitValue,
      description,
      origin,
      currency,
      notes,
    },
  })
  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
    reset: resetLoginForm,
  } = useForm<LoginFormValues>({
    defaultValues: {
      username: '',
      password: '',
    },
  })
  const {
    register: registerAccount,
    handleSubmit: handleAccountSubmit,
    reset: resetAccountForm,
  } = useForm<CreateAccountFormValues>({
    defaultValues: {
      username: '',
      password: '',
      confirmPassword: '',
      validDays: DEFAULT_VALID_DAYS,
    },
  })

  useEffect(() => {
    reset({ hsCodeQuery, quantity, unitValue, description, origin, currency, notes })
  }, [hsCodeQuery, quantity, unitValue, description, origin, currency, notes, reset])

  const onSubmit = (values: FormValues) => {
    dispatch(updateForm(values))
    setSaveStatus(`Saved at ${new Date().toLocaleTimeString()}`)
  }

  const saveToDatabase = () => {
    const values = getValues()
    const hasAnyValue = Object.values(values).some((value) => value.trim() !== '')
    if (!hasAnyValue) {
      setRecordStatus('请先填写至少一个字段，再保存到数据库。')
      return
    }

    const nextRecord: ReferenceRecord = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      createdBy: currentUsername || 'unknown',
      ...values,
    }

    const nextRecords = [nextRecord, ...referenceRecords]
    setReferenceRecords(nextRecords)
    localStorage.setItem(REFERENCE_RECORDS_STORAGE_KEY, JSON.stringify(nextRecords))
    setRecordStatus(`已写入数据库记录（${new Date(nextRecord.createdAt).toLocaleString()}）`)
  }

  const deleteReferenceRecord = (id: string) => {
    const nextRecords = referenceRecords.filter((record) => record.id !== id)
    setReferenceRecords(nextRecords)
    localStorage.setItem(REFERENCE_RECORDS_STORAGE_KEY, JSON.stringify(nextRecords))
    setRecordStatus('已删除一条数据库记录。')
  }

  const clearReferenceRecords = () => {
    const shouldClear = window.confirm('确认清空全部数据库记录吗？')
    if (!shouldClear) {
      return
    }

    setReferenceRecords([])
    localStorage.setItem(REFERENCE_RECORDS_STORAGE_KEY, JSON.stringify([]))
    setRecordStatus('已清空全部数据库记录。')
  }

  const onLoginSubmit = ({ username, password }: LoginFormValues) => {
    const normalizedUsername = username.trim()
    const adminMatched =
      ADMIN_ACCOUNT.username === normalizedUsername && ADMIN_ACCOUNT.password === password.trim()
    const matchedClient = clientAccounts.find(
      (account) => account.username === normalizedUsername && account.password === password.trim(),
    )

    if (adminMatched) {
      setIsAuthenticated(true)
      setCurrentUsername(ADMIN_ACCOUNT.username)
      setLoginError('')
      localStorage.setItem('hscode-authenticated', 'true')
      localStorage.setItem('hscode-auth-user', ADMIN_ACCOUNT.username)
      resetLoginForm({ username: '', password: '' })
      return
    }

    if (matchedClient) {
      if (isExpired(matchedClient.expiresAt)) {
        setLoginError('账号已过期，请联系管理员续期。')
        return
      }

      setIsAuthenticated(true)
      setCurrentUsername(matchedClient.username)
      setLoginError('')
      localStorage.setItem('hscode-authenticated', 'true')
      localStorage.setItem('hscode-auth-user', matchedClient.username)
      resetLoginForm({ username: '', password: '' })
      return
    }

    setLoginError('账号或密码错误。')
  }

  const logout = () => {
    setIsAuthenticated(false)
    setCurrentUsername('')
    setActivePage('workspace')
    setLoginError('')
    localStorage.removeItem('hscode-authenticated')
    localStorage.removeItem('hscode-auth-user')
  }

  const onCreateAccount = ({ username, password, confirmPassword, validDays }: CreateAccountFormValues) => {
    const normalizedUsername = username.trim()
    if (!normalizedUsername || !password.trim()) {
      setAccountStatus('请输入客户账号和密码。')
      return
    }

    if (password !== confirmPassword) {
      setAccountStatus('两次密码输入不一致。')
      return
    }

    if (!Number.isFinite(validDays) || validDays <= 0) {
      setAccountStatus('有效期天数必须大于 0。')
      return
    }

    const exists = [ADMIN_ACCOUNT, ...clientAccounts].some(
      (account) => account.username.toLowerCase() === normalizedUsername.toLowerCase(),
    )
    if (exists) {
      setAccountStatus('该账号已存在，请换一个用户名。')
      return
    }

    const nextAccounts = [
      ...clientAccounts,
      { username: normalizedUsername, password, expiresAt: toExpiryDate(validDays) },
    ]
    setClientAccounts(nextAccounts)
    localStorage.setItem(CLIENT_ACCOUNTS_STORAGE_KEY, JSON.stringify(nextAccounts))
    resetAccountForm({ username: '', password: '', confirmPassword: '', validDays: DEFAULT_VALID_DAYS })
    setAccountStatus(`客户账号 ${normalizedUsername} 创建成功，有效期 ${validDays} 天。`)
  }

  const updateClientAccounts = (nextAccounts: ClientAccount[]) => {
    setClientAccounts(nextAccounts)
    localStorage.setItem(CLIENT_ACCOUNTS_STORAGE_KEY, JSON.stringify(nextAccounts))
  }

  const onResetClientPassword = (username: string) => {
    const newPassword = window.prompt(`请输入 ${username} 的新密码：`)
    if (!newPassword || !newPassword.trim()) {
      return
    }

    const nextAccounts = clientAccounts.map((account) =>
      account.username === username ? { ...account, password: newPassword.trim() } : account,
    )
    updateClientAccounts(nextAccounts)
    setAccountStatus(`已更新 ${username} 的密码。`)
  }

  const onExtendClientExpiry = (username: string) => {
    const daysText = window.prompt(`为 ${username} 续期多少天？`, `${DEFAULT_VALID_DAYS}`)
    if (!daysText) {
      return
    }

    const days = Number(daysText)
    if (!Number.isFinite(days) || days <= 0) {
      setAccountStatus('续期天数必须大于 0。')
      return
    }

    const nextAccounts = clientAccounts.map((account) => {
      if (account.username !== username) {
        return account
      }

      return {
        ...account,
        expiresAt: extendExpiryDate(account.expiresAt, days),
      }
    })
    updateClientAccounts(nextAccounts)
    setAccountStatus(`已为 ${username} 续期 ${days} 天。`)
  }

  const onDeleteClientAccount = (username: string) => {
    const confirmDelete = window.confirm(`确认删除客户账号 ${username} 吗？`)
    if (!confirmDelete) {
      return
    }

    const nextAccounts = clientAccounts.filter((account) => account.username !== username)
    updateClientAccounts(nextAccounts)
    setAccountStatus(`已删除客户账号 ${username}。`)
  }

  const setFieldValue = (
    doc: Document,
    selectors: string[],
    value: string,
  ): HTMLInputElement | HTMLTextAreaElement | null => {
    if (!value) {
      return null
    }

    for (const selector of selectors) {
      const node = doc.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)
      if (!node) {
        continue
      }

      node.focus()
      node.value = value
      node.dispatchEvent(new Event('input', { bubbles: true }))
      node.dispatchEvent(new Event('change', { bubbles: true }))
      return node
    }

    return null
  }

  const setFallbackHsCodeField = (doc: Document, value: string) => {
    if (!value) {
      return null
    }

    const textInputs = Array.from(
      doc.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])'),
    ).filter((input) => !input.disabled && !input.readOnly && input.type !== 'hidden')

    const preferredInput =
      textInputs.find((input) => {
        const key = `${input.name} ${input.id} ${input.placeholder}`.toLowerCase()
        return (
          key.includes('hs') ||
          key.includes('tariff') ||
          key.includes('search') ||
          key.includes('item') ||
          key.includes('pct')
        )
      }) ?? textInputs[0]

    if (!preferredInput) {
      return null
    }

    preferredInput.focus()
    preferredInput.value = value
    preferredInput.dispatchEvent(new Event('input', { bubbles: true }))
    preferredInput.dispatchEvent(new Event('change', { bubbles: true }))
    return preferredInput
  }

  const autofillCurrentTool = () => {
    const iframe = iframeRef.current
    if (!iframe?.contentWindow?.document) {
      setFillStatus('Iframe is not ready yet.')
      return
    }

    try {
      const doc = iframe.contentWindow.document
      const values = getValues()

      const hsCodeSelectors =
        selectedTool === 'tariff'
          ? [
              'input[name*="Tariff"]',
              'input[id*="Tariff"]',
              'input[name*="PCT"]',
              'input[id*="PCT"]',
              'input[name*="Item"]',
              'input[id*="Item"]',
              'input[name*="Search"]',
              'input[id*="Search"]',
              'input[name*="txtSearch"]',
              'input[id*="txtSearch"]',
              'input[name*="HSCode"]',
              'input[id*="HSCode"]',
              'input[name*="txtHSCode"]',
              'input[id*="txtHSCode"]',
            ]
          : [
              'input[name*="HSCode"]',
              'input[id*="HSCode"]',
              'input[name*="txtHSCode"]',
              'input[id*="txtHSCode"]',
            ]

      const hsCodeInput =
        setFieldValue(doc, hsCodeSelectors, values.hsCodeQuery) ??
        (selectedTool === 'tariff' ? setFallbackHsCodeField(doc, values.hsCodeQuery) : null)

      const quantityInput =
        selectedTool === 'duty'
          ? setFieldValue(
              doc,
              [
                'input[name*="Quantity"]',
                'input[id*="Quantity"]',
                'input[name*="Qty"]',
                'input[id*="Qty"]',
              ],
              values.quantity,
            )
          : null

      const valueInput = setFieldValue(
        doc,
        [
          'input[name*="UnitPrice"]',
          'input[id*="UnitPrice"]',
          'input[name*="UnitValue"]',
          'input[id*="UnitValue"]',
          'input[name*="Value"]',
          'input[id*="Value"]',
        ],
        values.unitValue,
      )

      const descriptionInput =
        selectedTool === 'history'
          ? setFieldValue(
              doc,
              [
                'input[name*="Description"]',
                'input[id*="Description"]',
                'input[name*="Desc"]',
                'input[id*="Desc"]',
              ],
              values.description,
            )
          : null

      const originInput =
        selectedTool === 'history'
          ? setFieldValue(
              doc,
              ['input[name*="Origin"]', 'input[id*="Origin"]'],
              values.origin,
            )
          : null

      const currencyInput =
        selectedTool === 'history'
          ? setFieldValue(
              doc,
              ['input[name*="Currency"]', 'input[id*="Currency"]'],
              values.currency,
            )
          : null

      setFieldValue(
        doc,
        ['textarea[name*="Notes"]', 'textarea[id*="Notes"]', 'input[name*="Notes"]'],
        values.notes,
      )

      if (!hsCodeInput && !quantityInput && !valueInput && !descriptionInput && !originInput && !currencyInput) {
        setFillStatus('No matching fields found on this page yet.')
        return
      }

      setFillStatus('Auto-filled available fields. Please review and submit on WebOC.')
    } catch {
      setFillStatus('Cannot access iframe form fields on this page.')
    }
  }

  const goToTool = (toolKey: ToolKey) => {
    dispatch(selectTool(toolKey))
    setFillStatus('')
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-slate-100 p-4 text-slate-900 md:p-6">
        <div className="mx-auto mt-12 w-full max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <h1 className="text-2xl font-bold">登录</h1>
          <p className="mt-2 text-sm text-slate-600">登录后进入 HS Code Workspace。</p>

          <form onSubmit={handleLoginSubmit(onLoginSubmit)} className="mt-5 space-y-3">
            <input
              {...registerLogin('username')}
              type="text"
              placeholder="用户名"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <input
              {...registerLogin('password')}
              type="password"
              placeholder="密码"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              登录
            </button>
          </form>

          {loginError ? <p className="mt-3 text-sm text-rose-600">{loginError}</p> : null}
     
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 md:p-6">
        <header className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold md:text-3xl">HS Code Workspace</h1>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
                当前用户：{currentUsername || '未知'}
              </span>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
              >
                退出登录
              </button>
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            One place to open tariff lookup, import history, and duty calculator.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActivePage('workspace')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                activePage === 'workspace'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              工作台
            </button>
            <button
              type="button"
              onClick={() => setActivePage('records')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                activePage === 'records'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              数据库记录
            </button>
          </div>
        </header>

        {currentUsername === ADMIN_ACCOUNT.username ? (
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-3 text-lg font-semibold">创建客户账户</h2>
            <form onSubmit={handleAccountSubmit(onCreateAccount)} className="grid gap-3 md:grid-cols-4">
              <input
                {...registerAccount('username')}
                type="text"
                placeholder="客户账号"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <input
                {...registerAccount('password')}
                type="password"
                placeholder="密码"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <input
                {...registerAccount('confirmPassword')}
                type="password"
                placeholder="确认密码"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <input
                {...registerAccount('validDays', { valueAsNumber: true })}
                type="number"
                min={1}
                placeholder="有效期天数（默认30）"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <div className="md:col-span-4 flex items-center gap-3">
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  创建账号
                </button>
                {accountStatus ? <p className="text-sm text-slate-600">{accountStatus}</p> : null}
              </div>
            </form>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="text-slate-600">
                    <th className="px-2 py-2 font-medium">客户账号</th>
                    <th className="px-2 py-2 font-medium">到期时间</th>
                    <th className="px-2 py-2 font-medium">剩余天数</th>
                    <th className="px-2 py-2 font-medium">状态</th>
                    <th className="px-2 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {clientAccounts.length === 0 ? (
                    <tr>
                      <td className="px-2 py-3 text-slate-500" colSpan={5}>
                        暂无客户账号
                      </td>
                    </tr>
                  ) : (
                    clientAccounts.map((account) => {
                      const expired = isExpired(account.expiresAt)
                      return (
                        <tr key={account.username} className="border-t border-slate-200">
                          <td className="px-2 py-2">{account.username}</td>
                          <td className="px-2 py-2">
                            {new Date(account.expiresAt).toLocaleString()}
                          </td>
                          <td className="px-2 py-2">{getDaysLeft(account.expiresAt)}</td>
                          <td className={`px-2 py-2 ${expired ? 'text-rose-600' : 'text-emerald-700'}`}>
                            {expired ? '已过期' : '有效'}
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => onResetClientPassword(account.username)}
                                className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-200"
                              >
                                修改密码
                              </button>
                              <button
                                type="button"
                                onClick={() => onExtendClientExpiry(account.username)}
                                className="rounded-md bg-blue-100 px-2.5 py-1 text-xs text-blue-700 hover:bg-blue-200"
                              >
                                续期
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteClientAccount(account.username)}
                                className="rounded-md bg-rose-100 px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-200"
                              >
                                删除
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activePage === 'workspace' ? (
          <>
            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap gap-2">
                {tools.map((tool) => {
                  const isActive = tool.key === selectedTool

                  return (
                    <button
                      key={tool.key}
                      type="button"
                      onClick={() => goToTool(tool.key)}
                      className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {tool.label}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <h2 className="mb-3 text-lg font-semibold">Quick Reference Form</h2>
              <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 md:grid-cols-4">
                <input
                  {...register('hsCodeQuery')}
                  type="text"
                  placeholder="HS Code"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <input
                  {...register('quantity')}
                  type="text"
                  placeholder="Quantity (optional)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <input
                  {...register('unitValue')}
                  type="text"
                  placeholder="Unit Value (optional)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <input
                  {...register('description')}
                  type="text"
                  placeholder="Description (optional)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <input
                  {...register('origin')}
                  type="text"
                  placeholder="Origin (optional)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <input
                  {...register('currency')}
                  type="text"
                  placeholder="Currency (optional)"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <input
                  {...register('notes')}
                  type="text"
                  placeholder="Notes"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <div className="md:col-span-4 flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Save Reference
                  </button>
                  <button
                    type="button"
                    onClick={saveToDatabase}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    保存到数据库
                  </button>
                  <button
                    type="button"
                    onClick={autofillCurrentTool}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                  >
                    Auto Fill Current Page
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      reset({
                        hsCodeQuery: '',
                        quantity: '',
                        unitValue: '',
                        description: '',
                        origin: '',
                        currency: '',
                        notes: '',
                      })
                      dispatch(
                        updateForm({
                          hsCodeQuery: '',
                          quantity: '',
                          unitValue: '',
                          description: '',
                          origin: '',
                          currency: '',
                          notes: '',
                        }),
                      )
                      setSaveStatus('')
                      setFillStatus('')
                    }}
                    className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Clear
                  </button>
                </div>
                <div className="md:col-span-4 space-y-1 text-xs">
                  {saveStatus ? <p className="text-emerald-700">{saveStatus}</p> : null}
                  {fillStatus ? <p className="text-slate-600">{fillStatus}</p> : null}
                  {recordStatus ? <p className="text-indigo-700">{recordStatus}</p> : null}
                </div>
              </form>
            </section>

            <section className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between px-2 pb-2 pt-1">
                <h3 className="text-base font-semibold">{currentTool.label}</h3>
                <a
                  href={currentTool.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                >
                  Open in New Tab
                </a>
              </div>
              <div className="h-[70vh] overflow-hidden rounded-xl border border-slate-200">
                <iframe
                  ref={iframeRef}
                  title={currentTool.label}
                  src={currentTool.url}
                  className="h-full w-full"
                  loading="lazy"
                />
              </div>
              <p className="px-2 pb-2 pt-3 text-xs text-slate-500">
                If this site blocks embedding, use "Open in New Tab".
              </p>
            </section>
          </>
        ) : (
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">数据库记录</h2>
              <button
                type="button"
                onClick={clearReferenceRecords}
                className="rounded-lg bg-rose-100 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-200"
              >
                清空全部记录
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="text-slate-600">
                    <th className="px-2 py-2 font-medium">时间</th>
                    <th className="px-2 py-2 font-medium">用户</th>
                    <th className="px-2 py-2 font-medium">HS Code</th>
                    <th className="px-2 py-2 font-medium">Quantity</th>
                    <th className="px-2 py-2 font-medium">Unit Value</th>
                    <th className="px-2 py-2 font-medium">Description</th>
                    <th className="px-2 py-2 font-medium">Origin</th>
                    <th className="px-2 py-2 font-medium">Currency</th>
                    <th className="px-2 py-2 font-medium">Notes</th>
                    <th className="px-2 py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {referenceRecords.length === 0 ? (
                    <tr>
                      <td className="px-2 py-3 text-slate-500" colSpan={10}>
                        暂无数据库记录
                      </td>
                    </tr>
                  ) : (
                    referenceRecords.map((record) => (
                      <tr key={record.id} className="border-t border-slate-200 align-top">
                        <td className="px-2 py-2">{new Date(record.createdAt).toLocaleString()}</td>
                        <td className="px-2 py-2">{record.createdBy}</td>
                        <td className="px-2 py-2">{record.hsCodeQuery}</td>
                        <td className="px-2 py-2">{record.quantity}</td>
                        <td className="px-2 py-2">{record.unitValue}</td>
                        <td className="px-2 py-2">{record.description}</td>
                        <td className="px-2 py-2">{record.origin}</td>
                        <td className="px-2 py-2">{record.currency}</td>
                        <td className="px-2 py-2">{record.notes}</td>
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => deleteReferenceRecord(record.id)}
                            className="rounded-md bg-rose-100 px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-200"
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {recordStatus ? <p className="mt-3 text-xs text-indigo-700">{recordStatus}</p> : null}
          </section>
        )}
      </div>
    </main>
  )
}

export default App
