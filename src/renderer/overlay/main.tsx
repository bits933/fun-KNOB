import { createRoot } from 'react-dom/client'
import '@renderer/styles/tokens.css'
import './overlay.css'
import { Overlay } from './Overlay'
import { useOverlayData } from './data'
import { listenForDj } from './dj'

// ?bg=#444 paints a backdrop so screenshots of the transparent page can be compared with Figma.
const bg = new URLSearchParams(location.search).get('bg')
if (bg) document.documentElement.style.background = bg
if (window.kreo?.windowKind === 'overlay') listenForDj(window.kreo)

function App(): React.JSX.Element {
  return <Overlay data={useOverlayData()} />
}

createRoot(document.getElementById('root')!).render(<App />)
