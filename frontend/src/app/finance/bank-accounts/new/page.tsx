'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { arApi } from '@/lib/ar-api';
import { useAuth } from '@/contexts/AuthContext';
import { FinanceRole } from '@/types/user.types';
import { 
  ArrowLeft, Building2, Sparkles, Save, AlertCircle, 
  CheckCircle2, Mail, CreditCard, Hash, User, Loader2,
  Info, FileText, Upload, X, ArrowRight, Shield, Landmark,
  Globe, BadgeCheck, ChevronRight, Wallet
} from 'lucide-react';

/*
  KARDEX OFFICIAL COLOR PALETTE (18 Colors Only)
  
  Blues:   #96AEC2 (Blue 1), #6F8A9D (Blue 2), #546A7A (Blue 3)
  Greens:  #A2B9AF (Green 1), #82A094 (Green 2), #4F6A64 (Green 3)
  Greys:   #AEBFC3 (Grey 1), #92A2A5 (Grey 2), #5D6E73 (Grey 3)
  Silvers: #ABACA9 (Silver 1), #979796 (Silver 2), #757777 (Silver 3)
  Reds:    #E17F70 (Red 1), #9E3B47 (Red 2), #75242D (Red 3)
  Sands:   #EEC1BF (Sand 1), #CE9F6B (Sand 2), #976E44 (Sand 3)
*/

interface FormData {
  vendorName: string;
  beneficiaryBankName: string;
  accountNumber: string;
  ifscCode: string;
  emailId: string;
  beneficiaryName: string;
  confirmAccountNumber: string;
  nickName: string;
  isMSME: boolean;
  udyamRegNum: string;
  gstNumber: string;
  panNumber: string;
  currency: string;
  otherCurrency?: string;
}

