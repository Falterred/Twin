// ─────────────────────────────────────────────────────────────
// CalibrationModal — 3-question risk profile wizard
// ─────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { CALIBRATION_QUESTIONS, type RiskProfile } from '../engine/constants';

interface CalibrationModalProps {
  currentProfile: RiskProfile;
  onSave: (profile: RiskProfile) => void;
  onClose: () => void;
}

function tallyToProfile(score: number): RiskProfile {
  if (score <= -2) return 'conservative';
  if (score >= 2) return 'aggressive';
  return 'balanced';
}

const PROFILE_DESCRIPTIONS: Record<RiskProfile, string> = {
  conservative: 'Prioritizes safety buffers and avoids debt exposure.',
  balanced: 'Balances safety with opportunity cost optimization.',
  aggressive: 'Maximizes investment potential and accepts higher risk.',
};

const PROFILE_COLORS: Record<RiskProfile, string> = {
  conservative: 'from-emerald-500 to-teal-600',
  balanced: 'from-blue-500 to-indigo-600',
  aggressive: 'from-orange-500 to-red-500',
};

export function CalibrationModal({ currentProfile, onSave, onClose }: CalibrationModalProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([null, null, null]);

  const questions = CALIBRATION_QUESTIONS;
  const isOnResults = step === questions.length;
  const score = answers.reduce<number>((sum, a) => sum + (a ?? 0), 0);
  const resultProfile = tallyToProfile(score);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  function selectAnswer(optionPoints: number) {
    const next = [...answers];
    next[step] = optionPoints;
    setAnswers(next);
  }

  function goNext() {
    if (step < questions.length) setStep(step + 1);
  }

  function goBack() {
    if (step > 0) setStep(step - 1);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="calibration-title"
        className="glass-card w-full max-w-lg mx-4 p-0 overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 id="calibration-title" className="text-lg font-bold text-slate-900 dark:text-slate-50">
            Risk Profile Calibration
          </h2>
          <button
            id="calibration-close"
            onClick={onClose}
            aria-label="Close calibration modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200
              hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-2 px-6 pb-4">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i < step
                  ? 'bg-blue-500'
                  : i === step && !isOnResults
                    ? 'bg-blue-500/50'
                    : 'bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-6 pb-6 min-h-[260px] flex flex-col">
          {!isOnResults ? (
            <>
              {/* Question */}
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                Question {step + 1} of {questions.length}
              </p>
              <p className="text-base font-semibold text-slate-900 dark:text-slate-50 mb-5">
                {questions[step].prompt}
              </p>

              {/* Options */}
              <div className="flex flex-col gap-3 flex-1">
                {questions[step].options.map((opt, i) => {
                  const isSelected = answers[step] === opt.points;
                  return (
                    <button
                      key={i}
                      id={`calibration-q${step}-opt${i}`}
                      onClick={() => selectAnswer(opt.points)}
                      className={`text-left p-4 rounded-xl border text-sm font-medium
                        transition-all duration-200 cursor-pointer
                        ${isSelected
                          ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400 glow-border'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                    >
                      {opt.text}
                    </button>
                  );
                })}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-5">
                <button
                  onClick={goBack}
                  disabled={step === 0}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg
                    text-slate-500 dark:text-slate-400
                    hover:bg-slate-100 dark:hover:bg-slate-800
                    disabled:opacity-30 disabled:cursor-not-allowed
                    transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={goNext}
                  disabled={answers[step] === null}
                  className="flex items-center gap-1 px-4 py-2 text-sm font-semibold rounded-lg
                    bg-blue-600 text-white hover:bg-blue-700
                    disabled:opacity-40 disabled:cursor-not-allowed
                    transition-all cursor-pointer shadow-lg shadow-blue-500/20"
                >
                  {step === questions.length - 1 ? 'See Result' : 'Next'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            /* Results screen */
            <div className="flex flex-col items-center text-center flex-1 justify-center">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${PROFILE_COLORS[resultProfile]}
                flex items-center justify-center mb-4 shadow-lg`}>
                <Check className="w-8 h-8 text-white" />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Your profile</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-2 capitalize">
                {resultProfile}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-xs">
                {PROFILE_DESCRIPTIONS[resultProfile]}
              </p>

              <div className="flex gap-3">
                <button
                  id="calibration-retake"
                  onClick={() => { setStep(0); setAnswers([null, null, null]); }}
                  className="px-4 py-2 text-sm font-medium rounded-lg border
                    border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300
                    hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Retake
                </button>
                <button
                  id="calibration-save"
                  onClick={() => onSave(resultProfile)}
                  className="px-5 py-2 text-sm font-semibold rounded-lg
                    bg-blue-600 text-white hover:bg-blue-700
                    transition-all cursor-pointer shadow-lg shadow-blue-500/20"
                >
                  {resultProfile === currentProfile ? 'Keep Profile' : 'Apply & Recalculate'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
