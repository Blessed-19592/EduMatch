import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api, { getApiErrorMessage } from '../../api/api';
import AuthLayout from '../../components/auth/AuthLayout';
import FormField from '../../components/auth/FormField';
import { AuthError, SubmitButton } from '../../components/auth/AuthFeedback';

export default function ResetPasswordPage() {
  const [params] = useSearchParams(); const navigate = useNavigate();
  const token = useMemo(() => params.get('token') || '', [params]);
  const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setError('');
    if (!/^[a-f0-9]{64}$/.test(token)) return setError('This password reset link is invalid. Request a new one.');
    if (password.length < 10 || password.length > 72) return setError('Your password must contain between 10 and 72 characters.');
    if (password !== confirmPassword) return setError('The passwords do not match.');
    setLoading(true);
    try { const { data } = await api.post('/auth/reset-password', { token, newPassword: password }); navigate('/login', { replace: true, state: { message: data.message } }); }
    catch (err) { setError(getApiErrorMessage(err, 'Password reset failed. Your link may be invalid or expired.')); }
    finally { setLoading(false); }
  };
  return <AuthLayout eyebrow="ACCOUNT RECOVERY" title="Set a new password" subtitle="Choose a new password for your EduMatch account.">
    <form className="auth-form" onSubmit={submit}>
      <AuthError>{error}</AuthError>
      <FormField label="New password" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 10 characters" autoComplete="new-password" />
      <FormField label="Confirm new password" name="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Enter your password again" autoComplete="new-password" />
      <SubmitButton loading={loading} loadingText="Updating password…">Reset password</SubmitButton>
    </form>
    <p className="auth-switch"><Link to="/login">Return to sign in</Link></p>
  </AuthLayout>;
}
