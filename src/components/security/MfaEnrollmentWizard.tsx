import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Fingerprint,
  Smartphone,
  Check,
  Copy,
  Download,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  X,
  RefreshCw,
  Lock,
  Sparkles,
} from 'lucide-react';
import { mfaPasskeyClient, MfaSetupData } from '../../services/mfaPasskeyClient';
import { rbacService } from '../../services/rbacService';
import { SafeSvgRenderer } from '../common/SafeSvgRenderer';

interface MfaEnrollmentWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

type WizardStep = 'intro' | 'password_verify' | 'totp_setup' | 'recovery_codes' | 'passkey_reg' | 'finished';

export const MfaEnrollmentWizard: React.FC<MfaEnrollmentWizardProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('intro');
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // TOTP setup state
  const [mfaData, setMfaData] = useState<MfaSetupData | null>(null);
  const [totpInput, setTotpInput] = useState('');
  const [totpError, setTotpError] = useState<string | null>(null);
  const [totpVerified, setTotpVerified] = useState(false);
  const [hasCopiedCodes, setHasCopiedCodes] = useState(false);

  // Passkey setup state
  const [passkeyLabel, setPasskeyLabel] = useState('');
  const [passkeyRegistered, setPasskeyRegistered] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);
  const isWebAuthnSupported = mfaPasskeyClient.isWebAuthnSupported();

  useEffect(() => {
    if (isOpen) {
      setCurrentStep('intro');
      setPasswordInput('');
      setPasswordError(null);
      setMfaData(null);
      setTotpInput('');
      setTotpError(null);
      setTotpVerified(false);
      setPasskeyLabel('');
      setPasskeyRegistered(false);
      setPasskeyError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Step 1: Verify Master Password
  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setLoading(true);

    const res = await rbacService.verifySuperAdminCredentials(passwordInput);
    setLoading(false);

    if (res.success || res.mfaRequired) {
      // Password verified! Initialize MFA TOTP generation
      initializeTotpSetup();
    } else {
      setPasswordError(res.error || 'Invalid Super Admin password. Primary credential verification failed.');
    }
  };

  const initializeTotpSetup = async () => {
    setLoading(true);
    setTotpError(null);
    const result = await mfaPasskeyClient.setupMfaInit();
    setLoading(false);

    if (result.success && result.data) {
      setMfaData(result.data);
      setCurrentStep('totp_setup');
    } else {
      setTotpError(result.error || 'Failed to initialize MFA secrets.');
      setCurrentStep('totp_setup');
    }
  };

  // Step 2: Confirm TOTP code
  const handleConfirmTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpInput.trim() || totpInput.trim().length !== 6) {
      setTotpError('Enter the 6-digit verification code from your authenticator application.');
      return;
    }

    setLoading(true);
    setTotpError(null);
    const result = await mfaPasskeyClient.setupMfaConfirm(totpInput.trim());
    setLoading(false);

    if (result.success) {
      setTotpVerified(true);
      setCurrentStep('recovery_codes');
    } else {
      setTotpError(result.error || 'Invalid 6-digit code. Please verify device clock sync.');
    }
  };

  // Copy & Download recovery codes
  const handleCopyCodes = () => {
    if (!mfaData?.recoveryCodes) return;
    navigator.clipboard.writeText(mfaData.recoveryCodes.join('\n'));
    setHasCopiedCodes(true);
    setTimeout(() => setHasCopiedCodes(false), 3000);
  };

  const handleDownloadCodes = () => {
    if (!mfaData?.recoveryCodes) return;
    const content = `OCEANIQ MARITIME COMMAND — SUPER ADMIN RECOVERY CODES\nGenerated: ${new Date().toISOString()}\nPrimary Credential: Standard Master Password\n\nEMERGENCY ONE-TIME RECOVERY CODES:\n` +
      mfaData.recoveryCodes.map((c, i) => `${(i + 1).toString().padStart(2, '0')}. ${c}`).join('\n') +
      `\n\nStore these codes in an encrypted vault or offline physical safe.`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oceaniq-recovery-codes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Step 4: Register FIDO2 Passkey
  const handleRegisterPasskey = async () => {
    const label = passkeyLabel.trim() || 'Super Admin Security Key';
    setLoading(true);
    setPasskeyError(null);

    const result = await mfaPasskeyClient.registerPasskey(label);
    setLoading(false);

    if (result.success) {
      setPasskeyRegistered(true);
      setCurrentStep('finished');
    } else {
      setPasskeyError(result.error || 'WebAuthn passkey registration was not completed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        {/* Wizard Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  Super Admin MFA & Passkey Enrollment
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  DEFENSE-IN-DEPTH
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Guiding privilege escalation with multi-factor authentication & hardware security
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Tracker */}
        <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-800/60 flex items-center justify-between text-xs font-mono">
          <div className={`flex items-center gap-1.5 ${currentStep === 'intro' || currentStep === 'password_verify' ? 'text-cyan-400 font-bold' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">1</span>
            <span>Password Check</span>
          </div>
          <div className="w-6 h-px bg-slate-800" />
          <div className={`flex items-center gap-1.5 ${currentStep === 'totp_setup' ? 'text-cyan-400 font-bold' : totpVerified ? 'text-emerald-400' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">2</span>
            <span>TOTP Setup</span>
          </div>
          <div className="w-6 h-px bg-slate-800" />
          <div className={`flex items-center gap-1.5 ${currentStep === 'recovery_codes' ? 'text-cyan-400 font-bold' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">3</span>
            <span>Recovery</span>
          </div>
          <div className="w-6 h-px bg-slate-800" />
          <div className={`flex items-center gap-1.5 ${currentStep === 'passkey_reg' ? 'text-cyan-400 font-bold' : passkeyRegistered ? 'text-emerald-400' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">4</span>
            <span>Passkey</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* STEP: INTRO */}
          {currentStep === 'intro' && (
            <div className="space-y-4">
              <div className="p-4 bg-cyan-950/20 border border-cyan-800/30 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                  <KeyRound className="w-4 h-4" />
                  <span>Primary Credential Policy Notice</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Your primary Super Admin master password remains unchanged.
                  MFA (TOTP Authenticator) and FIDO2 Passkeys act as <strong className="text-white">additional, phishing-resistant security layers</strong>.
                </p>
                <div className="text-[11px] text-slate-400 border-t border-cyan-800/30 pt-2 flex items-center gap-2 font-mono">
                  <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Password + MFA/Passkey required for privileged admin sessions.</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                    <Smartphone className="w-4 h-4" />
                    <span>TOTP Authenticator App</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Compatible with Google Authenticator, Authy, 1Password, or Apple Keychain using RFC 6238 standard.
                  </p>
                </div>

                <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
                    <Fingerprint className="w-4 h-4" />
                    <span>FIDO2 / WebAuthn Passkey</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Cryptographic hardware protection via YubiKey, Windows Hello, macOS Touch ID, or iOS / Android passkeys.
                  </p>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep('password_verify')}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-950/50 cursor-pointer"
                >
                  <span>Begin Enrollment</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP: PASSWORD VERIFY */}
          {currentStep === 'password_verify' && (
            <form onSubmit={handleVerifyPassword} className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-white mb-1">Verify Super Admin Password</h4>
                <p className="text-xs text-slate-400">
                  Confirm your primary master password before generating security secrets.
                </p>
              </div>

              {passwordError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{passwordError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-300">SUPER ADMIN MASTER PASSWORD</label>
                <div className="relative">
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter Master Password..."
                    autoFocus
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl text-sm font-mono text-white placeholder-slate-600 outline-none transition-all"
                  />
                  <div className="absolute right-3 top-3 text-[11px] font-mono text-slate-500">
                    PBKDF2-SHA512
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 font-mono">
                  Primary credential verified via server-side PBKDF2 hash.
                </p>
              </div>

              <div className="pt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep('intro')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || !passwordInput}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-950/50 cursor-pointer"
                >
                  {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Verify & Proceed</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}

          {/* STEP: TOTP SETUP */}
          {currentStep === 'totp_setup' && (
            <form onSubmit={handleConfirmTotp} className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-white mb-1">Step 2: Configure Authenticator App (TOTP)</h4>
                <p className="text-xs text-slate-400">
                  Scan the QR code with your authenticator app, or enter the secret key manually.
                </p>
              </div>

              {totpError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{totpError}</span>
                </div>
              )}

              {mfaData && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-slate-950/60 border border-slate-800 p-4 rounded-xl">
                  {/* QR SVG */}
                  <div className="flex flex-col items-center justify-center p-3 bg-white rounded-lg shadow-inner overflow-hidden">
                    <SafeSvgRenderer
                      svgContent={mfaData.qrSvg}
                      className="w-40 h-40 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                      title="Authenticator QR Code"
                    />
                    <span className="text-[10px] text-slate-700 font-mono mt-1">Scan via Google Authenticator</span>
                  </div>

                  {/* Secret details */}
                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase">Manual Secret Key</span>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs font-mono bg-slate-900 border border-slate-700 text-amber-300 px-2 py-1 rounded select-all break-all">
                          {mfaData.secret}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(mfaData.secret);
                            setHasCopiedCodes(true);
                            setTimeout(() => setHasCopiedCodes(false), 2000);
                          }}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded cursor-pointer shrink-0"
                          title="Copy Secret"
                        >
                          {hasCopiedCodes ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 space-y-1">
                      <div><strong className="text-slate-300">Algorithm:</strong> SHA-1 (RFC 6238)</div>
                      <div><strong className="text-slate-300">Digits:</strong> 6 Digits</div>
                      <div><strong className="text-slate-300">Period:</strong> 30 Seconds</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Confirmation Code Input */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-mono text-slate-300">VERIFY 6-DIGIT CODE FROM APP</label>
                <input
                  type="text"
                  maxLength={6}
                  value={totpInput}
                  onChange={(e) => setTotpInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full text-center tracking-widest text-lg font-mono px-3 py-2 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl text-white outline-none"
                  autoFocus
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep('password_verify')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || totpInput.length !== 6}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-950/50 cursor-pointer"
                >
                  {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm TOTP</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}

          {/* STEP: RECOVERY CODES */}
          {currentStep === 'recovery_codes' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Authenticator App Enrolled!</h4>
                  <p className="text-xs text-slate-400">
                    Save these emergency one-time recovery codes in a secure location.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-amber-950/20 border border-amber-800/40 rounded-xl text-xs text-amber-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Important Recovery Policy</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Each recovery code can only be used once. If your phone is lost or replaced, these codes allow you to regain privileged administrative access without a backdoor.
                </p>
              </div>

              {mfaData?.recoveryCodes && (
                <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-xl">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs text-cyan-300">
                    {mfaData.recoveryCodes.map((c, i) => (
                      <div key={i} className="bg-slate-900 border border-slate-800 px-2 py-1.5 rounded text-center">
                        <span className="text-[10px] text-slate-500 mr-1">{i + 1}.</span>
                        {c}
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleCopyCodes}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      {hasCopiedCodes ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{hasCopiedCodes ? 'Copied to Clipboard' : 'Copy Codes'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadCodes}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download .txt</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep('totp_setup')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep('passkey_reg')}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-950/50 cursor-pointer"
                >
                  <span>Continue to Hardware Passkey</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP: PASSKEY REGISTRATION */}
          {currentStep === 'passkey_reg' && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-white mb-1">Step 4: Register FIDO2 Hardware Passkey</h4>
                <p className="text-xs text-slate-400">
                  Register a physical security key (YubiKey) or biometric platform authenticator (Touch ID, Windows Hello, Face ID).
                </p>
              </div>

              {passkeyError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{passkeyError}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-mono text-slate-300">DEVICE / PASSKEY IDENTIFIER</label>
                <input
                  type="text"
                  value={passkeyLabel}
                  onChange={(e) => setPasskeyLabel(e.target.value)}
                  placeholder="e.g. Primary YubiKey 5C NFC / MacBook TouchID"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl text-sm text-white placeholder-slate-600 outline-none font-sans"
                />
              </div>

              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2 text-xs text-slate-300">
                <div className="font-semibold text-white flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-cyan-400" />
                  <span>Standards-Compliant FIDO2 / WebAuthn</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  The private key never leaves your authenticator chip. Only public key metadata and short-lived cryptographic challenge proofs are stored.
                </p>
              </div>

              <div className="pt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep('finished')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Skip for Now
                </button>
                <button
                  type="button"
                  onClick={handleRegisterPasskey}
                  disabled={loading}
                  className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-lg shadow-cyan-950/50 cursor-pointer"
                >
                  {loading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <Fingerprint className="w-4 h-4" />
                  <span>Register Authenticator</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP: FINISHED */}
          {currentStep === 'finished' && (
            <div className="space-y-4 py-4 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 flex items-center justify-center">
                <ShieldCheck className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-base font-bold text-white">Privileged Defense-in-Depth Active</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
                  Your Super Admin root profile is now secured with a multi-factor authentication layer.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left max-w-md mx-auto pt-2">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Primary Credential</div>
                  <div className="text-xs font-bold text-white mt-0.5">Master Password (Active)</div>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <div className="text-[10px] font-mono text-slate-500 uppercase">Secondary Factor</div>
                  <div className="text-xs font-bold text-emerald-400 mt-0.5">
                    {passkeyRegistered ? 'TOTP + Passkey' : 'TOTP Authenticator'}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    onComplete?.();
                    onClose();
                  }}
                  className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-950/50 cursor-pointer"
                >
                  Return to Command Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
