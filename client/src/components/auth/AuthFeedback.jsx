export function AuthError({ children }) {
  return children ? <div className="auth-feedback auth-feedback-error" role="alert">{children}</div> : null;
}
export function AuthSuccess({ children }) {
  return children ? <div className="auth-feedback auth-feedback-success" role="status">{children}</div> : null;
}
export function SubmitButton({ children, loading, loadingText = 'Please wait…' }) {
  return <button className="auth-submit" type="submit" disabled={loading}>{loading ? <><span className="auth-spinner" />{loadingText}</> : children}</button>;
}