export default function NewBankAccountPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [activeStep, setActiveStep] = useState(1);
  const [isMounted, setIsMounted] = useState(false);
  
  const isAdmin = user?.financeRole === FinanceRole.FINANCE_ADMIN;

  const [formData, setFormData] = useState<FormData>({
    vendorName: '',
    beneficiaryBankName: '',
    accountNumber: '',
    ifscCode: '',
    emailId: '',
    beneficiaryName: '',
    confirmAccountNumber: '',
    nickName: '',
    isMSME: false,
    udyamRegNum: '',
    gstNumber: '',
    panNumber: '',
    currency: 'INR',
    otherCurrency: ''
  });

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Track active step based on filled fields
  useEffect(() => {
    if (formData.vendorName && formData.beneficiaryBankName && formData.accountNumber && formData.ifscCode) {
      setActiveStep(3);
    } else if (formData.vendorName) {
      setActiveStep(2);
    } else {
      setActiveStep(1);
    }
  }, [formData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => {
      const val = type === 'checkbox' ? checked : value;
      const newData = { ...prev, [name]: val };
      
      if (name === 'vendorName' && (prev.beneficiaryName === prev.vendorName || prev.beneficiaryName === '')) {
        newData.beneficiaryName = value;
      }
      
      return newData;
    });
    setError('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate all steps before submission
      const step1Validation = validateStep(1);
      if (!step1Validation.valid) {
        setError(step1Validation.message || 'Step 1: Please complete vendor information');
        setCurrentStep(1);
        setLoading(false);
        return;
      }

      const step2Validation = validateStep(2);
      if (!step2Validation.valid) {
        setError(step2Validation.message || 'Step 2: Please complete bank details');
        setCurrentStep(2);
        setLoading(false);
        return;
      }

      const step3Validation = validateStep(3);
      if (!step3Validation.valid) {
        setError(step3Validation.message || 'Step 3: Please upload required documents');
        setCurrentStep(3);
        setLoading(false);
        return;
      }

      if (isAdmin) {
        const { confirmAccountNumber, otherCurrency, ...apiData } = formData;
        if (formData.currency === 'Other') {
            apiData.currency = formData.otherCurrency || 'Other';
        }
        const account = await arApi.createBankAccount(apiData);
        
        if (selectedFiles.length > 0) {
          for (const file of selectedFiles) {
            await arApi.uploadBankAccountAttachment(account.id, file);
          }
        }
        
        setSuccess('Vendor account created successfully!');
        setTimeout(() => router.push(`/finance/bank-accounts/${account.id}`), 1500);
      } else {
        const { confirmAccountNumber, otherCurrency, ...apiData } = formData;
        if (formData.currency === 'Other') {
            apiData.currency = formData.otherCurrency || 'Other';
        }
        const request = await arApi.createBankAccountRequest({
          requestType: 'CREATE',
          requestedData: apiData
        });
        
        if (selectedFiles.length > 0) {
          for (const file of selectedFiles) {
            await arApi.uploadBankAccountAttachment(request.id, file);
          }
        }
        
        setSuccess('Request submitted! Waiting for admin approval.');
        setTimeout(() => router.push('/finance/bank-accounts/requests'), 1500);
      }
    } catch (err: any) {
      console.error('Form submission error:', err);
      
      // Extract error message from various possible formats
      let errorMessage = 'Failed to submit';
      
      if (err.response?.data?.error) {
        // API returned { error: "message" }
        errorMessage = err.response.data.error;
      } else if (err.response?.data?.message) {
        // API returned { message: "message" }
        errorMessage = err.response.data.message;
      } else if (err.message) {
        // Standard error message
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      
      // Scroll to top to show error message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { id: 1, title: 'Vendor Details', icon: User, description: 'Basic information' },
    { id: 2, title: 'Bank Account', icon: Landmark, description: 'Banking details' },
    { id: 3, title: 'Documents', icon: FileText, description: 'Verification' },
  ];

  const getCompletionPercentage = () => {
    let filled = 0;
    const required = ['vendorName', 'beneficiaryBankName', 'accountNumber', 'ifscCode', 'confirmAccountNumber'];
    required.forEach(field => {
      if (formData[field as keyof FormData]) filled++;
    });
    return Math.round((filled / required.length) * 100);
  };

  const validateStep = (step: number): { valid: boolean; message?: string } => {
    if (step === 1) {
      if (!formData.vendorName) {
        return { valid: false, message: 'Vendor name is required' };
      }
      if (formData.isMSME && !formData.udyamRegNum) {
        return { valid: false, message: 'Udyam Registration Number is required for MSME vendors' };
      }
      return { valid: true };
    }
    if (step === 2) {
      if (!formData.beneficiaryBankName) {
        return { valid: false, message: 'Beneficiary Bank Name is required' };
      }
      if (!formData.accountNumber) {
        return { valid: false, message: 'Account Number is required' };
      }
      if (!formData.ifscCode) {
        return { valid: false, message: 'IFSC/SWIFT Code is required' };
      }
      if (!formData.confirmAccountNumber) {
        return { valid: false, message: 'Please confirm the account number' };
      }
      if (formData.accountNumber !== formData.confirmAccountNumber) {
        return { valid: false, message: 'Account numbers do not match' };
      }
      if (formData.currency === 'INR') {
        if (!formData.gstNumber) {
          return { valid: false, message: 'GST Number is required for INR transactions' };
        }
        if (!formData.panNumber) {
          return { valid: false, message: 'PAN Number is required for INR transactions' };
        }
      }
      if (formData.currency === 'Other' && !formData.otherCurrency) {
        return { valid: false, message: 'Please specify the currency code' };
      }
      return { valid: true };
    }
    if (step === 3) {
      if (selectedFiles.length === 0) {
        return { valid: false, message: 'Please upload at least one document for verification' };
      }
      return { valid: true };
    }
    return { valid: true };
  };

  const handleNext = () => {
    const validation = validateStep(currentStep);
    if (validation.valid) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
      setError('');
    } else {
      setError(validation.message || 'Please complete all required fields in this step');
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
    setError('');
  };

  return (
    <div className="w-full min-h-screen" style={{ background: 'linear-gradient(to bottom, #f8fafb 0%, #ffffff 100%)' }}>
      {/* Premium Header - Enhanced Glassmorphism */}
      <div 
        className={`relative overflow-hidden rounded-[2rem] mb-10 transition-all duration-700 ${isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
        style={{ 
          background: 'linear-gradient(135deg, #546A7A 0%, #6F8A9D 40%, #96AEC2 70%, #6F8A9D 100%)',
          boxShadow: '0 20px 60px rgba(84,106,122,0.3), 0 0 0 1px rgba(255,255,255,0.1) inset'
        }}
      >
        {/* Animated Background Meshes */}
        <div className="absolute inset-0 overflow-hidden opacity-30">
          <div 
            className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl animate-pulse"
            style={{ background: 'radial-gradient(circle, rgba(206,159,107,0.4) 0%, transparent 70%)', animationDuration: '3s' }}
          />
          <div 
            className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl animate-pulse"
            style={{ background: 'radial-gradient(circle, rgba(130,160,148,0.3) 0%, transparent 70%)', animationDelay: '1.5s', animationDuration: '4s' }}
          />
          <div 
            className="absolute top-20 right-20 w-64 h-64 rounded-full blur-2xl animate-pulse"
            style={{ background: 'radial-gradient(circle, rgba(238,193,191,0.2) 0%, transparent 70%)', animationDelay: '0.5s', animationDuration: '3.5s' }}
          />
        </div>
        
        <div className="relative p-10 md:p-12">
          {/* Top Bar */}
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8 mb-10">
            <div className="flex items-start gap-6">
              <Link
                href="/finance/bank-accounts"
                className="group p-4 rounded-2xl border-2 transition-all duration-300 hover:scale-105"
                style={{ 
                  background: 'rgba(255,255,255,0.08)', 
                  borderColor: 'rgba(255,255,255,0.15)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" style={{ color: 'white' }} />
              </Link>
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div 
                    className="p-3 rounded-2xl shadow-2xl animate-pulse"
                    style={{ 
                      background: 'linear-gradient(135deg, #CE9F6B 0%, #976E44 100%)', 
                      boxShadow: '0 10px 30px rgba(206,159,107,0.4), 0 0 0 4px rgba(206,159,107,0.2)',
                      animationDuration: '2s'
                    }}
                  >
                    <Wallet className="w-6 h-6 text-white" />
                  </div>
                  <span 
                    className="px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest border-2"
                    style={{ 
                      background: 'linear-gradient(135deg, rgba(238,193,191,0.3) 0%, rgba(206,159,107,0.2) 100%)', 
                      color: '#EEC1BF', 
                      borderColor: 'rgba(238,193,191,0.4)',
                      boxShadow: '0 4px 12px rgba(206,159,107,0.2)'
                    }}
                  >
                    {isAdmin ? '✦ Create Account' : '↗ Request Account'}
                  </span>
                </div>
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-white tracking-tight mb-3 drop-shadow-lg">
                  {isAdmin ? 'Add Bank Account' : 'Request Bank Account'}
                </h1>
                <p className="text-base md:text-lg flex items-center gap-2.5 font-medium" style={{ color: '#E8F0F2', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  <Shield className="w-5 h-5" style={{ color: '#CE9F6B' }} />
                  {isAdmin ? 'Create a verified vendor bank account' : 'Submit for admin verification'}
                </p>
              </div>
            </div>
            
            {/* Enhanced Progress Ring */}
            <div className="lg:text-right">
              <div 
                className="inline-flex items-center gap-5 px-7 py-5 rounded-3xl border-2 backdrop-blur-xl"
                style={{ 
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)', 
                  borderColor: 'rgba(255,255,255,0.2)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.15), 0 0 0 1px rgba(255,255,255,0.1) inset'
                }}
              >
                <div className="relative">
                  <svg className="w-20 h-20 -rotate-90">
                    <circle cx="40" cy="40" r="34" stroke="rgba(255,255,255,0.15)" strokeWidth="6" fill="none" />
                    <circle 
                      cx="40" cy="40" r="34" 
                      stroke="url(#kardexGradientEnhanced)" 
                      strokeWidth="6" 
                      fill="none" 
                      strokeLinecap="round"
                      strokeDasharray={`${(getCompletionPercentage() / 100) * 213.6} 213.6`}
                      className="transition-all duration-1000 ease-out"
                      style={{ filter: 'drop-shadow(0 0 8px rgba(206,159,107,0.6))' }}
                    />
                    <defs>
                      <linearGradient id="kardexGradientEnhanced" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#EEC1BF" />
                        <stop offset="50%" stopColor="#CE9F6B" />
                        <stop offset="100%" stopColor="#976E44" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-black text-white" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                      {getCompletionPercentage()}%
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest mb-1.5 font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>Completion</p>
                  <p className="text-white font-black text-xl" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>Step {currentStep} of 3</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Interactive Step Bubbles */}
          <div className="grid grid-cols-3 gap-5">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              const isPending = currentStep < step.id;
              
              return (
                <div 
                  key={step.id}
                  className={`relative p-5 rounded-2xl transition-all duration-500 ${
                    validateStep(step.id - 1).valid && step.id <= currentStep + 1 ? 'cursor-pointer hover:scale-105' : ''
                  }`}
                  onClick={() => {
                    if (validateStep(step.id - 1).valid && step.id <= currentStep + 1) {
                      setCurrentStep(step.id);
                      setError('');
                    }
                  }}
                  style={{ 
                    background: isCurrent 
                      ? 'linear-gradient(135deg, rgba(206,159,107,0.35) 0%, rgba(151,110,68,0.25) 100%)' 
                      : isCompleted
                        ? 'linear-gradient(135deg, rgba(130,160,148,0.2) 0%, rgba(79,106,100,0.15) 100%)'
                        : 'rgba(255,255,255,0.08)',
                    border: `2px solid ${
                      isCurrent ? 'rgba(206,159,107,0.5)' : 
                      isCompleted ? 'rgba(130,160,148,0.4)' : 
                      'rgba(255,255,255,0.15)'
                    }`,
                    boxShadow: isCurrent 
                      ? '0 8px 24px rgba(206,159,107,0.3), 0 0 0 1px rgba(206,159,107,0.2) inset' 
                      : isCompleted
                        ? '0 4px 16px rgba(130,160,148,0.2)'
                        : 'none',
                    backdropFilter: 'blur(12px)'
                  }}
                >
                  {isCompleted && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, #82A094 0%, #4F6A64 100%)', boxShadow: '0 4px 12px rgba(130,160,148,0.4)' }}
                    >
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="flex items-center gap-4">
                    <div 
                      className="p-3 rounded-xl transition-all duration-500"
                      style={{ 
                        background: isCurrent 
                          ? 'linear-gradient(135deg, #CE9F6B 0%, #976E44 100%)' 
                          : isCompleted
                            ? 'linear-gradient(135deg, #82A094 0%, #4F6A64 100%)'
                            : 'rgba(255,255,255,0.1)',
                        boxShadow: isCurrent || isCompleted ? '0 6px 20px rgba(0,0,0,0.2)' : 'none'
                      }}
                    >
                      <Icon className="w-6 h-6" style={{ 
                        color: isCurrent || isCompleted ? 'white' : 'rgba(255,255,255,0.4)' 
                      }} />
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-base mb-0.5" style={{ 
                        color: isCurrent ? 'white' : isCompleted ? '#E8F0F2' : 'rgba(255,255,255,0.4)',
                        textShadow: isCurrent ? '0 2px 4px rgba(0,0,0,0.2)' : 'none'
                      }}>
                        {step.title}
                      </p>
                      <p className="text-xs font-medium" style={{ 
                        color: isCurrent ? '#EEC1BF' : isCompleted ? 'rgba(130,160,148,0.8)' : 'rgba(255,255,255,0.3)' 
                      }}>
                        {isCompleted ? '✓ Completed' : isCurrent ? '→ ' + step.description : step.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Info banner for non-admin */}
      {!isAdmin && (
        <div 
          className={`flex items-start gap-4 p-6 rounded-2xl border mb-8 transition-all duration-500 delay-100 ${isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          style={{ background: 'linear-gradient(135deg, rgba(150,174,194,0.1) 0%, rgba(111,138,157,0.05) 100%)', borderColor: 'rgba(150,174,194,0.3)' }}
        >
          <div className="p-3 rounded-xl border" style={{ background: 'rgba(150,174,194,0.1)', borderColor: 'rgba(150,174,194,0.2)' }}>
            <Info className="w-6 h-6" style={{ color: '#6F8A9D' }} />
          </div>
          <div>
            <p className="font-bold text-lg mb-1" style={{ color: '#546A7A' }}>Administrative Review Required</p>
            <p style={{ color: '#5D6E73' }}>
              Your submission will undergo a verification process by the Finance Administration team. 
              Please ensure all bank details and attachments are accurate to facilitate swift approval.
            </p>
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className={`transition-all duration-500 delay-200 ${isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {/* Error/Success Messages */}
        {error && (
          <div 
            className="flex items-start gap-4 p-6 rounded-[2rem] border-2 mb-8 animate-in fade-in slide-in-from-top-4 duration-300"
            style={{ 
              background: 'linear-gradient(135deg, rgba(225,127,112,0.15) 0%, rgba(158,59,71,0.08) 100%)', 
              borderColor: 'rgba(225,127,112,0.4)',
              boxShadow: '0 8px 24px rgba(225,127,112,0.2)'
            }}
          >
            <div className="p-3 rounded-2xl" style={{ background: 'linear-gradient(135deg, #E17F70 0%, #9E3B47 100%)', boxShadow: '0 4px 12px rgba(225,127,112,0.3)' }}>
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-black text-lg mb-1" style={{ color: '#9E3B47' }}>Error</p>
              <p className="font-medium text-base" style={{ color: '#75242D' }}>{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError('')}
              className="p-2 rounded-xl hover:bg-white/50 transition-colors"
              style={{ color: '#E17F70' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {success && (
          <div 
            className="flex items-start gap-4 p-6 rounded-[2rem] border-2 mb-8 animate-in fade-in slide-in-from-top-4 duration-300"
            style={{ 
              background: 'linear-gradient(135deg, rgba(130,160,148,0.15) 0%, rgba(79,106,100,0.08) 100%)', 
              borderColor: 'rgba(130,160,148,0.4)',
              boxShadow: '0 8px 24px rgba(130,160,148,0.2)'
            }}
          >
            <div className="p-3 rounded-2xl animate-pulse" style={{ background: 'linear-gradient(135deg, #82A094 0%, #4F6A64 100%)', boxShadow: '0 4px 12px rgba(130,160,148,0.3)', animationDuration: '2s' }}>
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-black text-lg mb-1" style={{ color: '#4F6A64' }}>Success!</p>
              <p className="font-medium text-base" style={{ color: '#4F6A64' }}>{success}</p>
            </div>
          </div>
        )}

        {/* Step 1: Vendor Information */}
        {currentStep === 1 && (
        <div className="bg-white rounded-[2rem] border-2 overflow-hidden mb-8 animate-in fade-in slide-in-from-right-4 duration-500" 
          style={{ 
            borderColor: 'rgba(206,159,107,0.2)', 
            boxShadow: '0 16px 48px rgba(84,106,122,0.12), 0 0 0 1px rgba(206,159,107,0.05) inset'
          }}>
          <div
            className="p-6 border-b-2 flex items-center justify-between"
            style={{ 
              background: 'linear-gradient(135deg, rgba(206,159,107,0.08) 0%, rgba(238,193,191,0.05) 50%, white 100%)', 
              borderColor: 'rgba(206,159,107,0.15)' 
            }}
          >
            <div className="flex items-center gap-4">
              <div 
                className="p-3.5 rounded-2xl shadow-xl"
                style={{ 
                  background: 'linear-gradient(135deg, #CE9F6B 0%, #976E44 100%)', 
                  boxShadow: '0 8px 24px rgba(206,159,107,0.3), 0 0 0 3px rgba(206,159,107,0.1)' 
                }}
              >
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-black" style={{ color: '#546A7A' }}>Vendor Information</h2>
                <p className="text-sm font-medium" style={{ color: '#92A2A5' }}>Enter basic vendor details</p>
              </div>
            </div>
            <span 
              className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border-2"
              style={{ 
                background: 'linear-gradient(135deg, rgba(206,159,107,0.1) 0%, transparent 100%)', 
                color: '#CE9F6B', 
                borderColor: 'rgba(206,159,107,0.2)' 
              }}
            >
              Step 01
            </span>
          </div>

          <div className="p-8 md:p-10">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* Vendor Name */}
              <div className="md:col-span-2 xl:col-span-1 space-y-2.5">
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: '#5D6E73' }}>
                  <User className="w-3.5 h-3.5" style={{ color: '#B18E63' }} />
                  Vendor Name <span style={{ color: '#E17F70' }}>*</span>
                </label>
                <input
                  type="text"
                  name="vendorName"
                  value={formData.vendorName}
                  onChange={handleChange}
                  placeholder="Enter vendor/company name"
                  className="w-full px-4 py-3 rounded-xl text-sm font-medium transition-all focus:outline-none"
                  style={{ 
                    background: '#F8FAFB', 
                    border: '2px solid #AEBFC3', 
                    color: '#546A7A'
                  }}
                  required
                />
              </div>

              <div className="space-y-2.5">
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: '#5D6E73' }}>
                  <Hash className="w-3.5 h-3.5" style={{ color: '#B18E63' }} />
                  Nick Name
                </label>
                <input
                  type="text"
                  name="nickName"
                  value={formData.nickName}
                  onChange={handleChange}
                  placeholder="Short reference name"
                  className="w-full px-4 py-3 rounded-xl text-sm font-medium transition-all focus:outline-none"
                  style={{ 
                    background: '#F8FAFB', 
                    border: '2px solid #AEBFC3', 
                    color: '#546A7A'
                  }}
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: '#5D6E73' }}>
                  <Mail className="w-4 h-4" style={{ color: '#CE9F6B' }} />
                  Email ID
                </label>
                <input
                  type="email"
                  name="emailId"
                  value={formData.emailId}
                  onChange={handleChange}
                  placeholder="vendor@company.com"
                  className="w-full px-5 py-4 rounded-2xl font-medium transition-all focus:outline-none"
                  style={{ background: '#F8FAFB', border: '2px solid #AEBFC3', color: '#546A7A' }}
                />
              </div>


            </div>

            {/* MSME Toggle */}
            <div 
              className="mt-8 p-6 rounded-3xl border"
              style={{ background: 'linear-gradient(135deg, #F8FAFB 0%, rgba(174,191,195,0.1) 100%)', borderColor: 'rgba(174,191,195,0.3)' }}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div 
                    className="p-4 rounded-2xl transition-all duration-500"
                    style={{ 
                      background: formData.isMSME 
                        ? 'linear-gradient(135deg, #CE9F6B 0%, #976E44 100%)' 
                        : '#AEBFC3',
                      boxShadow: formData.isMSME ? '0 10px 30px rgba(206,159,107,0.3)' : 'none',
                      transform: formData.isMSME ? 'scale(1.05)' : 'scale(1)'
                    }}
                  >
                    <Sparkles className={`w-6 h-6 ${formData.isMSME ? 'animate-pulse' : ''}`} style={{ color: formData.isMSME ? 'white' : '#5D6E73' }} />
                  </div>
                  <div>
                    <p className="font-bold text-lg" style={{ color: '#546A7A' }}>MSME Registered Vendor?</p>
                    <p className="text-sm" style={{ color: '#92A2A5' }}>Enable for Micro, Small, or Medium Enterprises</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    name="isMSME"
                    checked={formData.isMSME}
                    onChange={handleChange}
                    className="sr-only peer" 
                  />
                  <div 
                    className="w-16 h-8 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-7 after:transition-all"
                    style={{ 
                      background: formData.isMSME 
                        ? 'linear-gradient(90deg, #CE9F6B 0%, #976E44 100%)' 
                        : '#AEBFC3'
                    }}
                  />
                </label>
              </div>

              {formData.isMSME && (
                <div className="mt-6 space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
                  <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: '#5D6E73' }}>
                    <CreditCard className="w-4 h-4" style={{ color: '#CE9F6B' }} />
                    Udyam Registration Number <span style={{ color: '#E17F70' }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="udyamRegNum"
                    value={formData.udyamRegNum}
                    onChange={handleChange}
                    placeholder="UDYAM-XX-00-0000000"
                    className="w-full px-5 py-4 rounded-2xl font-mono font-bold text-lg tracking-widest transition-all focus:outline-none"
                    style={{ background: 'white', border: '2px solid #CE9F6B', color: '#546A7A' }}
                    required={formData.isMSME}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Step 2: Bank & Currency Details */}
        {currentStep === 2 && (
        <div className="bg-white rounded-[2rem] border-2 overflow-hidden mb-8 animate-in fade-in slide-in-from-right-4 duration-500" 
          style={{ 
            borderColor: 'rgba(111,138,157,0.2)', 
            boxShadow: '0 16px 48px rgba(84,106,122,0.12), 0 0 0 1px rgba(111,138,157,0.05) inset'
          }}>
          <div
            className="p-6 border-b-2 flex items-center justify-between"
            style={{ 
              background: 'linear-gradient(135deg, rgba(111,138,157,0.08) 0%, rgba(150,174,194,0.05) 50%, white 100%)', 
              borderColor: 'rgba(111,138,157,0.15)' 
            }}
          >
            <div className="flex items-center gap-4">
              <div 
                className="p-3.5 rounded-2xl shadow-xl"
                style={{ 
                  background: 'linear-gradient(135deg, #6F8A9D 0%, #546A7A 100%)', 
                  boxShadow: '0 8px 24px rgba(111,138,157,0.3), 0 0 0 3px rgba(111,138,157,0.1)' 
                }}
              >
                <Landmark className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-black" style={{ color: '#546A7A' }}>Bank Details</h2>
                <p className="text-sm font-medium" style={{ color: '#92A2A5' }}>Account and routing information</p>
              </div>
            </div>
            <span 
              className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border-2"
              style={{ 
                background: 'linear-gradient(135deg, rgba(111,138,157,0.1) 0%, transparent 100%)', 
                color: '#6F8A9D', 
                borderColor: 'rgba(111,138,157,0.2)' 
              }}
            >
              Step 02
            </span>
          </div>

          <div className="p-8 md:p-10 space-y-8">
            {/* Currency Selection */}
            <div 
              className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 rounded-3xl border"
              style={{ background: 'linear-gradient(135deg, rgba(150,174,194,0.1) 0%, rgba(111,138,157,0.05) 100%)', borderColor: 'rgba(150,174,194,0.2)' }}
            >
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: '#5D6E73' }}>
                  <Globe className="w-4 h-4" style={{ color: '#6F8A9D' }} />
                  Settlement Currency <span style={{ color: '#E17F70' }}>*</span>
                </label>
                <div className="relative">
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    className="w-full px-5 py-4 rounded-2xl font-bold appearance-none cursor-pointer transition-all focus:outline-none"
                    style={{ background: 'white', border: '2px solid #96AEC2', color: '#546A7A' }}
                    required
                  >
                    <option value="INR">🇮🇳 INR — Indian Rupee</option>
                    <option value="EUR">🇪🇺 EUR — Euro</option>
                    <option value="USD">🇺🇸 USD — US Dollar</option>
                    <option value="Other">🌐 OTHER — Specify Code</option>
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#96AEC2' }}>
                    <ChevronRight className="w-5 h-5 rotate-90" />
                  </div>
                </div>
              </div>

              {formData.currency === 'Other' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-500">
                  <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: '#5D6E73' }}>
                    Specify ISO Code <span style={{ color: '#E17F70' }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="otherCurrency"
                    value={formData.otherCurrency}
                    onChange={handleChange}
                    placeholder="e.g., GBP, JPY"
                    className="w-full px-5 py-4 rounded-2xl uppercase tracking-widest font-bold text-lg transition-all focus:outline-none"
                    style={{ background: 'white', border: '2px solid #96AEC2', color: '#546A7A' }}
                    required={formData.currency === 'Other'}
                  />
                </div>
              )}
            </div>

            {/* Tax Details - Conditional UI for INR */}
            <div 
              className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 rounded-3xl border"
              style={{ background: 'linear-gradient(135deg, rgba(206,159,107,0.08) 0%, rgba(151,110,68,0.04) 100%)', borderColor: 'rgba(206,159,107,0.2)' }}
            >
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: '#5D6E73' }}>
                  <Shield className="w-4 h-4" style={{ color: '#CE9F6B' }} />
                  GST Number {formData.currency === 'INR' && <span className="text-[#E17F70]">*</span>}
                </label>
                <input
                  type="text"
                  name="gstNumber"
                  value={formData.gstNumber}
                  onChange={handleChange}
                  placeholder="22AAAAA0000A1Z5"
                  className="w-full px-5 py-4 rounded-2xl font-mono font-bold uppercase transition-all focus:outline-none"
                  style={{ background: 'white', border: '2px solid #AEBFC3', color: '#546A7A' }}
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: '#5D6E73' }}>
                  <BadgeCheck className="w-4 h-4" style={{ color: '#CE9F6B' }} />
                  PAN Number {formData.currency === 'INR' && <span className="text-[#E17F70]">*</span>}
                </label>
                <input
                  type="text"
                  name="panNumber"
                  value={formData.panNumber}
                  onChange={handleChange}
                  placeholder="ABCDE1234F"
                  className="w-full px-5 py-4 rounded-2xl font-mono font-bold uppercase transition-all focus:outline-none"
                  style={{ background: 'white', border: '2px solid #AEBFC3', color: '#546A7A' }}
                />
              </div>
            </div>
            {/* Bank Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: '#5D6E73' }}>
                  <Building2 className="w-4 h-4" style={{ color: '#6F8A9D' }} />
                  Beneficiary Bank Name <span style={{ color: '#E17F70' }}>*</span>
                </label>
                <input
                  type="text"
                  name="beneficiaryBankName"
                  value={formData.beneficiaryBankName}
                  onChange={handleChange}
                  placeholder="e.g., State Bank of India"
                  className="w-full px-5 py-4 rounded-2xl font-medium transition-all focus:outline-none"
                  style={{ background: '#F8FAFB', border: '2px solid #AEBFC3', color: '#546A7A' }}
                  required
                />
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: '#5D6E73' }}>
                  <User className="w-4 h-4" style={{ color: '#6F8A9D' }} />
                  Beneficiary Name
                  <span className="ml-auto text-[10px] font-medium normal-case tracking-normal" style={{ color: '#92A2A5' }}>As per bank records</span>
                </label>
                <input
                  type="text"
                  name="beneficiaryName"
                  value={formData.beneficiaryName}
                  onChange={handleChange}
                  placeholder="Full name as per bank records"
                  className="w-full px-5 py-4 rounded-2xl font-medium transition-all focus:outline-none"
                  style={{ background: '#F8FAFB', border: '2px solid #AEBFC3', color: '#546A7A' }}
                />
              </div>
            </div>

            {/* Account Details Card - Dark Kardex Theme */}
            <div 
              className="rounded-3xl p-8 text-white relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #546A7A 0%, #4F6A64 100%)' }}
            >
              {/* Card Background Effects */}
              <div className="absolute inset-0 overflow-hidden">
                <div 
                  className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl"
                  style={{ background: 'radial-gradient(circle, rgba(206,159,107,0.15) 0%, transparent 70%)' }}
                />
                <div 
                  className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full blur-2xl"
                  style={{ background: 'radial-gradient(circle, rgba(150,174,194,0.15) 0%, transparent 70%)' }}
                />
              </div>
              
              <div className="relative">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.1)' }}>
                      <CreditCard className="w-5 h-5" style={{ color: '#CE9F6B' }} />
                    </div>
                    <span className="font-bold uppercase tracking-wider text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>Account Details</span>
                  </div>
                  <BadgeCheck className="w-6 h-6" style={{ color: '#82A094' }} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-sm font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      Account Number <span style={{ color: '#E17F70' }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="accountNumber"
                      value={formData.accountNumber}
                      onChange={handleChange}
                      placeholder="Enter account number"
                      className="w-full px-5 py-4 rounded-2xl font-mono font-bold text-lg tracking-wider transition-all focus:outline-none"
                      style={{ 
                        background: 'rgba(255,255,255,0.1)', 
                        border: '2px solid rgba(255,255,255,0.2)', 
                        color: 'white' 
                      }}
                      required
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      IFSC / SWIFT Code <span style={{ color: '#E17F70' }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="ifscCode"
                      value={formData.ifscCode}
                      onChange={handleChange}
                      placeholder="e.g., SBIN0001234 or SWIFT-BIC"
                      className="w-full px-5 py-4 rounded-2xl font-mono font-black text-lg tracking-widest uppercase transition-all focus:outline-none"
                      style={{ 
                        background: 'rgba(255,255,255,0.1)', 
                        border: '2px solid rgba(255,255,255,0.2)', 
                        color: '#CE9F6B' 
                      }}
                      required
                    />
                  </div>

                  <div className="md:col-span-2 space-y-3">
                    <label className="text-sm font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      Confirm Account Number <span style={{ color: '#E17F70' }}>*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        name="confirmAccountNumber"
                        value={formData.confirmAccountNumber}
                        onChange={handleChange}
                        placeholder="Re-type account number for verification"
                        className="w-full px-5 py-4 rounded-2xl font-mono font-bold text-lg tracking-wider transition-all focus:outline-none"
                        style={{ 
                          background: formData.confirmAccountNumber && formData.accountNumber !== formData.confirmAccountNumber
                            ? 'rgba(225,127,112,0.2)'
                            : 'rgba(255,255,255,0.1)',
                          border: `2px solid ${formData.confirmAccountNumber && formData.accountNumber !== formData.confirmAccountNumber ? '#E17F70' : 'rgba(255,255,255,0.2)'}`,
                          color: formData.confirmAccountNumber && formData.accountNumber !== formData.confirmAccountNumber ? '#EEC1BF' : 'white'
                        }}
                        required
                      />
                      {formData.confirmAccountNumber && formData.accountNumber === formData.confirmAccountNumber && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          <CheckCircle2 className="w-6 h-6" style={{ color: '#82A094' }} />
                        </div>
                      )}
                      {formData.confirmAccountNumber && formData.accountNumber !== formData.confirmAccountNumber && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 animate-bounce">
                          <AlertCircle className="w-6 h-6" style={{ color: '#E17F70' }} />
                        </div>
                      )}
                    </div>
                    {formData.confirmAccountNumber && formData.accountNumber !== formData.confirmAccountNumber && (
                      <p className="text-sm font-medium flex items-center gap-2 mt-2" style={{ color: '#E17F70' }}>
                        <X className="w-4 h-4" />
                        Account numbers must match
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Step 3: Verification Documents */}
        {currentStep === 3 && (
        <div className="bg-white rounded-[2rem] border-2 overflow-hidden mb-8 animate-in fade-in slide-in-from-right-4 duration-500" 
          style={{ 
            borderColor: 'rgba(130,160,148,0.2)', 
            boxShadow: '0 16px 48px rgba(84,106,122,0.12), 0 0 0 1px rgba(130,160,148,0.05) inset'
          }}>
          <div
            className="p-6 border-b-2 flex items-center justify-between"
            style={{ 
              background: 'linear-gradient(135deg, rgba(130,160,148,0.08) 0%, rgba(162,185,175,0.05) 50%, white 100%)', 
              borderColor: 'rgba(130,160,148,0.15)' 
            }}
          >
            <div className="flex items-center gap-4">
              <div 
                className="p-3.5 rounded-2xl shadow-xl"
                style={{ 
                  background: 'linear-gradient(135deg, #82A094 0%, #4F6A64 100%)', 
                  boxShadow: '0 8px 24px rgba(130,160,148,0.3), 0 0 0 3px rgba(130,160,148,0.1)' 
                }}
              >
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-black" style={{ color: '#546A7A' }}>Documents</h2>
                <p className="text-sm font-medium" style={{ color: '#92A2A5' }}>Upload supporting documents</p>
              </div>
            </div>
            <span 
              className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border-2"
              style={{ 
                background: 'linear-gradient(135deg, rgba(130,160,148,0.1) 0%, transparent 100%)', 
                color: '#82A094', 
                borderColor: 'rgba(130,160,148,0.2)' 
              }}
            >
              Step 03
            </span>
          </div>
          
          <div className="p-8 md:p-10">
            <div className="mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: '#5D6E73' }}>
                <FileText className="w-4 h-4" style={{ color: '#82A094' }} />
                Upload Documents <span style={{ color: '#E17F70' }}>*</span>
              </h3>
              <p className="text-xs mt-1" style={{ color: '#92A2A5' }}>
                At least one document is required for verification
              </p>
            </div>
            <label 
              className="flex flex-col items-center justify-center w-full min-h-[200px] border-2 border-dashed rounded-3xl cursor-pointer transition-all group relative overflow-hidden"
              style={{ 
                borderColor: selectedFiles.length > 0 ? 'rgba(130,160,148,0.4)' : '#AEBFC3', 
                background: selectedFiles.length > 0 ? 'rgba(130,160,148,0.05)' : '#F8FAFB' 
              }}
            >
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'linear-gradient(135deg, rgba(130,160,148,0.05) 0%, rgba(79,106,100,0.05) 100%)' }}
              />
              <div className="flex flex-col items-center justify-center py-8 relative">
                <div 
                  className="p-4 rounded-2xl transition-all duration-300 mb-4"
                  style={{ 
                    background: selectedFiles.length > 0 
                      ? 'linear-gradient(135deg, #82A094 0%, #4F6A64 100%)'
                      : 'rgba(130,160,148,0.15)',
                    boxShadow: selectedFiles.length > 0 ? '0 8px 24px rgba(130,160,148,0.3)' : 'none'
                  }}
                >
                  {selectedFiles.length > 0 ? (
                    <CheckCircle2 className="w-10 h-10 text-white" />
                  ) : (
                    <Upload className="w-10 h-10" style={{ color: '#4F6A64' }} />
                  )}
                </div>
                <p className="text-lg font-bold mb-1" style={{ color: '#546A7A' }}>
                  {selectedFiles.length > 0 ? `${selectedFiles.length} file(s) selected` : 'Drop files here or click to upload'}
                </p>
                <p className="text-sm" style={{ color: '#92A2A5' }}>
                  {selectedFiles.length > 0 ? 'Click to add more files' : 'Required: Upload at least one document • PDF, JPG, PNG (Max 20MB)'}
                </p>
              </div>
              <input type="file" className="hidden" multiple onChange={handleFileSelect} />
            </label>

            {selectedFiles.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-6">
                {selectedFiles.map((file, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between p-4 rounded-2xl border group transition-all"
                    style={{ background: '#F8FAFB', borderColor: 'rgba(174,191,195,0.3)' }}
                  >
                    <div className="flex items-center gap-4 overflow-hidden">
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(130,160,148,0.15)' }}
                      >
                        <FileText className="w-6 h-6" style={{ color: '#4F6A64' }} />
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-sm font-bold truncate" style={{ color: '#546A7A' }} title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-xs" style={{ color: '#92A2A5' }}>
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => removeFile(index)}
                      className="p-2 rounded-xl transition-all"
                      style={{ color: '#92A2A5' }}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        )}

        {/* Premium Wizard Navigation */}
        <div 
          className="rounded-[2rem] border-2 p-8 backdrop-blur-sm"
          style={{ 
            background: 'linear-gradient(135deg, rgba(246,248,250,0.8) 0%, rgba(255,255,255,0.9) 100%)', 
            borderColor: 'rgba(174,191,195,0.3)',
            boxShadow: '0 8px 32px rgba(84,106,122,0.08)'
          }}
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Previous Button */}
            <button
              type="button"
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className="flex items-center gap-3 px-7 py-4 rounded-2xl font-bold transition-all duration-300 disabled:opacity-20 disabled:cursor-not-allowed hover:scale-105 active:scale-95 group"
              style={{ 
                background: currentStep === 1 ? '#F8FAFB' : 'white', 
                border: '2px solid #AEBFC3', 
                color: '#5D6E73',
                boxShadow: currentStep === 1 ? 'none' : '0 4px 16px rgba(174,191,195,0.15)'
              }}
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              <span className="hidden sm:inline">Previous</span>
            </button>

            {/* Step Progress Dots */}
            <div className="flex items-center gap-3">
              {[1, 2, 3].map(step => (
                <div
                  key={step}
                  className="relative transition-all duration-500"
                  style={{ 
                    transform: currentStep === step ? 'scale(1.3)' : 'scale(1)'
                  }}
                >
                  <div
                    className="w-3 h-3 rounded-full transition-all duration-500"
                    style={{ 
                      background: currentStep >= step 
                        ? 'linear-gradient(135deg, #6F8A9D 0%, #546A7A 100%)' 
                        : '#AEBFC3',
                      boxShadow: currentStep === step 
                        ? '0 0 0 4px rgba(111,138,157,0.2), 0 4px 12px rgba(111,138,157,0.3)' 
                        : 'none'
                    }}
                  />
                  {currentStep === step && (
                    <div 
                      className="absolute inset-0 rounded-full animate-ping"
                      style={{ background: 'rgba(111,138,157,0.4)' }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Next/Submit Button */}
            {currentStep < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-3 px-7 py-4 rounded-2xl text-white font-bold transition-all duration-300 hover:scale-105 hover:shadow-2xl active:scale-95 group"
                style={{ 
                  background: 'linear-gradient(135deg, #6F8A9D 0%, #546A7A 100%)', 
                  boxShadow: '0 8px 24px rgba(111,138,157,0.4), 0 0 0 1px rgba(111,138,157,0.5) inset'
                }}
              >
                <span>Next Step</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            ) : (
              <div className="relative group/submit">
                <button
                  type="submit"
                  disabled={loading || !!success || selectedFiles.length === 0}
                  className="flex items-center gap-3 px-8 py-4 rounded-2xl text-white font-black transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 hover:shadow-2xl active:scale-95 group"
                  style={{ 
                    background: success 
                      ? 'linear-gradient(135deg, #82A094 0%, #4F6A64 100%)'
                      : 'linear-gradient(135deg, #CE9F6B 0%, #976E44 100%)', 
                    boxShadow: success 
                      ? '0 8px 24px rgba(130,160,148,0.5)' 
                      : '0 8px 24px rgba(206,159,107,0.5), 0 0 0 1px rgba(206,159,107,0.3) inset',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {loading && (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.2)' }}>
                      <Loader2 className="w-6 h-6 animate-spin text-white" />
                    </div>
                  )}
                  {!loading && (success ? <CheckCircle2 className="w-6 h-6" /> : <Save className="w-6 h-6 group-hover:scale-110 transition-transform" />)}
                  <span className="text-base tracking-wide">
                    {loading ? 'Processing...' : success ? 'Success!' : isAdmin ? '✦ Create Account' : '↗ Submit Request'}
                  </span>
                  {!loading && !success && <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />}
                </button>
                {selectedFiles.length === 0 && !success && (
                  <div 
                    className="absolute bottom-full mb-2 right-0 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap opacity-0 group-hover/submit:opacity-100 transition-opacity pointer-events-none"
                    style={{ 
                      background: 'linear-gradient(135deg, #E17F70 0%, #9E3B47 100%)', 
                      color: 'white',
                      boxShadow: '0 4px 12px rgba(225,127,112,0.3)'
                    }}
                  >
                    ⚠ Please upload at least one document
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
