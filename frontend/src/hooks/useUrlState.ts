'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback, useMemo, useRef } from 'react'

/**
 * Hook that syncs filter/pagination state with URL search params.
 * This ensures that when a user navigates to a detail page and comes back,
 * their filters and page position are preserved.
 */
export function useUrlState<T extends Record<string, string>>(
  defaults: T
): {
  params: T
  setParam: (key: keyof T, value: string) => void
  setParams: (updates: Partial<T>) => void
  clearAll: () => void
  hasActiveFilters: (excludeKeys?: (keyof T)[]) => boolean
} {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  // Use ref to avoid stale closure issues with pathname
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  // Build current state from URL params + defaults
  const params = useMemo(() => {
    const result = { ...defaults }
    for (const key of Object.keys(defaults) as (keyof T)[]) {
      const urlValue = searchParams.get(key as string)
      if (urlValue !== null) {
        (result as any)[key] = urlValue
      }
    }
    return result
  }, [searchParams, defaults])

  // Update URL params (replace, not push — so we don't pollute history with every filter change)
  const updateUrl = useCallback(
    (newParams: Partial<T>) => {
      const current = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(newParams)) {
        if (value === defaults[key as keyof T] || !value) {
          current.delete(key)
        } else {
          current.set(key, value as string)
        }
      }
      const qs = current.toString()
      router.replace(`${pathnameRef.current}${qs ? '?' + qs : ''}`, { scroll: false })
    },
    [searchParams, defaults, router]
  )

  const setParam = useCallback(
    (key: keyof T, value: string) => {
      updateUrl({ [key]: value } as Partial<T>)
    },
    [updateUrl]
  )

  const setParams = useCallback(
    (updates: Partial<T>) => {
      updateUrl(updates)
    },
    [updateUrl]
  )

  const clearAll = useCallback(() => {
    router.replace(pathnameRef.current, { scroll: false })
  }, [router])

  const hasActiveFilters = useCallback(
    (excludeKeys: (keyof T)[] = []) => {
      for (const key of Object.keys(defaults) as (keyof T)[]) {
        if (excludeKeys.includes(key)) continue
        const urlValue = searchParams.get(key as string)
        if (urlValue !== null && urlValue !== defaults[key]) return true
      }
      return false
    },
    [searchParams, defaults]
  )

  return { params, setParam, setParams, clearAll, hasActiveFilters }
}
