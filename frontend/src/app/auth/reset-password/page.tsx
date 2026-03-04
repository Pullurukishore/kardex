"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { apiClient } from "@/lib/api/api-client";

const resetPasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      toast({
        title: "Invalid Reset Link",
        description: "No reset token found. Please request a new password reset.",
        variant: "destructive",
      });
    } else {
      setTokenValid(true);
    }
  }, [token]);

  const onSubmit = async (values: ResetPasswordFormValues) => {
    if (!token || isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      const response = await apiClient.post('/auth/reset-password', {
        token,
        password: values.password
      });
      
      if (response.data.success) {
        setResetSuccess(true);
        toast({
          title: "🎉 Password Reset Successful!",
          description: "Your password has been updated successfully.",
          duration: 5000,
        });
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/auth/login');
        }, 3000);
      } else {
        throw new Error(response.data.message || 'Failed to reset password');
      }
    } catch (error: any) {
      toast({
        title: "Reset failed",
        description: error?.response?.data?.message || "Failed to reset password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (tokenValid === false) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-gradient-to-br from-[#6F8A9D] via-[#5a7ba0] to-[#4a6b8a]"></div>
        <Card className="w-full max-w-md border-0 shadow-2xl rounded-3xl overflow-hidden backdrop-blur-sm bg-white/95">
          <CardHeader className="text-center bg-gradient-to-b from-white to-gray-50/50 p-8">
            <Image src="/kardex.png" alt="Kardex Logo" width={200} height={80} className="mx-auto mb-6" />
            <CardTitle className="text-2xl font-bold text-[#9E3B47] mb-2">Invalid Reset Link</CardTitle>
            <CardDescription className="text-[#5D6E73]">
              This password reset link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 text-center">
            <p className="text-[#5D6E73] mb-6">
              Please request a new password reset link to continue.
            </p>
            <div className="space-y-3">
              <p className="text-[#5D6E73] mb-6">
                Please contact your administrator for a new password reset link.
              </p>
              <Link href="/auth/login">
                <Button className="w-full h-12 font-semibold rounded-xl bg-gradient-to-r from-[#6F8A9D] to-[#82A094] hover:from-[#4a6b8a] hover:to-[#4F6A64] text-white">
                  Back to Login
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#6F8A9D] via-[#5a7ba0] to-[#4a6b8a]"></div>
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-[#82A094]/20 to-transparent rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-[#6F8A9D]/30 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>
      
      <div className="w-full max-w-md relative z-10">
        <Card className="border-0 shadow-2xl rounded-3xl overflow-hidden backdrop-blur-sm bg-white/95">
          <CardHeader className="text-center bg-gradient-to-b from-white to-gray-50/50 p-8 pb-6">
            <Image src="/kardex.png" alt="Kardex Logo" width={200} height={80} className="mx-auto mb-6" />
            <CardTitle className="text-2xl font-bold text-[#6F8A9D] mb-2">
              {resetSuccess ? "Password Updated!" : "Reset Your Password"}
            </CardTitle>
            <CardDescription className="text-[#5D6E73]">
              {resetSuccess 
                ? "Your password has been successfully updated"
                : "Enter your new password below"
              }
            </CardDescription>
          </CardHeader>

          <CardContent className="p-8 relative">
            {resetSuccess ? (
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-[#A2B9AF]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-12 w-12 text-[#4F6A64] animate-bounce" />
                </div>
                <h3 className="text-2xl font-bold text-[#546A7A] mb-3">Success!</h3>
                <p className="text-[#5D6E73] mb-6">Your password has been reset successfully. Redirecting to login...</p>
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-3 h-3 bg-[#A2B9AF]/100 rounded-full animate-bounce"></div>
                  <div className="w-3 h-3 bg-[#A2B9AF]/100 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-3 h-3 bg-[#A2B9AF]/100 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
              </div>
            ) : (
              <>
                {isSubmitting && (
                  <div className="absolute inset-0 bg-white/95 backdrop-blur-md flex items-center justify-center z-10 rounded-3xl">
                    <div className="text-center p-8">
                      <Loader2 className="h-16 w-16 text-[#6F8A9D] animate-spin mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-[#546A7A] mb-3">Updating Password...</h3>
                      <p className="text-[#5D6E73] text-sm">Please wait while we update your password</p>
                    </div>
                  </div>
                )}
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-[#5D6E73]">New Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                placeholder="Enter your new password"
                                type={showPassword ? "text" : "password"}
                                className="h-12 pl-4 pr-12 border-2 border-[#92A2A5] rounded-xl focus:border-[#6F8A9D] focus:ring-0 transition-colors duration-200 bg-[#AEBFC3]/10/50 focus:bg-white"
                                disabled={isSubmitting}
                                {...field}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#AEBFC3]0 hover:text-[#5D6E73]"
                              >
                                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage className="text-[#E17F70]0 text-xs mt-1" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium text-[#5D6E73]">Confirm New Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                placeholder="Confirm your new password"
                                type={showConfirmPassword ? "text" : "password"}
                                className="h-12 pl-4 pr-12 border-2 border-[#92A2A5] rounded-xl focus:border-[#6F8A9D] focus:ring-0 transition-colors duration-200 bg-[#AEBFC3]/10/50 focus:bg-white"
                                disabled={isSubmitting}
                                {...field}
                              />
                              <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#AEBFC3]0 hover:text-[#5D6E73]"
                              >
                                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                              </button>
                            </div>
                          </FormControl>
                          <FormMessage className="text-[#E17F70]0 text-xs mt-1" />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-12 font-semibold rounded-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] bg-gradient-to-r from-[#6F8A9D] to-[#82A094] hover:from-[#4a6b8a] hover:to-[#4F6A64] text-white shadow-lg hover:shadow-xl"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          <span>Updating Password...</span>
                        </>
                      ) : (
                        <>
                          <Lock className="h-5 w-5 mr-2" />
                          <span>Update Password</span>
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
              </>
            )}
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <p className="text-white/70 text-xs">© 2024 Kardex. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
