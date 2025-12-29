import React, { useState } from 'react'
import { generateImage, checkImageProvidersStatus } from '../services/imageService'
import './ImageGeneratorPro.css'

interface GenerationState {
  loading: boolean
  imageUrl: string | null
  error: string | null
  provider: string
  fallbackUsed: boolean
  attemptCount: number
  duration: number
}

interface ProviderStatus {
  name: string
  configured: boolean
}

export const ImageGeneratorPro: React.FC = () => {
  const [prompt, setPrompt] = useState('')
  const [state, setState] = useState<GenerationState>({
    loading: false,
    imageUrl: null,
    error: null,
    provider: '',
    fallbackUsed: false,
    attemptCount: 0,
    duration: 0,
  })
  const [providers, setProviders] = useState<ProviderStatus[]>([])
  const [showProviders, setShowProviders] = useState(false)

  const handleCheckProviders = async () => {
    const status = await checkImageProvidersStatus()
    setProviders(status.providers)
    setShowProviders(true)
  }

  const handleGenerate = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const result = await generateImage(prompt)

      if (result.success && result.url) {
        setState({
          loading: false,
          imageUrl: result.url,
          error: null,
          provider: result.provider,
          fallbackUsed: result.fallbackUsed || false,
          attemptCount: result.attemptCount || 1,
          duration: result.duration || 0,
        })
      } else {
        setState({
          loading: false,
          imageUrl: null,
          error: result.error || 'Generation failed',
          provider: result.provider,
          fallbackUsed: false,
          attemptCount: result.attemptCount || 0,
          duration: result.duration || 0,
        })
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: String(error),
      }))
    }
  }

  const handleDownload = () => {
    if (state.imageUrl) {
      const link = document.createElement('a')
      link.href = state.imageUrl
      link.download = `generated-${Date.now()}.png`
      link.click()
    }
  }

  return (
    <div className="image-generator-pro">
      <div className="generator-card">
        <div className="header">
          <h1>🎨 AI Image Generator Pro</h1>
          <p className="subtitle">With 6-Provider Fallback System</p>
        </div>

        <div className="controls">
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe the image..."
            disabled={state.loading}
            className="prompt-input"
          />

          <div className="button-group">
            <button
              onClick={handleGenerate}
              disabled={state.loading || !prompt.trim()}
              className="btn btn-primary"
            >
              {state.loading ? '⏳ Generating...' : '✨ Generate'}
            </button>

            <button
              onClick={handleCheckProviders}
              disabled={state.loading}
              className="btn btn-secondary"
            >
              🔍 Check Providers
            </button>
          </div>
        </div>

        {showProviders && (
          <div className="providers-panel">
            <h3>📡 Available Providers</h3>
            <div className="providers-grid">
              {providers.map(p => (
                <div key={p.name} className={`provider-badge ${p.configured ? 'configured' : 'unconfigured'}`}>
                  <span>{p.name}</span>
                  <span>{p.configured ? '✅' : '⚠️'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {state.loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Generating...</p>
            <p className="attempt">Attempt {state.attemptCount}</p>
          </div>
        )}

        {state.error && (
          <div className="error-state">
            <p>❌ {state.error}</p>
          </div>
        )}

        {state.imageUrl && (
          <div className="result-state">
            <img src={state.imageUrl} alt="Generated" />
            <div className="result-info">
              <span className={`badge ${state.fallbackUsed ? 'fallback' : 'primary'}`}>
                {state.fallbackUsed ? '🔄' : '✅'} {state.provider}
              </span>
              <span className="duration">⏱️ {state.duration}ms</span>
            </div>
            <button onClick={handleDownload} className="btn btn-download">
              ⬇️ Download
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
