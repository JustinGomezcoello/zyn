import { useState, useEffect, useCallback } from 'react'

interface Options<T> {
    serialize?: (val: T) => string
    deserialize?: (str: string) => T
}

export function usePersistentState<T>(key: string, initialValue: T, options?: Options<T>): [T, React.Dispatch<React.SetStateAction<T>>] {
    const serialize = options?.serialize || JSON.stringify
    const deserialize = options?.deserialize || JSON.parse

    // Inicializar el estado leyendo desde sessionStorage
    const [state, setState] = useState<T>(() => {
        try {
            const item = window.sessionStorage.getItem(key)
            return item ? deserialize(item) : initialValue
        } catch (error) {
            console.warn(`Error reading sessionStorage key "${key}":`, error)
            return initialValue
        }
    })

    // Memoize the stringification to avoid unnecessary writes
    const serializedState = serialize(state)

    // Actualizar sessionStorage cuando el estado cambie
    useEffect(() => {
        try {
            window.sessionStorage.setItem(key, serializedState)
        } catch (error) {
            console.warn(`Error setting sessionStorage key "${key}":`, error)
        }
    }, [key, serializedState])

    return [state, setState]
}
