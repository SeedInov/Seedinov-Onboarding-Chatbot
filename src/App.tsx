import { ConsolePage } from './pages/ConsolePage';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './App.scss';

function App() {
  return (
    <BrowserRouter basename="/app">
      <div data-component="App">
        <Routes>
          <Route path="/seed/chatbot" element={<ConsolePage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
