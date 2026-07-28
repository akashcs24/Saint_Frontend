import { useEffect, useState } from "react";

/** True below Tailwind `lg` (1024px) — phone / small tablet. */
export function useIsMobile(breakpointPx = 1024) {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`);
    const apply = () => setMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [breakpointPx]);

  return mobile;
}
