import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const stripFrameHeaders = (headers: Record<string, string | string[] | undefined>) => {
  delete headers['x-frame-options']
  delete headers['content-security-policy']
  delete headers['frame-options']
  delete headers['permissions-policy']
  delete headers['permissions-policy-report-only']
}

const rewriteLocationHeader = (
  headers: Record<string, string | string[] | undefined>,
  prefix: string,
) => {
  const location = headers.location
  if (typeof location !== 'string') {
    return
  }

  if (location.startsWith('/')) {
    headers.location = `${prefix}${location}`
  }

  if (location.startsWith('https://weboc.gov.pk')) {
    headers.location = location.replace('https://weboc.gov.pk', '/weboc')
  }

  if (location.startsWith('https://www.weboc.gov.pk')) {
    headers.location = location.replace('https://www.weboc.gov.pk', '/weboc-www')
  }
}

const rewriteSetCookieHeader = (headers: Record<string, string | string[] | undefined>) => {
  const setCookie = headers['set-cookie']

  if (!setCookie) {
    return
  }

  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie]
  headers['set-cookie'] = cookies.map((cookie) =>
    cookie
      // Keep cookies on localhost instead of upstream domain.
      .replace(/;\s*Domain=[^;]*/gi, '')
      // Allow dev over http://localhost.
      .replace(/;\s*Secure/gi, '')
      // SameSite=None requires Secure, so relax for local proxy.
      .replace(/;\s*SameSite=None/gi, '; SameSite=Lax'),
  )
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/WebResource.axd': {
        target: 'https://weboc.gov.pk',
        changeOrigin: true,
        secure: true,
        cookieDomainRewrite: '',
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            stripFrameHeaders(proxyRes.headers)
            rewriteSetCookieHeader(proxyRes.headers)
          })
        },
      },
      '/ScriptResource.axd': {
        target: 'https://weboc.gov.pk',
        changeOrigin: true,
        secure: true,
        cookieDomainRewrite: '',
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            stripFrameHeaders(proxyRes.headers)
            rewriteSetCookieHeader(proxyRes.headers)
          })
        },
      },
      '/weboc': {
        target: 'https://weboc.gov.pk',
        changeOrigin: true,
        secure: true,
        cookieDomainRewrite: '',
        rewrite: (path) => path.replace(/^\/weboc/, ''),
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            stripFrameHeaders(proxyRes.headers)
            rewriteLocationHeader(proxyRes.headers, '/weboc')
            rewriteSetCookieHeader(proxyRes.headers)
          })
        },
      },
      '/weboc-www': {
        target: 'https://www.weboc.gov.pk',
        changeOrigin: true,
        secure: true,
        cookieDomainRewrite: '',
        rewrite: (path) => path.replace(/^\/weboc-www/, ''),
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            stripFrameHeaders(proxyRes.headers)
            rewriteLocationHeader(proxyRes.headers, '/weboc-www')
            rewriteSetCookieHeader(proxyRes.headers)
          })
        },
      },
    },
  },
})
