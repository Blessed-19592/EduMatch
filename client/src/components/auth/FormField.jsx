import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';

export default function FormField({ label, name, type = 'text', value, onChange, placeholder, autoComplete, required = true, maxLength, inputMode, hint, disabled }) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className="auth-field">
      <label htmlFor={name}>{label}</label>
      <div className={`auth-input-wrap ${isPassword ? 'has-toggle' : ''}`}>
        <input
          id={name} name={name} type={isPassword && visible ? 'text' : type}
          value={value} onChange={onChange} placeholder={placeholder}
          autoComplete={autoComplete} required={required} maxLength={maxLength}
          inputMode={inputMode} disabled={disabled}
        />
        {isPassword && <button type="button" className="password-toggle" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Hide password' : 'Show password'}><FontAwesomeIcon icon={visible ? faEyeSlash : faEye} /></button>}
      </div>
      {hint && <small className="field-hint">{hint}</small>}
    </div>
  );
}
