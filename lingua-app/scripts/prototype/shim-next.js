// Static-preview shim for next/navigation (no Next runtime).
export function usePathname(){ return "/"; }
export function useRouter(){ return { push(){}, replace(){}, back(){}, forward(){}, refresh(){}, prefetch(){} }; }
export function useSearchParams(){ return new URLSearchParams(); }
export function useParams(){ return {}; }
export function redirect(){}
export function notFound(){}
