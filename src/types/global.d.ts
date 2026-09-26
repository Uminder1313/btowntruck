/** Analytics tracker injected by the platform; always optional. */
interface SuperCoolTracker {
  track?: (event: string, props?: Record<string, string | number | boolean | null>) => void;
}

interface Window {
  supercool?: SuperCoolTracker;
  __SUPERCOOL_GATEWAY__?: unknown;
}
