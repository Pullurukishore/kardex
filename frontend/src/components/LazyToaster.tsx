"use client";

import dynamic from "next/dynamic";

const ToasterProvider = dynamic(() => import("@/components/ToasterProvider"), {
  ssr: false,
});

export default function LazyToaster() {
  return <ToasterProvider />;
}
