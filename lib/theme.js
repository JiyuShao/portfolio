import { createContext, useContext, useEffect, useState } from 'react'

const initialTheme = ''
const ThemeContext = createContext({ theme: initialTheme, setTheme: (_theme) => { } })

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.theme
    // Default to light when nothing is stored — without a non-empty theme the
    // toggle renders nothing and the theme can never be switched at all.
    const next = stored === 'light' || stored === 'dark' ? stored : 'light'
    setTheme(next)
    document.documentElement.classList.toggle('dark', next === 'dark')
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export default function useTheme() {
  return useContext(ThemeContext)
}
