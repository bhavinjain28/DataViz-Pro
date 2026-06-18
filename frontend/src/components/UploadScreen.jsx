import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { uploadFile } from '../utils/api.js'
import { generateSampleCsv } from '../utils/sampleData.js'
import ThemeToggle from './ThemeToggle.jsx'

const heroContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.3 } },
}
const heroItem = {
  hidden: { opacity: 0, y: 16, filter: 'blur(4px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
}

const PARTICLE_COLORS = ['#6c63ff', '#ff6584', '#43e97b', '#f7971e']

function makeParticles() {
  return Array.from({ length: 12 }, (_, i) => ({
    id: i,
    angle: (i / 12) * 360,
    distance: 60 + Math.random() * 40,
    color: PARTICLE_COLORS[i % 4],
    size: 4 + Math.random() * 6,
  }))
}

// The animated hero SVG from the original index.html, preserved verbatim
// (bar chart + line chart + scatter + donut arc + sparkline). Injected as a
// raw SVG string so every attribute and animation matches the original.
const HERO_SVG = `<svg viewBox="0 0 900 340" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">

  <!-- GRID LINES -->
  <g opacity=".18" stroke="rgba(108,99,255,.6)" stroke-width=".8" stroke-dasharray="4 10">
    <line x1="0"   y1="68"  x2="900" y2="68"/>
    <line x1="0"   y1="136" x2="900" y2="136"/>
    <line x1="0"   y1="204" x2="900" y2="204"/>
    <line x1="0"   y1="272" x2="900" y2="272"/>
    <line x1="112" y1="0"   x2="112" y2="340"/>
    <line x1="224" y1="0"   x2="224" y2="340"/>
    <line x1="450" y1="0"   x2="450" y2="340"/>
    <line x1="676" y1="0"   x2="676" y2="340"/>
    <line x1="788" y1="0"   x2="788" y2="340"/>
  </g>

  <!-- BAR CHART — left side -->
  <g transform="translate(30,20)">
    <line x1="0" y1="290" x2="230" y2="290" stroke="rgba(108,99,255,.3)" stroke-width="1"/>
    <g transform-origin="15 290" style="animation:barRise 3.1s ease-in-out infinite">
      <rect x="5"   y="170" width="22" height="120" rx="3" fill="url(#b1)" opacity=".75"/>
    </g>
    <g transform-origin="45 290" style="animation:barRise2 2.7s ease-in-out infinite .3s">
      <rect x="35"  y="110" width="22" height="180" rx="3" fill="url(#b2)" opacity=".75"/>
    </g>
    <g transform-origin="75 290" style="animation:barRise 3.4s ease-in-out infinite .6s">
      <rect x="65"  y="150" width="22" height="140" rx="3" fill="url(#b3)" opacity=".75"/>
    </g>
    <g transform-origin="105 290" style="animation:barRise2 2.9s ease-in-out infinite .9s">
      <rect x="95"  y="80"  width="22" height="210" rx="3" fill="url(#b1)" opacity=".75"/>
    </g>
    <g transform-origin="135 290" style="animation:barRise 3.6s ease-in-out infinite 1.1s">
      <rect x="125" y="130" width="22" height="160" rx="3" fill="url(#b4)" opacity=".75"/>
    </g>
    <g transform-origin="165 290" style="animation:barRise2 3.2s ease-in-out infinite 1.4s">
      <rect x="155" y="200" width="22" height="90"  rx="3" fill="url(#b2)" opacity=".75"/>
    </g>
    <g transform-origin="195 290" style="animation:barRise 2.8s ease-in-out infinite 1.7s">
      <rect x="185" y="55"  width="22" height="235" rx="3" fill="url(#b3)" opacity=".75"/>
    </g>
  </g>

  <!-- LINE CHART — spans full width -->
  <path d="M0,240 C60,200 120,160 180,180 C240,200 300,140 360,120 C420,100 480,150 540,130 C600,110 660,160 720,140 C780,120 840,170 900,150 L900,340 L0,340 Z"
        fill="url(#linefill)" opacity=".35"
        style="animation:fadeWave 5s ease-in-out infinite"/>
  <path d="M0,240 C60,200 120,160 180,180 C240,200 300,140 360,120 C420,100 480,150 540,130 C600,110 660,160 720,140 C780,120 840,170 900,150"
        fill="none" stroke="rgba(108,99,255,.6)" stroke-width="2"
        stroke-dasharray="1000" stroke-dashoffset="0"
        style="animation:fadeWave 5s ease-in-out infinite"/>
  <path d="M0,280 C80,250 150,220 220,240 C290,260 360,200 430,190 C500,180 570,210 640,195 C710,180 790,220 900,200"
        fill="none" stroke="rgba(255,101,132,.45)" stroke-width="1.5" stroke-dasharray="8 5"
        style="animation:fadeWave 6s ease-in-out infinite 1s"/>

  <!-- Data points on line 1 -->
  <circle cx="0"   cy="240" r="3.5" fill="rgba(108,99,255,.8)" style="animation:dotPulse 3s infinite 0s"/>
  <circle cx="180" cy="180" r="3.5" fill="rgba(108,99,255,.8)" style="animation:dotPulse 3s infinite .4s"/>
  <circle cx="360" cy="120" r="3.5" fill="rgba(108,99,255,.8)" style="animation:dotPulse 3s infinite .8s"/>
  <circle cx="540" cy="130" r="3.5" fill="rgba(108,99,255,.8)" style="animation:dotPulse 3s infinite 1.2s"/>
  <circle cx="720" cy="140" r="3.5" fill="rgba(108,99,255,.8)" style="animation:dotPulse 3s infinite 1.6s"/>
  <circle cx="900" cy="150" r="3.5" fill="rgba(108,99,255,.8)" style="animation:dotPulse 3s infinite 2s"/>

  <!-- SCATTER DOTS — right side -->
  <g opacity=".65">
    <circle cx="720" cy="60"  r="5" fill="rgba(67,233,123,.7)"  style="animation:dotFloat 3.2s ease-in-out infinite 0s"/>
    <circle cx="755" cy="110" r="3" fill="rgba(108,99,255,.7)"  style="animation:dotFloat 2.8s ease-in-out infinite .5s"/>
    <circle cx="790" cy="75"  r="4" fill="rgba(255,101,132,.7)" style="animation:dotFloat 3.5s ease-in-out infinite .2s"/>
    <circle cx="820" cy="130" r="3" fill="rgba(247,151,30,.7)"  style="animation:dotFloat 3.0s ease-in-out infinite .8s"/>
    <circle cx="840" cy="55"  r="5" fill="rgba(86,204,242,.7)"  style="animation:dotFloat 2.6s ease-in-out infinite 1s"/>
    <circle cx="870" cy="95"  r="3" fill="rgba(67,233,123,.7)"  style="animation:dotFloat 3.3s ease-in-out infinite .3s"/>
    <circle cx="745" cy="155" r="4" fill="rgba(255,101,132,.7)" style="animation:dotFloat 2.9s ease-in-out infinite .7s"/>
    <circle cx="800" cy="30"  r="3" fill="rgba(108,99,255,.7)"  style="animation:dotFloat 3.1s ease-in-out infinite 1.2s"/>
    <circle cx="860" cy="170" r="4" fill="rgba(247,151,30,.7)"  style="animation:dotFloat 2.7s ease-in-out infinite .4s"/>
    <line x1="715" y1="180" x2="885" y2="30" stroke="rgba(108,99,255,.25)" stroke-width="1.5" stroke-dasharray="5 5"/>
  </g>

  <!-- DONUT ARC — top-center, half above fold -->
  <g transform="translate(450,-60)" style="animation:arcSpin 18s linear infinite; transform-origin:450px -60px">
    <path d="M0,0 m-110,0 a110,110 0 0,1 95.26,-55 l-38.1,66 a44,44 0 0,0,-38.1,22 Z"
          fill="rgba(108,99,255,.18)" stroke="rgba(108,99,255,.35)" stroke-width="1"/>
    <path d="M0,0 m-110,0 a110,110 0 0,0 95.26,55 l-38.1,-66 a44,44 0 0,1,-38.1,-22 Z"
          fill="rgba(255,101,132,.14)" stroke="rgba(255,101,132,.3)" stroke-width="1"/>
    <path d="M0,0 m110,0 a110,110 0 0,1 -55,95.26 l-22,-38.1 a44,44 0 0,0,22,-38.1 Z"
          fill="rgba(67,233,123,.12)" stroke="rgba(67,233,123,.28)" stroke-width="1"/>
    <path d="M0,0 m110,0 a110,110 0 0,0 -55,-95.26 l22,38.1 a44,44 0 0,1,22,38.1 Z"
          fill="rgba(247,151,30,.12)" stroke="rgba(247,151,30,.28)" stroke-width="1"/>
  </g>

  <!-- SPARKLINE — top strip -->
  <path d="M0,28 C50,20 90,35 140,18 C190,8 230,30 280,22 C330,14 370,32 420,16 C470,5 510,28 560,14 C610,4 650,26 700,10 C750,0 800,22 850,8 C880,2 900,15 900,15"
        fill="none" stroke="rgba(67,233,123,.4)" stroke-width="1.5"
        style="animation:fadeWave 7s ease-in-out infinite 2s"/>

  <!-- SPARKLE DOTS scattered -->
  <circle cx="270" cy="50"  r="2" fill="rgba(255,210,0,.6)"  style="animation:sparkle 2.4s infinite 0s"/>
  <circle cx="500" cy="30"  r="1.5" fill="rgba(255,255,255,.5)" style="animation:sparkle 3.1s infinite .6s"/>
  <circle cx="650" cy="55"  r="2" fill="rgba(108,99,255,.6)"  style="animation:sparkle 2.8s infinite 1.2s"/>
  <circle cx="100" cy="40"  r="1.5" fill="rgba(255,101,132,.5)" style="animation:sparkle 3.3s infinite 1.8s"/>

  <!-- GRADIENTS -->
  <defs>
    <linearGradient id="b1" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(108,99,255,.85)"/>
      <stop offset="100%" stop-color="rgba(108,99,255,.08)"/>
    </linearGradient>
    <linearGradient id="b2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(255,101,132,.85)"/>
      <stop offset="100%" stop-color="rgba(255,101,132,.08)"/>
    </linearGradient>
    <linearGradient id="b3" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(67,233,123,.85)"/>
      <stop offset="100%" stop-color="rgba(67,233,123,.08)"/>
    </linearGradient>
    <linearGradient id="b4" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(247,151,30,.85)"/>
      <stop offset="100%" stop-color="rgba(247,151,30,.08)"/>
    </linearGradient>
    <linearGradient id="linefill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(108,99,255,.35)"/>
      <stop offset="100%" stop-color="rgba(108,99,255,.0)"/>
    </linearGradient>
  </defs>
</svg>`

const ACCEPT = {
  'text/csv': ['.csv'],
  'text/tab-separated-values': ['.tsv'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/json': ['.json', '.jsonl'],
}

export default function UploadScreen({ onLoaded, theme, onToggleTheme }) {
  const [status, setStatus] = useState('idle') // idle | processing | success
  const [particles, setParticles] = useState([])
  const [error, setError] = useState(null)

  const handleFile = useCallback(
    async (file) => {
      setError(null)
      setStatus('processing')
      try {
        const profile = await uploadFile(file)
        // Success choreography: checkmark morph + green pulse + particle
        // burst, then hand off to the dashboard transition.
        setStatus('success')
        setParticles(makeParticles())
        setTimeout(() => onLoaded(profile), 950)
      } catch (err) {
        setError(err.message)
        setStatus('idle')
      }
    },
    [onLoaded],
  )

  const onDrop = useCallback(
    (accepted, rejected) => {
      if (rejected.length > 0) {
        setError(
          `"${rejected[0].file.name}" isn't a supported format. Try CSV, XLSX, XLS, JSON, TSV, or JSONL.`,
        )
        return
      }
      if (accepted[0]) handleFile(accepted[0])
    },
    [handleFile],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPT,
    multiple: false,
    disabled: status !== 'idle',
  })

  const loadSample = () => {
    const file = new File([generateSampleCsv()], 'sample_ecommerce.csv', {
      type: 'text/csv',
    })
    handleFile(file)
  }

  return (
    <>
      <ThemeToggle id="theme-toggle-upload" theme={theme} onToggle={onToggleTheme} />

      <div id="upload-screen">
        <motion.div
          className="hero-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="hero-viz" dangerouslySetInnerHTML={{ __html: HERO_SVG }} />
          <motion.div variants={heroContainer} initial="hidden" animate="show"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}
          >
            <motion.div variants={heroItem} className="upload-eyebrow">
              ⚡ DataViz Pro
            </motion.div>
            <motion.div variants={heroItem} className="upload-logo">
              Instant Data
              <br />
              Analytics
            </motion.div>
            <motion.div variants={heroItem} className="upload-sub">
              Drop any data file and get beautiful charts, smart stats, and AI insights
              in seconds.
            </motion.div>
          </motion.div>
        </motion.div>

        <motion.div
          {...getRootProps({
            className: `drop-zone${isDragActive ? ' drag-over' : ''} status-${status}`,
          })}
          whileHover={status === 'idle' ? { scale: 1.01, y: -4 } : {}}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <input {...getInputProps()} />

          {/* Spinning dashed border while a file hovers over the zone */}
          {isDragActive && (
            <svg className="drop-ants" aria-hidden="true">
              <rect x="1" y="1" width="100%" height="100%" rx="24" />
            </svg>
          )}

          <AnimatePresence mode="wait">
            {status === 'processing' && (
              <motion.div
                key="processing"
                className="drop-state"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.2 }}
              >
                <svg className="progress-ring" viewBox="0 0 60 60">
                  <circle className="ring-track" cx="30" cy="30" r="26" />
                  <circle className="ring-head" cx="30" cy="30" r="26" />
                </svg>
                <div className="drop-title">Analyzing your data…</div>
                <div className="drop-subtitle">Parsing, profiling, and detecting patterns</div>
              </motion.div>
            )}

            {status === 'success' && (
              <motion.div
                key="success"
                className="drop-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
              >
                <motion.svg
                  className="progress-ring"
                  viewBox="0 0 60 60"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                >
                  <circle className="ring-track" cx="30" cy="30" r="26" />
                  <motion.path
                    d="M19 31 L27 39 L42 22"
                    fill="none"
                    stroke="#43e97b"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.35, delay: 0.1, ease: 'easeOut' }}
                  />
                </motion.svg>
                <div className="drop-title">Ready!</div>
                <div className="drop-subtitle">Opening your dashboard</div>
                {particles.map((p) => (
                  <motion.div
                    key={p.id}
                    style={{
                      position: 'absolute',
                      width: p.size,
                      height: p.size,
                      borderRadius: '50%',
                      background: p.color,
                      left: '50%',
                      top: '50%',
                      pointerEvents: 'none',
                    }}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{
                      x: Math.cos((p.angle * Math.PI) / 180) * p.distance,
                      y: Math.sin((p.angle * Math.PI) / 180) * p.distance,
                      opacity: 0,
                      scale: 0,
                    }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  />
                ))}
              </motion.div>
            )}

            {status === 'idle' && (
              <motion.div
                key="idle"
                className="drop-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <div className="drop-icon-wrap">📊</div>
                <div className="drop-title">
                  {isDragActive ? 'Drop it!' : 'Drop your file here'}
                </div>
                <div className="drop-subtitle">or click to browse your computer</div>
                <div className="format-badges">
                  <span className="badge badge-csv">CSV</span>
                  <span className="badge badge-excel">XLSX / XLS</span>
                  <span className="badge badge-json">JSON</span>
                  <span className="badge badge-tsv">TSV</span>
                  <span className="badge badge-ods">ODS</span>
                  <span className="badge badge-xml">XML</span>
                  <span className="badge badge-jsonl">JSONL</span>
                </div>
                <span className="btn-upload">📂 Choose File</span>
                {error && <div className="drop-error">⚠ {error}</div>}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <button className="sample-btn" onClick={loadSample} disabled={status !== 'idle'}>
          ▶ Try with sample dataset
        </button>
      </div>
    </>
  )
}
