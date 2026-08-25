// Global declaration for UliBot widget function
declare global {
  interface Window {
    insertUliBotWidget: (params: any) => void;
  }
}

import { useEffect, useState } from 'react'
import EvaluationViewer from './EvaluationViewer'
import { LOCAL_BACKEND_URL, LOCAL_SITE_TOKEN } from './localConfig'

function WidgetTestApp() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 1. Load the widget script from the running frontend
    const script = document.createElement('script');
    // Updated to point to port 3000 where the docker container is running
    script.src = "http://localhost:3000/widget.js"; 
    script.async = true;
    script.onload = () => {
      console.log('Widget script loaded');
      setMounted(true);
    };
    script.onerror = (e) => {
      console.error('Failed to load widget script', e);
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup if needed
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (mounted && window.insertUliBotWidget) {
      console.log('Initializing Ulibot Widget...');
      
      // 2. Initialize the widget
      window.insertUliBotWidget({
        // Point to the frontend serving the assets
        url: "http://localhost:3000", 
        
        // Use the token from seed.sql (for 'Ulibot Site' on localhost)
        token: LOCAL_SITE_TOKEN,
        
        // Point to local backend API
        backurl: LOCAL_BACKEND_URL,

        // Enable Vite dev server mode for HMR assets
        dev: true,
        
        // Mode: "0" = widget (floating), "1" = inline
        displaymode: "0",
      });

      // 2. Initialize Inline (delayed to bypass singleton check)
      setTimeout(() => {
        console.log('Initializing Inline Widget...');
        // Hack: Reset mount flag to allow second instance
        // @ts-ignore
        window.__ulibotMounted = false;

        window.insertUliBotWidget({
          url: "http://localhost:3000", 
          token: LOCAL_SITE_TOKEN,
          backurl: LOCAL_BACKEND_URL,
          dev: true,
          context: "general",
          contextinstance: "inline",
        });
      }, 1000);
    }
  }, [mounted]);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      textAlign: 'center',
      minHeight: '100vh',
      padding: '2rem' 
    }}>
      <h1>UliBot Test App</h1>
      <p><a href="/evaluations">Abrir resultados de evaluación</a></p>
      <p>The chatbot should appear in the bottom right corner (Shadow DOM).</p>
      <div className="card">
        <p>
          Edit <code>src/App.tsx</code> to test different configurations.
        </p>
      </div>
      <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid #ccc', width: '100%', maxWidth: '800px' }}>
        <h2>Inline Test Area</h2>
        <div id="ulibot-inline-container" style={{ minHeight: '500px', border: '1px solid #666' }}>
        </div>
      </div>
    </div>
  )
}

function App() {
  if (window.location.pathname.startsWith('/evaluations')) {
    return <EvaluationViewer />
  }

  return <WidgetTestApp />
}

export default App
