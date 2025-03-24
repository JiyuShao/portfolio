import { createContext, useContext } from 'react'

const ConfigContext = createContext(undefined)

export function ConfigProvider({ value, children }) {
  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  )
}

export function useConfig() {
  return useContext(ConfigContext)
}

export async function getConfig() {
  const config = typeof window === 'object'
    ? await fetch('/api/config').then(res => res.json())
    : await import('@/lib/server/config').then(module => module.clientConfig)
  return config
}
