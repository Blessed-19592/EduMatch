import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import api, { getApiErrorMessage } from '../../api/api';
import AuthLayout from '../../components/auth/AuthLayout';
import FormField from '../../components/auth/FormField';
import { AuthError, SubmitButton } from '../../components/auth/AuthFeedback';

export default function CompleteRegistrationPage() {
  const location = useLocation(); const navigate = useNavigate();
  const { registrationNumber, registrationToken } = location.state || {};
  const [password, setPassword] = useState(''); const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  if (!registrationNumber || !registrationToken) return <Navigate to="/register" replace />;
  const submit = async (event) => {
    event.preventDefault(); setError('');
    if (password.length < 10) return setError('Your password must contain at least 10 characters.');
    if (password !== confirmPassword) return setError('The passwords do not match.');
    if (password.length > 72) return setError('Your password must not exceed 72 characters.');
    setLoading(true);
    try {
      await api.post('/auth/register/complete', { registrationNumber, registrationToken, password });
      navigate('/login', { replace: true, state: { registrationNumber, message: 'Your account has been created. You can now sign in.' } });
    } catch (err) { setError(getApiErrorMessage(err, 'Registration could not be completed. Request a new verification code and try again.')); }
    finally { setLoading(false); }
  };
  return <AuthLayout eyebrow="CREATE YOUR ACCOUNT · 3 OF 3" title="Create your password" subtitle="Your student details have been verified. Set a password to finish creating your account.">
    <form className="auth-form" onSubmit={submit}>
      <AuthError>{error}</AuthError>
      <FormField label="New password" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 10 characters" autoComplete="new-password" hint="Use at least 10 characters. Maximum 72 characters." />
      <FormField label="Confirm password" name="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Enter your password again" autoComplete="new-password" />
      <SubmitButton loading={loading} loadingText="Creating account…">Create account</SubmitButton>
    </form>
    <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
  </AuthLayout>;
}
