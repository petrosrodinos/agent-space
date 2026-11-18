import * as React from 'react'

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Read the width on the first render: starting as "not mobile" made pages act on a desktop value for one frame
  // (e.g. /settings redirected to /settings/profile on phones).
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(() => (typeof window === 'undefined' ? undefined : window.innerWidth < MOBILE_BREAKPOINT))

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener('change', onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return !!isMobile
}
