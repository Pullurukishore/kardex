"use client";

import { Toaster as SonnerToaster } from "sonner";

export default function ToasterProvider() {
  return (
    <SonnerToaster
      position="top-center"
      closeButton
      theme="light"
      richColors
      toastOptions={{
        style: {
          borderRadius: "12px",
          boxShadow:
            "0 10px 25px -5px rgba(110, 138, 157, 0.2), 0 8px 10px -6px rgba(110, 138, 157, 0.15)",
          fontWeight: 500,
        },
        classNames: {
          toast: "font-medium",
          success:
            "bg-gradient-to-r from-[#A2B9AF] to-[#82A094] text-white border-none",
          error:
            "bg-gradient-to-r from-[#E17F70] to-[#9E3B47] text-white border-none",
          warning:
            "bg-gradient-to-r from-[#EEC1BF] to-[#CE9F6B] text-white border-none",
          info:
            "bg-gradient-to-r from-[#96AEC2] to-[#6F8A9D] text-white border-none",
        },
      }}
    />
  );
}
