import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout';
import FormField from '../../components/auth/FormField';
import { AuthError, AuthSuccess, SubmitButton } from '../../components/auth/AuthFeedback';
import { useAuth } from '../../context/AuthContext';
import { getApiErrorMessage } from '../../api/api';

export default function LoginPage() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ registrationNumber: location.state?.registrationNumber || '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const success = location.state?.message;
  if (status === 'loading') return <div className="auth-loading">Loading EduMatch…</div>;
  

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const submit = async (event) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const user = await login({ registrationNumber: form.registrationNumber.trim(), password: form.password });
      navigate(user.role === 'admin' ? '/admin' : '/app', { replace: true });
    } catch (err) { setError(getApiErrorMessage(err, 'Invalid registration number or password.')); }
    finally { setLoading(false); }
  };

  return <AuthLayout eyebrow="WELCOME BACK" title="Sign in to EduMatch" subtitle="Continue building meaningful academic connections.">
    <form className="auth-form" onSubmit={submit}>
      <AuthSuccess>{success}</AuthSuccess><AuthError>{error}</AuthError>
      <FormField label="Registration number" name="registrationNumber" value={form.registrationNumber} onChange={update} placeholder="e.g. KU/XXXX/XX" autoComplete="username" maxLength={50} />
      <FormField label="Password" name="password" type="password" value={form.password} onChange={update} placeholder="Enter your password" autoComplete="current-password" />
      <div className="auth-inline-row"><span>Use your registered student account</span><Link to="/forgot-password">Forgot password?</Link></div>
      <SubmitButton loading={loading} loadingText="Signing in…">Sign in</SubmitButton>
    </form>
    <p className="auth-switch">New to EduMatch? <Link to="/register">Create an account</Link></p>
  </AuthLayout>;
}
