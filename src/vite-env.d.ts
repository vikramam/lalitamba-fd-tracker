/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'heic2any' {
  export default function heic2any(options: {
    blob: Blob
    toType?: string
    quality?: number
  }): Promise<Blob | Blob[]>
}
