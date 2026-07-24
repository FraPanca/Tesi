import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../style/Login.css';


function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destinazione = location.state?.from?.pathname || '/admin/logs';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [invioInCorso, setInvioInCorso] = useState(false);
  const [errore, setErrore] = useState(null);

  async function gestisciSubmit(e) {
    e.preventDefault();
    setInvioInCorso(true);
    setErrore(null);
    try {
      await login(username, password);
      navigate(destinazione, { replace: true });
    } catch (err) {
      setErrore(err.message);
    } finally {
      setInvioInCorso(false);
    }
  }

  return (
    <div className="login">
      <form className="card login__form" onSubmit={gestisciSubmit}>
        <h1>Accesso amministratore</h1>
        <label>
          Username
          <input required value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </label>
        <label>
          Password
          <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {errore && <p className="login__errore">{errore}</p>}
        <button type="submit" className="btn btn--primary" disabled={invioInCorso}>
          {invioInCorso ? 'Accesso…' : 'Accedi'}
        </button>
        <Link to="/" className="btn login__torna-dashboard">
          Torna alla dashboard
        </Link>
      </form>
    </div>
  );
}


export default Login;