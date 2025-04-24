import { useState } from 'react'
import './App.css'

function App() {
  const [num1, setNum1] = useState(0)
  const [num2, setNum2] = useState(0)
  const [result, setResult] = useState(0)

  const handleAdd = async () => {
    try {
      const response = await fetch(`http://localhost:8000/api/add?a=${num1}&b=${num2}`)
      const data = await response.json()
      setResult(data.result)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Addition Calculator</h1>
      <div className="space-y-4">
        <div>
          <input
            type="number"
            value={num1}
            onChange={(e) => setNum1(Number(e.target.value))}
            className="border p-2 mr-2"
          />
          <span className="text-2xl">+</span>
          <input
            type="number"
            value={num2}
            onChange={(e) => setNum2(Number(e.target.value))}
            className="border p-2 ml-2"
          />
        </div>
        <button
          onClick={handleAdd}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Add
        </button>
        <div className="text-xl">
          Result: {result}
        </div>
      </div>
    </div>
  )
}

export default App
