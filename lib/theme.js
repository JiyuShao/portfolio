import { createContext, useContext, useEffect, useState } from 'react'

const initialTheme = ''
const ThemeContext = createContext({ theme: initialTheme, setTheme: (_theme) => { } })

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme)

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export default function useTheme() {
  return useContext(ThemeContext)
}
