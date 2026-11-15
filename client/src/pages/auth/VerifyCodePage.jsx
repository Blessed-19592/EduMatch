import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import api, { getApiErrorMessage } from '../../api/api';
import AuthLayout from '../../components/auth/AuthLayout';
import FormField from '../../components/auth/FormField';
import { AuthError, SubmitButton } from '../../components/auth/AuthFeedback';

export default function VerifyCodePage() {
  const location = useLocation(); const navigate = useNavigate();
  const registrationNumber = location.state?.registrationNumber;
  const [code, setCode] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  if (!registrationNumber) return <Navigate to="/register" replace />;
  const submit = async (event) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/register/verify-code', { registrationNumber, code });
      navigate('/register/complete', { state: { registrationNumber, registrationToken: data.registrationToken } });
    } catch (err) { setError(getApiErrorMessage(err, 'Invalid or expired verification code.')); }
    finally { setLoading(false); }
  };
  return <AuthLayout eyebrow="CREATE YOUR ACCOUNT · 2 OF 3" title="Verify your email" subtitle={`Enter the six-digit code sent to the registered email for ${registrationNumber}.`}>
    <form className="auth-form" onSubmit={submit}>
      <AuthError>{error}</AuthError>
      <FormField label="Six-digit verification code" name="code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" autoComplete="one-time-code" inputMode="numeric" maxLength={6} />
      <div className="auth-note">The code expires after 10 minutes. You have a limited number of verification attempts.</div>
      <SubmitButton loading={loading} loadingText="Verifying…">Verify code</SubmitButton>
    </form>
    <p className="auth-switch"><Link to="/register">Use a different registration number</Link></p>
  </AuthLayout>;
}
