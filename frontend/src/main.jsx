import React from 'react'
import ReactDOM from 'react-dom/client'
import CostEstimator from './costestimator.jsx'
import './index.css' // Make sure you have an index.css with @tailwind directives

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <CostEstimator />
  </React.StrictMode>,
)