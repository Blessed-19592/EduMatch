import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getApiErrorMessage } from '../../api/api';
import AuthLayout from '../../components/auth/AuthLayout';
import FormField from '../../components/auth/FormField';
import { AuthError, AuthSuccess, SubmitButton } from '../../components/auth/AuthFeedback';

export default function RequestCodePage() {
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const submit = async (event) => {
    event.preventDefault(); setError(''); setSuccess(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/register/request-code', { registrationNumber: registrationNumber.trim() });
      setSuccess(data.message);
      navigate('/register/verify', { state: { registrationNumber: registrationNumber.trim() }, replace: false });
    } catch (err) { setError(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  };
  return <AuthLayout eyebrow="CREATE YOUR ACCOUNT · 1 OF 3" title="Get started with EduMatch" subtitle="Enter your university registration number to begin student verification.">
    <form className="auth-form" onSubmit={submit}>
      <AuthError>{error}</AuthError><AuthSuccess>{success}</AuthSuccess>
      <FormField label="Registration number" name="registrationNumber" value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} placeholder="Enter your registration number" autoComplete="off" maxLength={50} />
      <div className="auth-note">We'll send a six-digit verification code to the email address recorded in the student registry.</div>
      <SubmitButton loading={loading} loadingText="Requesting code…">Send verification code</SubmitButton>
    </form>
    <p className="auth-switch">
  Already have an account? <Link to="/login" replace>Sign in</Link>
</p>
  </AuthLayout>;
}
