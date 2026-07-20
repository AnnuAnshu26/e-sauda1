/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// <model-viewer> is a plain web component loaded via <script> in index.html
// (see SpaceFitViewer.tsx) — this just tells JSX it's a legal tag and what
// attributes we actually use on it.
declare namespace JSX {
  interface IntrinsicElements {
    'model-viewer': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string
        ar?: boolean
        'ar-modes'?: string
        'camera-controls'?: boolean
        'auto-rotate'?: boolean
        'shadow-intensity'?: string
        alt?: string
      },
      HTMLElement
    >
  }
}
