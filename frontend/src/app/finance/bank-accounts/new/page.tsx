'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { arApi } from '@/lib/ar-api';
import { useAuth } from '@/contexts/AuthContext';
import { FinanceRole } from '@/types/user.types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, Building2, Sparkles, Save, AlertCircle, 
  CheckCircle2, Mail, CreditCard, User, Loader2,
  Info, FileText, Upload, X, ArrowRight, Shield, Landmark,
  Globe, BadgeCheck, ChevronRight, Hash, Eye
} from 'lucide-react';
// Lazy-load FilePreview — it pulls in the heavy `xlsx` library (~1MB).
// This keeps it out of the initial page bundle entirely.
const FilePreview = dynamic(() => import('@/components/FilePreview'), {
  ssr: false,
  loading: () => null,
});

interface FormData {
  bpCode: string;
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
  accountType: string;
  otherCurrency?: string;
  accountCategory: string;
}

export default function NewBankAccountPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [activeStep, setActiveStep] = useState(1);
  const [isMounted, setIsMounted] = useState(false);
  const [previewFile, setPreviewFile] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  
  const isAdmin = user?.financeRole === FinanceRole.FINANCE_ADMIN;

  const [formData, setFormData] = useState<FormData>({
    bpCode: '',
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
    accountType: '',
    otherCurrency: '',
    accountCategory: ''
  });

  const [selectedFiles, setSelectedFiles] = useState<{file: File, vendorType: string}[]>([]);

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

  // Validation helpers
  const isNumericOnly = (val: string) => /^[0-9]*$/.test(val);
  const isLettersOnly = (val: string) => /^[A-Za-z\s.\-&'(),/]*$/.test(val);
  const isAlphanumeric = (val: string) => /^[A-Za-z0-9]*$/.test(val);
  const isAlphanumericWithHyphen = (val: string) => /^[A-Za-z0-9\-]*$/.test(val);
  const isValidEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  const isValidGST = (val: string) => /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/.test(val);
  const isValidPAN = (val: string) => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val);
  const isValidIFSC = (val: string) => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(val);
  const isLettersOnlyStrict = (val: string) => /^[A-Za-z]*$/.test(val);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    // Real-time input filtering
    if (name === 'bpCode') {
      // Numbers only for Vendor Code
      if (value !== '' && !isNumericOnly(value)) {
        setFieldErrors(prev => ({ ...prev, bpCode: 'Vendor Code accepts numbers only' }));
        return;
      }
      setFieldErrors(prev => ({ ...prev, bpCode: '' }));
    }

    if (name === 'vendorName') {
      // Letters, spaces, dots, hyphens, ampersands — no numbers
      if (value !== '' && !isLettersOnly(value)) {
        setFieldErrors(prev => ({ ...prev, vendorName: 'Vendor Name should contain letters only (no numbers)' }));
        return;
      }
      setFieldErrors(prev => ({ ...prev, vendorName: '' }));
    }

    if (name === 'nickName') {
      // Letters, spaces — no numbers
      if (value !== '' && !isLettersOnly(value)) {
        setFieldErrors(prev => ({ ...prev, nickName: 'Nick Name should contain letters only (no numbers)' }));
        return;
      }
      setFieldErrors(prev => ({ ...prev, nickName: '' }));
    }

    if (name === 'emailId') {
      // Clear error on typing, validate on blur or submit
      if (value === '' || isValidEmail(value)) {
        setFieldErrors(prev => ({ ...prev, emailId: '' }));
      } else {
        setFieldErrors(prev => ({ ...prev, emailId: 'Please enter a valid email address (e.g. vendor@company.com)' }));
      }
    }

    if (name === 'beneficiaryBankName') {
      if (value !== '' && !isLettersOnly(value)) {
        setFieldErrors(prev => ({ ...prev, beneficiaryBankName: 'Bank Name should contain letters only (no numbers)' }));
        return;
      }
      setFieldErrors(prev => ({ ...prev, beneficiaryBankName: '' }));
    }

    if (name === 'beneficiaryName') {
      if (value !== '' && !isLettersOnly(value)) {
        setFieldErrors(prev => ({ ...prev, beneficiaryName: 'Beneficiary Name should contain letters only (no numbers)' }));
        return;
      }
      setFieldErrors(prev => ({ ...prev, beneficiaryName: '' }));
    }

    if (name === 'accountNumber' || name === 'confirmAccountNumber') {
      if (value !== '' && !isNumericOnly(value)) {
        setFieldErrors(prev => ({ ...prev, [name]: 'Account Number must contain numbers only' }));
        return;
      }
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }

    if (name === 'ifscCode') {
      if (value !== '' && !isAlphanumeric(value)) {
        setFieldErrors(prev => ({ ...prev, ifscCode: 'IFSC/SWIFT Code must be alphanumeric' }));
        return;
      }
      setFieldErrors(prev => ({ ...prev, ifscCode: '' }));
    }

    if (name === 'gstNumber') {
      if (value !== '' && !isAlphanumeric(value)) {
        setFieldErrors(prev => ({ ...prev, gstNumber: 'GST Number must be alphanumeric' }));
        return;
      }
      setFieldErrors(prev => ({ ...prev, gstNumber: '' }));
    }

    if (name === 'panNumber') {
      if (value !== '' && !isAlphanumeric(value)) {
        setFieldErrors(prev => ({ ...prev, panNumber: 'PAN Number must be alphanumeric' }));
        return;
      }
      setFieldErrors(prev => ({ ...prev, panNumber: '' }));
    }

    if (name === 'udyamRegNum') {
      if (value !== '' && !isAlphanumericWithHyphen(value)) {
        setFieldErrors(prev => ({ ...prev, udyamRegNum: 'Only letters, numbers and hyphens are allowed' }));
        return;
      }
      setFieldErrors(prev => ({ ...prev, udyamRegNum: '' }));
    }

    if (name === 'otherCurrency') {
      if (value !== '' && !isLettersOnlyStrict(value)) {
        setFieldErrors(prev => ({ ...prev, otherCurrency: 'Currency code must contain letters only (e.g. GBP)' }));
        return;
      }
      setFieldErrors(prev => ({ ...prev, otherCurrency: '' }));
    }
    
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
      const newFiles = Array.from(e.target.files).map(file => ({ file, vendorType: '' }));
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const updateFileVendorType = (index: number, vendorType: string) => {
    setSelectedFiles(prev => prev.map((item, i) => i === index ? { ...item, vendorType } : item));
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
          for (const { file, vendorType } of selectedFiles) {
            await arApi.uploadBankAccountAttachment(account.id, file, vendorType);
          }
        }
        
        setSuccess('Vendor bank account created successfully!');
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
          for (const { file, vendorType } of selectedFiles) {
            await arApi.uploadBankAccountAttachment(request.id, file, vendorType);
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
    { id: 2, title: 'Vendor Bank Account', icon: Landmark, description: 'Banking details' },
    { id: 3, title: 'Documents', icon: FileText, description: 'Verification' },
  ];

  const getCompletionPercentage = () => {
    let filled = 0;
    const required = ['bpCode', 'vendorName', 'beneficiaryBankName', 'accountNumber', 'ifscCode', 'confirmAccountNumber'];
    required.forEach(field => {
      if (formData[field as keyof FormData]) filled++;
    });
    return Math.round((filled / required.length) * 100);
  };

  const validateStep = (step: number): { valid: boolean; message?: string } => {
    if (step === 1) {
      if (!formData.bpCode) {
        return { valid: false, message: 'BP Code / Vendor Code is required' };
      }
      if (!isNumericOnly(formData.bpCode)) {
        return { valid: false, message: 'Vendor Code must contain numbers only' };
      }
      if (!formData.vendorName) {
        return { valid: false, message: 'Vendor name is required' };
      }
      if (!isLettersOnly(formData.vendorName)) {
        return { valid: false, message: 'Vendor Name should contain letters only (no numbers)' };
      }
      if (formData.nickName && !isLettersOnly(formData.nickName)) {
        return { valid: false, message: 'Nick Name should contain letters only (no numbers)' };
      }
      if (formData.emailId && !isValidEmail(formData.emailId)) {
        return { valid: false, message: 'Please enter a valid email address' };
      }
      if (formData.isMSME && !formData.udyamRegNum) {
        return { valid: false, message: 'Udyam Registration Number is required for MSME vendors' };
      }
      return { valid: true };
    }
    if (step === 2) {
      // Account category must be selected first
      const selectedCategory = formData.accountCategory;
      if (!selectedCategory) {
        return { valid: false, message: 'Please select an Account Category first' };
      }

      if (!formData.beneficiaryBankName) {
        return { valid: false, message: 'Beneficiary Bank Name is required' };
      }
      if (!isLettersOnly(formData.beneficiaryBankName)) {
        return { valid: false, message: 'Beneficiary Bank Name should contain letters only (no numbers)' };
      }
      if (formData.beneficiaryName && !isLettersOnly(formData.beneficiaryName)) {
        return { valid: false, message: 'Beneficiary Name should contain letters only (no numbers)' };
      }
      if (!formData.accountNumber) {
        return { valid: false, message: 'Account Number is required' };
      }
      if (!isNumericOnly(formData.accountNumber)) {
        return { valid: false, message: 'Account Number must contain numbers only' };
      }
      if (!formData.ifscCode) {
        return { valid: false, message: 'IFSC/SWIFT Code is required' };
      }
      if (formData.ifscCode.length >= 11 && !isValidIFSC(formData.ifscCode.toUpperCase())) {
        return { valid: false, message: 'Invalid IFSC Code format (e.g. SBIN0001234)' };
      }
      if (!formData.confirmAccountNumber) {
        return { valid: false, message: 'Please confirm the account number' };
      }
      if (formData.accountNumber !== formData.confirmAccountNumber) {
        return { valid: false, message: 'Account numbers do not match' };
      }
      // GST/PAN required only for DOMESTIC and EMPLOYEE with INR currency
      if (selectedCategory !== 'INTERNATIONAL') {
        if (formData.currency === 'INR') {
          if (!formData.gstNumber) {
            return { valid: false, message: 'GST Number is required for INR transactions' };
          }
          if (!formData.panNumber) {
            return { valid: false, message: 'PAN Number is required for INR transactions' };
          }
        }
      }
      if (formData.currency === 'Other' && !formData.otherCurrency) {
        return { valid: false, message: 'Please specify the currency code' };
      }
      if (formData.otherCurrency && !isLettersOnlyStrict(formData.otherCurrency)) {
        return { valid: false, message: 'Currency code must contain letters only' };
      }
      return { valid: true };
    }
    if (step === 3) {
      const selectedCategory = formData.accountCategory;
      if (!selectedCategory) {
        return { valid: false, message: 'Please go back and select an Account Category in Step 2' };
      }

      // Single-select: validate the one selected type
      const hasFile = selectedFiles.some(f => f.vendorType === selectedCategory);
      if (!hasFile) {
        const messages: Record<string, string> = {
          'DOMESTIC': 'Step 3: Domestic requires a Bank Letter or Cancelled Cheque upload',
          'INTERNATIONAL': 'Step 3: International requires a Bank Letter upload',
          'EMPLOYEE': 'Step 3: Employee requires one verification document'
        };
        return { valid: false, message: messages[selectedCategory] || 'Step 3: Please upload the required document' };
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
    <div className="w-full min-h-screen bg-[#F8FAFB]">
      {/* Refined Compact Header */}
      <div 
        className={`relative overflow-hidden rounded-[1.5rem] mb-8 transition-all duration-700 ${isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
        style={{ 
          background: 'linear-gradient(135deg, #546A7A 0%, #6F8A9D 100%)',
          boxShadow: '0 10px 40px rgba(84,106,122,0.15)'
        }}
      >
        {/* Subtle Decorative Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
          <div 
            className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl animate-pulse"
            style={{ background: 'radial-gradient(circle, #CE9F6B 0%, transparent 70%)', animationDuration: '4s' }}
          />
          <div 
            className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, #82A094 0%, transparent 70%)' }}
          />
        </div>
        
        <div className="relative p-6 md:p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Title & Navigation Section */}
            <div className="flex items-center gap-5 w-full md:w-auto">
              <Button
                variant="outline"
                size="icon"
                onClick={() => router.push('/finance/bank-accounts')}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white transition-all shrink-0 h-10 w-10 md:h-12 md:w-12 rounded-xl"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span 
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#CE9F6B]/20 text-[#EEC1BF] border border-[#CE9F6B]/30"
                  >
                    {isAdmin ? '✦ Administration' : '↗ Request Account'}
                  </span>
                </div>
                <h1 className="text-xl md:text-2xl lg:text-3xl font-black text-white tracking-tight truncate">
                  {isAdmin ? 'Add Vendor Bank Account' : 'Request Vendor Bank Account'}
                </h1>
                <p className="text-xs md:text-sm text-white/70 font-medium flex items-center gap-1.5 truncate mt-0.5">
                  <Shield className="w-3.5 h-3.5 text-[#CE9F6B]" />
                  {isAdmin ? 'Create verified vendor bank account' : 'Submit for verification'}
                </p>
              </div>
            </div>

            {/* Compact Progress Section */}
            <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-white/10 pt-4 md:pt-0">
              {/* Stepper Dots (Simplified) */}
              <div className="flex items-center gap-3">
                {steps.map((step) => (
                  <div key={step.id} className="flex flex-col items-center gap-1.5">
                    <div 
                      className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${
                        currentStep === step.id ? 'bg-[#CE9F6B] text-white shadow-lg shadow-[#CE9F6B]/30' : 
                        currentStep > step.id ? 'bg-[#82A094] text-white' : 'bg-white/10 text-white/40'
                      }`}
                      onClick={() => currentStep > step.id && setCurrentStep(step.id)}
                      style={{ cursor: currentStep > step.id ? 'pointer' : 'default' }}
                    >
                      {currentStep > step.id ? <CheckCircle2 className="w-4 h-4" /> : <step.icon className="w-4 h-4" />}
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-tight ${currentStep === step.id ? 'text-[#CE9F6B]' : 'text-white/40'}`}>
                      {step.title.split(' ')[0]}
                    </span>
                  </div>
                ))}
              </div>

              {/* Minimal Progress Circle */}
              <div className="relative h-14 w-14 shrink-0">
                <svg className="w-full h-full -rotate-90">
                  <circle cx="28" cy="28" r="24" stroke="rgba(255,255,255,0.1)" strokeWidth="4" fill="none" />
                  <circle 
                    cx="28" cy="28" r="24" 
                    stroke="url(#headerGradient)" 
                    strokeWidth="4" 
                    fill="none" 
                    strokeLinecap="round"
                    strokeDasharray={`${(getCompletionPercentage() / 100) * 150.8} 150.8`}
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="headerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#EEC1BF" />
                      <stop offset="100%" stopColor="#CE9F6B" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-black text-white">{getCompletionPercentage()}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Info banner for non-admin */}
      {!isAdmin && (
        <Card className={`border-[#6F8A9D]/30 bg-gradient-to-r from-[#6F8A9D]/10 to-[#6F8A9D]/5 mb-8 transition-all duration-500 delay-100 ${isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-[#6F8A9D]/20">
                <Info className="w-6 h-6 text-[#6F8A9D]" />
              </div>
              <div>
                <p className="font-bold text-lg mb-1 text-[#546A7A]">Administrative Review Required</p>
                <p className="text-[#5D6E73]">
                  Your submission will undergo a verification process by the Finance Administration team. 
                  Please ensure all bank details and attachments are accurate to facilitate swift approval.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}


      {/* Main Form */}
      <form onSubmit={handleSubmit} className={`transition-all duration-500 delay-200 ${isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        {/* Error/Success Messages */}
        {error && (
          <Card className="border-[#E17F70]/40 bg-gradient-to-r from-[#E17F70]/15 to-[#9E3B47]/8 mb-8 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-[#E17F70] to-[#9E3B47] shadow-lg">
                  <AlertCircle className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-black text-lg mb-1 text-[#9E3B47]">Error</p>
                  <p className="font-medium text-base text-[#75242D]">{error}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setError('')}
                  className="p-2 rounded-xl hover:bg-[#E17F70]/10 transition-colors text-[#E17F70]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {success && (
          <Card className="border-[#82A094]/40 bg-gradient-to-r from-[#82A094]/15 to-[#4F6A64]/8 mb-8 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-[#82A094] to-[#4F6A64] shadow-lg animate-pulse" style={{ animationDuration: '2s' }}>
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-black text-lg mb-1 text-[#4F6A64]">Success!</p>
                  <p className="font-medium text-base text-[#4F6A64]">{success}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}


        {/* Step 1: Vendor Information */}
        {currentStep === 1 && (
        <Card className="shadow-xl overflow-hidden border-0 mb-8 animate-in fade-in slide-in-from-right-4 duration-500">
          <CardHeader className="bg-gradient-to-r from-[#CE9F6B] to-[#976E44] text-white border-b-0 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl text-white font-black">Vendor Information</CardTitle>
                  <CardDescription className="text-white/80">Enter basic vendor details</CardDescription>
                </div>
              </div>
              <span className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-white/20 text-white border border-white/30">
                Step 01
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-8 md:p-10">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* BP Code */}
              <div className="space-y-2.5">
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider" style={{ color: '#5D6E73' }}>
                  <Shield className="w-3.5 h-3.5" style={{ color: '#B18E63' }} />
                  BP Code / Vendor Code <span style={{ color: '#E17F70' }}>*</span>
                </label>
                <input
                  type="text"
                  name="bpCode"
                  value={formData.bpCode}
                  onChange={handleChange}
                  placeholder="e.g. 12345 or 001"
                  maxLength={7}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className={`w-full px-4 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider transition-all focus:outline-none border-2 bg-[#F8FAFB] text-[#546A7A] ${
                    fieldErrors.bpCode ? 'border-[#E17F70] focus:border-[#E17F70]' : 'border-[#AEBFC3] focus:border-[#CE9F6B]/50'
                  }`}
                  required
                />
                {fieldErrors.bpCode && (
                  <p className="text-[11px] font-medium text-[#E17F70] flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {fieldErrors.bpCode}
                  </p>
                )}
              </div>

              {/* Vendor Name */}
              <div className="md:col-span-1 xl:col-span-1 space-y-2.5">
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
                  maxLength={100}
                  className={`w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-all focus:outline-none border-2 bg-[#F8FAFB] text-[#546A7A] ${
                    fieldErrors.vendorName ? 'border-[#E17F70] focus:border-[#E17F70]' : 'border-[#AEBFC3] focus:border-[#CE9F6B]/50'
                  }`}
                  required
                />
                {fieldErrors.vendorName && (
                  <p className="text-[11px] font-medium text-[#E17F70] flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {fieldErrors.vendorName}
                  </p>
                )}
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
                  maxLength={30}
                  className={`w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-all focus:outline-none border-2 bg-[#F8FAFB] text-[#546A7A] ${
                    fieldErrors.nickName ? 'border-[#E17F70] focus:border-[#E17F70]' : 'border-[#AEBFC3] focus:border-[#CE9F6B]/50'
                  }`}
                />
                {fieldErrors.nickName && (
                  <p className="text-[11px] font-medium text-[#E17F70] flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {fieldErrors.nickName}
                  </p>
                )}
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
                  maxLength={50}
                  className={`w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-all focus:outline-none border-2 bg-[#F8FAFB] text-[#546A7A] ${
                    fieldErrors.emailId ? 'border-[#E17F70] focus:border-[#E17F70]' : 'border-[#AEBFC3] focus:border-[#CE9F6B]/50'
                  }`}
                />
                {fieldErrors.emailId && (
                  <p className="text-[11px] font-medium text-[#E17F70] flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {fieldErrors.emailId}
                  </p>
                )}
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
                    maxLength={19}
                    className={`w-full px-4 py-3 rounded-xl font-mono font-bold text-base tracking-widest transition-all focus:outline-none border-2 bg-white text-[#546A7A] ${
                      fieldErrors.udyamRegNum ? 'border-[#E17F70]' : 'border-[#CE9F6B]'
                    }`}
                    required={formData.isMSME}
                  />
                  {fieldErrors.udyamRegNum && (
                    <p className="text-[11px] font-medium text-[#E17F70] flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      {fieldErrors.udyamRegNum}
                    </p>
                  )}
              </div>
              )}
            </div>
          </CardContent>
        </Card>
        )}

        {/* Step 2: Bank & Currency Details */}
        {currentStep === 2 && (
        <Card className="shadow-xl overflow-hidden border-0 mb-8 animate-in fade-in slide-in-from-right-4 duration-500">
          <CardHeader className="bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white border-b-0 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                  <Landmark className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl text-white font-black">Bank Details</CardTitle>
                  <CardDescription className="text-white/80">Account and routing information</CardDescription>
                </div>
              </div>
              <span className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-white/20 text-white border border-white/30">
                Step 02
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-8 md:p-10 space-y-8">
            {/* Account Category Selection - FIRST */}
            <div className="mb-2">
              <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 mb-6 text-[#546A7A]">
                <Sparkles className="w-4 h-4 text-[#CE9F6B]" />
                Select Account Category <span className="text-[#E17F70]">*</span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'DOMESTIC', label: 'Domestic', icon: Building2, color: '#82A094', desc: 'GST & PAN required for INR' },
                  { id: 'INTERNATIONAL', label: 'International', icon: Globe, color: '#6F8A9D', desc: 'GST & PAN not required' },
                  { id: 'EMPLOYEE', label: 'Employee', icon: User, color: '#CE9F6B', desc: 'GST & PAN required for INR' }
                ].map((type) => {
                  const isSelected = formData.accountCategory === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) return;
                        setFormData(prev => ({ ...prev, accountCategory: type.id }));
                        // Clear GST/PAN if switching to international
                        if (type.id === 'INTERNATIONAL') {
                          setFormData(prev => ({ ...prev, accountCategory: type.id, gstNumber: '', panNumber: '' }));
                        }
                        setSelectedFiles([]);
                      }}
                      className={`relative p-5 rounded-2xl border-2 transition-all text-left flex flex-col gap-3 group ${
                        isSelected 
                          ? 'border-[#CE9F6B] bg-white shadow-xl shadow-[#CE9F6B]/10' 
                          : 'border-[#AEBFC3]/30 bg-[#F8FAFB] hover:border-[#CE9F6B]/30'
                      }`}
                    >
                      <div className={`p-3 rounded-xl w-fit transition-colors ${isSelected ? 'bg-[#CE9F6B] text-white' : 'bg-white text-[#AEBFC3] group-hover:text-[#CE9F6B]'}`}>
                        <type.icon className="w-6 h-6" />
                      </div>
                      <div>
                        <p className={`font-black uppercase tracking-tight ${isSelected ? 'text-[#546A7A]' : 'text-[#92A2A5]'}`}>
                          {type.label}
                        </p>
                        <p className="text-[10px] font-bold text-[#AEBFC3] mt-0.5 leading-tight">{type.desc}</p>
                      </div>
                      
                      {isSelected && (
                        <div className="absolute top-4 right-4">
                          <CheckCircle2 className="w-5 h-5 text-[#82A094]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Show bank details fields only after category is selected */}
            {formData.accountCategory && (
            <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Currency & Account Type */}
            <div 
              className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 rounded-3xl border"
              style={{ background: 'linear-gradient(135deg, rgba(150,174,194,0.1) 0%, rgba(111,138,157,0.05) 100%)', borderColor: 'rgba(150,174,194,0.2)' }}
            >
              {/* Currency */}
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
                    className="w-full px-4 py-3 rounded-xl font-bold appearance-none cursor-pointer transition-all focus:outline-none bg-white border-2 border-[#96AEC2] text-[#546A7A] focus:border-[#6F8A9D]/50"
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

              {/* Account Type */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: '#5D6E73' }}>
                  <CreditCard className="w-4 h-4" style={{ color: '#6F8A9D' }} />
                  Account Type <span style={{ color: '#E17F70' }}>*</span>
                </label>
                <div className="relative">
                  <select
                  name="accountType"
                  value={formData.accountType}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl font-bold appearance-none cursor-pointer transition-all focus:outline-none bg-white border-2 border-[#96AEC2] text-[#546A7A] focus:border-[#6F8A9D]/50"
                  required
                >
                  <option value="" disabled>🏦 Select Account Type</option>
                  <option value="Current">🏦 Current Account</option>
                  <option value="Savings">💰 Savings Account</option>
                </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#96AEC2' }}>
                    <ChevronRight className="w-5 h-5 rotate-90" />
                  </div>
                </div>
              </div>

              {formData.currency === 'Other' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-500 md:col-span-2">
                  <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider" style={{ color: '#5D6E73' }}>
                    <Sparkles className="w-4 h-4" style={{ color: '#6F8A9D' }} />
                    Specify ISO Code <span style={{ color: '#E17F70' }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="otherCurrency"
                    value={formData.otherCurrency}
                    onChange={handleChange}
                    placeholder="e.g., GBP, JPY"
                    maxLength={3}
                    className={`w-full px-5 py-4 rounded-2xl uppercase tracking-widest font-bold text-lg transition-all focus:outline-none`}
                    style={{ background: 'white', border: `2px solid ${fieldErrors.otherCurrency ? '#E17F70' : '#96AEC2'}`, color: '#546A7A' }}
                    required={formData.currency === 'Other'}
                  />
                  {fieldErrors.otherCurrency && (
                    <p className="text-[11px] font-medium text-[#E17F70] flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3 h-3" />
                      {fieldErrors.otherCurrency}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Tax Details - Only for DOMESTIC and EMPLOYEE */}
            {formData.accountCategory !== 'INTERNATIONAL' && (
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
                  maxLength={15}
                  className={`w-full px-5 py-4 rounded-2xl font-mono font-bold uppercase transition-all focus:outline-none`}
                  style={{ background: 'white', border: `2px solid ${fieldErrors.gstNumber ? '#E17F70' : '#AEBFC3'}`, color: '#546A7A' }}
                />
                {fieldErrors.gstNumber && (
                  <p className="text-[11px] font-medium text-[#E17F70] flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {fieldErrors.gstNumber}
                  </p>
                )}
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
                  maxLength={10}
                  className={`w-full px-5 py-4 rounded-2xl font-mono font-bold uppercase transition-all focus:outline-none`}
                  style={{ background: 'white', border: `2px solid ${fieldErrors.panNumber ? '#E17F70' : '#AEBFC3'}`, color: '#546A7A' }}
                />
                {fieldErrors.panNumber && (
                  <p className="text-[11px] font-medium text-[#E17F70] flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {fieldErrors.panNumber}
                  </p>
                )}
              </div>
            </div>
            )}
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
                  maxLength={50}
                  className={`w-full px-5 py-4 rounded-2xl font-medium transition-all focus:outline-none`}
                  style={{ background: '#F8FAFB', border: `2px solid ${fieldErrors.beneficiaryBankName ? '#E17F70' : '#AEBFC3'}`, color: '#546A7A' }}
                  required
                />
                {fieldErrors.beneficiaryBankName && (
                  <p className="text-[11px] font-medium text-[#E17F70] flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {fieldErrors.beneficiaryBankName}
                  </p>
                )}
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
                  maxLength={50}
                  className={`w-full px-5 py-4 rounded-2xl font-medium transition-all focus:outline-none`}
                  style={{ background: '#F8FAFB', border: `2px solid ${fieldErrors.beneficiaryName ? '#E17F70' : '#AEBFC3'}`, color: '#546A7A' }}
                />
                {fieldErrors.beneficiaryName && (
                  <p className="text-[11px] font-medium text-[#E17F70] flex items-center gap-1 mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {fieldErrors.beneficiaryName}
                  </p>
                )}
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
                      maxLength={18}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className={`w-full px-4 py-3 rounded-xl font-mono font-bold text-base tracking-wider transition-all focus:outline-none border-2 text-white ${
                        fieldErrors.accountNumber ? 'bg-[#E17F70]/20 border-[#E17F70]' : 'bg-white/10 border-white/20 focus:border-white/40'
                      }`}
                      required
                    />
                    {fieldErrors.accountNumber && (
                      <p className="text-[11px] font-medium text-[#E17F70] flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3 h-3" />
                        {fieldErrors.accountNumber}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.6)' }}>
                      IFSC Code / SWIFT Code <span style={{ color: '#E17F70' }}>*</span>
                    </label>
                    <input
                      type="text"
                      name="ifscCode"
                      value={formData.ifscCode}
                      onChange={handleChange}
                      placeholder="e.g., SBIN0001234 or SWIFT-BIC"
                      maxLength={11}
                      className={`w-full px-4 py-3 rounded-xl font-mono font-black text-base tracking-widest uppercase transition-all focus:outline-none border-2 ${
                        fieldErrors.ifscCode ? 'bg-[#E17F70]/20 border-[#E17F70] text-[#EEC1BF]' : 'bg-white/10 border-white/20 text-[#CE9F6B] focus:border-[#CE9F6B]/50'
                      }`}
                      required
                    />
                    {fieldErrors.ifscCode && (
                      <p className="text-[11px] font-medium text-[#E17F70] flex items-center gap-1 mt-1">
                        <AlertCircle className="w-3 h-3" />
                        {fieldErrors.ifscCode}
                      </p>
                    )}
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
                        maxLength={18}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        className={`w-full px-4 py-3 rounded-xl font-mono font-bold text-base tracking-wider transition-all focus:outline-none border-2 ${
                          fieldErrors.confirmAccountNumber
                            ? 'bg-[#E17F70]/20 border-[#E17F70] text-[#EEC1BF]'
                            : formData.confirmAccountNumber && formData.accountNumber !== formData.confirmAccountNumber
                            ? 'bg-[#E17F70]/20 border-[#E17F70] text-[#EEC1BF]'
                            : 'bg-white/10 border-white/20 text-white focus:border-white/40'
                        }`}
                        required
                      />
                      {fieldErrors.confirmAccountNumber && (
                        <p className="text-[11px] font-medium text-[#E17F70] flex items-center gap-1 mt-1">
                          <AlertCircle className="w-3 h-3" />
                          {fieldErrors.confirmAccountNumber}
                        </p>
                      )}
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
            )}
          </CardContent>
        </Card>
        )}

        {/* Step 3: Documents Section */}
        {currentStep === 3 && (
        <Card className="shadow-xl overflow-hidden border-0 mb-8 animate-in fade-in slide-in-from-right-4 duration-500">
          <CardHeader className="bg-gradient-to-r from-[#82A094] to-[#4F6A64] text-white border-b-0 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl text-white font-black">Verification Documents</CardTitle>
                  <CardDescription className="text-white/80">Upload supporting documentation for {formData.accountCategory?.charAt(0) + formData.accountCategory?.slice(1).toLowerCase()} account</CardDescription>
                </div>
              </div>
              <span className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest bg-white/20 text-white border border-white/30">
                Step 03
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-8 md:p-10">
            {/* Upload Files for Selected Types */}
            {formData.accountCategory ? (
              <div className="space-y-8">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-[#546A7A]">
                    <Upload className="w-4 h-4 text-[#82A094]" />
                    Upload Documents <span className="text-[#E17F70]">*</span>
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {[formData.accountCategory].map((typeId: string) => {
                    const fileDetail = selectedFiles.find(f => f.vendorType === typeId);
                    const typeLabel = typeId.charAt(0) + typeId.slice(1).toLowerCase();
                    
                    return (
                      <div key={typeId} className="relative">
                        <div 
                          className={`p-1 rounded-[2rem] transition-all bg-gradient-to-r ${
                            fileDetail ? 'from-[#82A094] to-[#4F6A64]' : 'from-[#AEBFC3]/50 to-[#AEBFC3]/20'
                          }`}
                        >
                          <div className="bg-white rounded-[1.8rem] p-6 flex flex-col md:flex-row items-center gap-6">
                            <div className={`p-4 rounded-2xl ${fileDetail ? 'bg-[#82A094]/10 text-[#82A094]' : 'bg-[#F8FAFB] text-[#AEBFC3]'}`}>
                              {typeId === 'DOMESTIC' ? <Building2 className="w-8 h-8" /> : 
                               typeId === 'INTERNATIONAL' ? <Globe className="w-8 h-8" /> : 
                               <User className="w-8 h-8" />}
                            </div>
                            
                            <div className="flex-1 text-center md:text-left min-w-0">
                              <h4 className="font-black text-[#546A7A] text-lg uppercase tracking-tight">{typeLabel} Documents</h4>
                              <div className="space-y-2 mt-2">
                                {selectedFiles.filter(f => f.vendorType === typeId).length > 0 ? (
                                  selectedFiles.filter(f => f.vendorType === typeId).map((f, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-[#82A094] font-bold text-sm bg-[#82A094]/5 p-2 rounded-xl border border-[#82A094]/10">
                                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                                      <span className="truncate max-w-[150px]">{f.file.name}</span>
                                      <span className="text-[10px] opacity-60">({(f.file.size / 1024 / 1024).toFixed(2)} MB)</span>
                                      <button 
                                        type="button" 
                                        onClick={() => {
                                          setPreviewFile({
                                            filename: f.file.name,
                                            mimeType: f.file.type || 'application/octet-stream',
                                            localFile: f.file
                                          });
                                          setShowPreview(true);
                                        }}
                                        className="ml-auto p-1.5 rounded-lg hover:bg-[#CE9F6B]/20 hover:text-[#976E44] transition-colors"
                                        title="Preview file"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                      <button 
                                        type="button" 
                                        onClick={() => setSelectedFiles(prev => prev.filter(fileItem => fileItem !== f))}
                                        className="p-1.5 rounded-lg hover:bg-[#E17F70]/20 hover:text-[#E17F70] transition-colors"
                                        title="Remove file"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-[#92A2A5] text-sm font-medium">
                                    {typeId === 'DOMESTIC' ? 'Bank Letter or Cancelled Cheque is mandatory.' : 
                                     typeId === 'INTERNATIONAL' ? 'Bank Letter is mandatory.' : 
                                     'One verification document is mandatory.'}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                                <label className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#546A7A] text-white text-sm font-bold cursor-pointer hover:bg-[#455A64] transition-all shadow-lg shadow-[#546A7A]/20">
                                  <Upload className="w-4 h-4" />
                                  Upload {selectedFiles.filter(f => f.vendorType === typeId).length > 0 ? 'More' : 'File'}
                                  <input 
                                    type="file" 
                                    className="hidden" 
                                    multiple
                                    onChange={(e) => {
                                      if (e.target.files) {
                                        const files = Array.from(e.target.files);
                                        setSelectedFiles(prev => [
                                          ...prev, 
                                          ...files.map(file => ({ file, vendorType: typeId }))
                                        ]);
                                      }
                                      e.target.value = ''; // Reset for same file re-upload if needed
                                    }} 
                                  />
                                </label>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-20 bg-[#F8FAFB] rounded-[2.5rem] border-2 border-dashed border-[#AEBFC3]/30">
                <Sparkles className="w-12 h-12 text-[#AEBFC3]/40 mx-auto mb-4" />
                <p className="text-[#546A7A] font-black text-lg">No Category Selected</p>
                <p className="text-[#92A2A5] text-sm font-medium mt-1">Please go back to Step 2 and select an Account Category first</p>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Premium Wizard Navigation */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm rounded-[1.5rem] mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              {/* Previous Button */}
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevious}
                disabled={currentStep === 1}
                className="w-full md:w-auto px-8 h-12 rounded-xl font-bold border-[#AEBFC3] text-[#5D6E73] hover:bg-[#F8FAFB]"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Previous
              </Button>

              {/* Step Progress Dots */}
              <div className="flex items-center gap-3">
                {[1, 2, 3].map(step => (
                  <div
                    key={step}
                    className={`h-2.5 rounded-full transition-all duration-500 ${
                      currentStep === step ? 'w-8 bg-[#6F8A9D]' : 'w-2.5 bg-[#AEBFC3]'
                    } ${currentStep > step ? 'bg-[#82A094]' : ''}`}
                  />
                ))}
              </div>

              {/* Next/Submit Button */}
              <div className="w-full md:w-auto">
                {currentStep < 3 ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="w-full md:w-auto px-8 h-12 rounded-xl font-bold bg-gradient-to-r from-[#6F8A9D] to-[#546A7A] text-white shadow-lg shadow-[#6F8A9D]/30"
                  >
                    Next Step
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                ) : (
                  <div className="relative group/submit w-full md:w-auto">
                    <Button
                      type="submit"
                      disabled={loading || !!success || !formData.accountCategory || !selectedFiles.some(f => f.vendorType === formData.accountCategory)}
                      className={`w-full md:w-auto px-10 h-12 rounded-xl font-black text-white shadow-xl transition-all ${
                        success 
                          ? 'bg-gradient-to-r from-[#82A094] to-[#4F6A64]'
                          : 'bg-gradient-to-r from-[#CE9F6B] to-[#976E44] shadow-[#CE9F6B]/30'
                      }`}
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      ) : success ? (
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                      ) : (
                        <Save className="w-5 h-5 mr-2" />
                      )}
                      {loading ? 'Processing...' : success ? 'Success!' : isAdmin ? 'Create Account' : 'Submit Request'}
                      {!loading && !success && <Sparkles className="w-4 h-4 ml-2" />}
                    </Button>
                    {(!formData.accountCategory || !selectedFiles.some(f => f.vendorType === formData.accountCategory)) && !success && (
                      <div className="absolute bottom-full mb-3 right-0 px-4 py-2 rounded-xl text-[10px] font-bold bg-[#E17F70] text-white opacity-0 group-hover/submit:opacity-100 transition-opacity pointer-events-none shadow-lg">
                        ⚠ Please ensure category is selected and document is uploaded
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </form>

      <FilePreview 
        isOpen={showPreview} 
        onClose={() => setShowPreview(false)} 
        file={previewFile} 
      />
    </div>
  );
}
