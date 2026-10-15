import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages يخدم الموقع من https://USERNAME.github.io/REPO/ لذا يجب أن تكون base = '/REPO/'.
// داخل GitHub Actions نقرأ اسم المستودع تلقائياً من GITHUB_REPOSITORY (owner/repo).
// يمكن فرض قيمة أخرى بالمتغير VITE_BASE. محلياً تبقى '/'.
function resolveBase(): string {
  if (process.env.VITE_BASE) return process.env.VITE_BASE
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
  if (!repo) return '/'
  // مستودع USERNAME.github.io يُنشر على جذر النطاق
  if (repo.toLowerCase().endsWith('.github.io')) return '/'
  return `/${repo}/`
}

// https://vite.dev/config/
export default defineConfig({
  base: resolveBase(),
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // مكتبة Firebase كبيرة؛ نفصلها في ملفات خاصة بها لتُخزَّن في المتصفح بشكل مستقل
        codeSplitting: {
          groups: [
            { name: 'firebase-firestore', test: /node_modules[\\/]@firebase[\\/]firestore/ },
            { name: 'firebase', test: /node_modules[\\/](@?firebase|@grpc|protobufjs)/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
})
