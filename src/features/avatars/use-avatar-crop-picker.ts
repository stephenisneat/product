"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { validateAvatarFile } from "@/lib/avatars/validate";

/** Manages file pick → object URL → crop dialog open state. */
export function useAvatarCropPicker() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const cropSrcRef = useRef<string | null>(null);

  useEffect(() => {
    cropSrcRef.current = cropSrc;
  }, [cropSrc]);

  useEffect(() => {
    return () => {
      if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current);
    };
  }, []);

  const openPicker = useCallback(() => {
    setPickError(null);
    fileInputRef.current?.click();
  }, []);

  const onFileSelected = useCallback((file: File | null) => {
    setPickError(null);
    if (!file) return;
    try {
      validateAvatarFile(file);
    } catch (err) {
      setPickError(err instanceof Error ? err.message : "Invalid image");
      return;
    }
    setCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setCropOpen(true);
  }, []);

  const onCropOpenChange = useCallback((open: boolean) => {
    setCropOpen(open);
    if (!open) {
      setCropSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  }, []);

  return {
    fileInputRef,
    cropSrc,
    cropOpen,
    pickError,
    setPickError,
    openPicker,
    onFileSelected,
    onCropOpenChange,
  } as const;
}
