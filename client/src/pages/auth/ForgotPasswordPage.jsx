import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getApiErrorMessage } from '../../api/api';
import AuthLayout from '../../components/auth/AuthLayout';
import FormField from '../../components/auth/FormField';
import { AuthError, AuthSuccess, SubmitButton } from '../../components/auth/AuthFeedback';

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState(''); const [error, setError] = useState(''); const [success, setSuccess] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setError(''); setSuccess(''); setLoading(true);
    try { const { data } = await api.post('/auth/forgot-password', { identifier: identifier.trim() }); setSuccess(data.message); }
    catch (err) { setError(getApiErrorMessage(err)); }
    finally { setLoading(false); }
  };
  return <AuthLayout eyebrow="ACCOUNT RECOVERY" title="Forgot your password?" subtitle="Students enter their registration number; administrators enter their staff email. If an eligible account exists, reset instructions will be sent to its registered email.">
    <form className="auth-form" onSubmit={submit}>
      <AuthError>{error}</AuthError><AuthSuccess>{success}</AuthSuccess>
      <FormField label="Registration number or staff email" name="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Enter your registration number or staff email" autoComplete="username" maxLength={255} />
      <SubmitButton loading={loading} loadingText="Submitting…">Request reset instructions</SubmitButton>
    </form>
    <p className="auth-switch"><Link to="/login">Return to sign in</Link></p>
  </AuthLayout>;
}
